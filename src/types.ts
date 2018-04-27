import * as ts from 'typescript';
import {StandardCallHelper} from './resolver';
import * as is from './typeguards';

export type CType = string | StructType | ArrayType | DictType;
export const UniversalVarType = "struct js_var *";
export const VoidType = "void";
export const PointerVarType = "void *";
export const StringVarType = "const char *";
export const NumberVarType = "int16_t";
export const BooleanVarType = "uint8_t";
export const RegexVarType = "struct regex_struct_t";
export const RegexMatchVarType = "struct regex_match_struct_t";

/** Type that represents static or dynamic array */
export class ArrayType {

    public static getArrayStructName(elementTypeText: string) {
        while (elementTypeText.indexOf(NumberVarType) > -1)
            elementTypeText = elementTypeText.replace(NumberVarType, "number");
        while (elementTypeText.indexOf(StringVarType) > -1)
            elementTypeText = elementTypeText.replace(StringVarType, "string");
        while (elementTypeText.indexOf(PointerVarType) > -1)
            elementTypeText = elementTypeText.replace(PointerVarType, "pointer");
        while (elementTypeText.indexOf(BooleanVarType) > -1)
            elementTypeText = elementTypeText.replace(BooleanVarType, "bool");

        elementTypeText = elementTypeText.replace(/^struct array_(.*)_t \*$/, (all, g1) => "array_" + g1);

        return "array_" +
            elementTypeText
                .replace(/^static /, '').replace('{var}', '').replace(/[\[\]]/g, '')
                .replace(/ /g, '_')
                .replace(/const char \*/g, 'string')
                .replace(/\*/g, 'p') + "_t";
    }

    private structName: string;
    public getText() {

        let elementType = this.elementType;
        let elementTypeText;
        if (typeof elementType === 'string')
            elementTypeText = elementType;
        else
            elementTypeText = elementType.getText();

        this.structName = ArrayType.getArrayStructName(elementTypeText);

        if (this.isDynamicArray)
            return "struct " + this.structName + " *";
        else
            return "static " + elementTypeText + " {var}[" + this.capacity + "]";
    }
    constructor(
        public elementType: CType,
        public capacity: number,
        public isDynamicArray: boolean
    ) {
    }
}

type PropertiesDictionary = { [propName: string]: CType };

/** Type that represents JS object with static properties (implemented as C struct) */
export class StructType {
    public getText() {
        return this.structName;
    }
    constructor(
        public structName: string,
        public properties: PropertiesDictionary
    ) { }
}

/** Type that represents JS object with dynamic properties (implemented as dynamic dictionary) */
export class DictType {
    public getText() {
        let elementType = this.elementType;
        let elementTypeText;
        if (typeof elementType === 'string')
            elementTypeText = elementType;
        else
            elementTypeText = elementType.getText();

        return "DICT(" + elementTypeText + ")";
    }
    constructor(
        public elementType: CType
    ) { }
}

export function findParentFunction(node: ts.Node): ts.FunctionDeclaration {
    let parentFunc = node;
    while (parentFunc && parentFunc.kind != ts.SyntaxKind.FunctionDeclaration) {
        parentFunc = parentFunc.parent;
    }
    return <ts.FunctionDeclaration>parentFunc;
}
export function processAllNodes(startNode: ts.Node, callback: { (n: ts.Node): void }) {
    let queue = [ startNode ];
    while (queue.length) {
        let node = queue.shift();
        callback(node);
        queue.push.apply(queue, node.getChildren());
    }
}
export function getDeclaration(typechecker: ts.TypeChecker, n: ts.Node) {
    let s = typechecker.getSymbolAtLocation(n);
    return s && s.valueDeclaration
}


type TypeTransform = { (t: CType, param?: string): CType };
type NodeFunc<T> = { (n: T): ts.Node };
type PropFunc<T> = { (n: T): string };
type WrappedNodeFunc<T> = { nodeFunc: NodeFunc<T>, propFunc?: PropFunc<T>, typeTransform: TypeTransform };
type TypeEquality = { typeGuard: {(n): n is any}, getNode: NodeFunc<any>, equalTo: WrappedNodeFunc<any> };
const createWrappedNodeFunc = (tt: TypeTransform) => <T>(nf: NodeFunc<T>, pf?: PropFunc<T>): WrappedNodeFunc<T> => ({ nodeFunc: nf, propFunc: pf, typeTransform: tt });

export class TypeHelper {

    private arrayLiteralsTypes: { [litArrayPos: number]: CType } = {};
    private objectLiteralsTypes: { [litObjectPos: number]: CType } = {};

    constructor(private typeChecker: ts.TypeChecker) { }

    public getCType(node: ts.Node): CType {
        if (!node.kind)
            return null;

        let found = this.typeOfNodeDict[node.pos + "_" + node.end];
        if (found)
            return found.type;

        switch (node.kind) {
            case ts.SyntaxKind.NumericLiteral:
                return NumberVarType;
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
                return BooleanVarType;
            case ts.SyntaxKind.StringLiteral:
                return StringVarType;
            case ts.SyntaxKind.RegularExpressionLiteral:
                return RegexVarType;
            case ts.SyntaxKind.ArrayLiteralExpression:
                {
                    if (!this.arrayLiteralsTypes[node.pos])
                        this.determineArrayType(<ts.ArrayLiteralExpression>node);
                    return this.arrayLiteralsTypes[node.pos];
                }
            case ts.SyntaxKind.ObjectLiteralExpression:
                {
                    if (!this.objectLiteralsTypes[node.pos])
                        this.objectLiteralsTypes[node.pos] = this.generateStructure(this.typeChecker.getTypeAtLocation(node));
                    return this.objectLiteralsTypes[node.pos];
                }
            case ts.SyntaxKind.CallExpression:
                {
                    let call = <ts.CallExpression>node;
                    let retType = StandardCallHelper.getReturnType(this, call);
                    if (retType)
                        return retType;
                }
        }

        let tsType = this.typeChecker.getTypeAtLocation(node);
        let type = tsType && this.convertType(tsType);
        if (type != UniversalVarType && type != PointerVarType)
            return type;
        
        return null;
    }

    /** Convert ts.Type to CType */
    /** Used mostly during type preprocessing stage */
    private convertType(tsType: ts.Type, ident?: ts.Identifier): CType {
        if (!tsType || tsType.flags == ts.TypeFlags.Void)
            return VoidType;

        if (tsType.flags == ts.TypeFlags.String || tsType.flags == ts.TypeFlags.StringLiteral)
            return StringVarType;
        if (tsType.flags == ts.TypeFlags.Number || tsType.flags == ts.TypeFlags.NumberLiteral)
            return NumberVarType;
        if (tsType.flags == ts.TypeFlags.Boolean || tsType.flags == (ts.TypeFlags.Boolean+ts.TypeFlags.Union))
            return BooleanVarType;

        if (tsType.flags & ts.TypeFlags.Object) {
            return this.generateStructure(tsType);
        }

        if (tsType.flags == ts.TypeFlags.Any)
            return PointerVarType;

        console.log("Non-standard type: " + this.typeChecker.typeToString(tsType));
        return PointerVarType;
    }
    
    private generateStructure(tsType: ts.Type): StructType {
        let userStructInfo: PropertiesDictionary = {};
        for (let prop of tsType.getProperties()) {
            let propTsType = this.typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration);
            let propType = this.convertType(propTsType, <ts.Identifier>prop.valueDeclaration.name);
            if (propType == PointerVarType && is.PropertyAssignment(prop.valueDeclaration)) {
                let propAssignment = <ts.PropertyAssignment>prop.valueDeclaration;
                if (propAssignment.initializer && is.ArrayLiteralExpression(propAssignment.initializer))
                    propType = this.determineArrayType(<ts.ArrayLiteralExpression>propAssignment.initializer);
            }
            userStructInfo[prop.name] = propType;
        }
        return new StructType("", userStructInfo);
    }

    
    /** Get textual representation of type of the parameter for inserting into the C code */
    public getTypeString(source) {

        if (source.flags != null && source.intrinsicName != null) // ts.Type
            source = this.convertType(source)
        else if (source.flags != null && source.callSignatures != null && source.constructSignatures != null) // ts.Type
            source = this.convertType(source)
        else if (source.kind != null && source.flags != null) // ts.Node
            source = this.getCType(source);
        //else if (source.name != null && source.flags != null && source.valueDeclaration != null && source.declarations != null) //ts.Symbol
        //    source = this.variables[source.valueDeclaration.pos].type;

        if (source instanceof ArrayType) {
            return source.getText();
        } else if (source instanceof StructType)
            return source.getText();
        else if (source instanceof DictType)
            return source.getText();
        else if (typeof source === 'string')
            return source;
        else
            throw new Error("Unrecognized type source");
    }

    private transforms = {
        elementOf: createWrappedNodeFunc(t => t instanceof ArrayType && t.elementType),
        propertyOf: createWrappedNodeFunc((t, p) => t instanceof StructType && t.properties[p])
    };

    private typeEqualities: TypeEquality[] = [];
    
    private addTypeEquality<T>(typeGuard: {(n): n is T}, left: NodeFunc<T>, right: CType | NodeFunc<T> | WrappedNodeFunc<T>) {
        const toWrapped = value => {
            if (typeof value === 'function')
                return { nodeFunc: value, typeTransform: t => t };
            else if (typeof value === 'string')
                return { nodeFunc: n => n, typeTransform: t => value };
            else
                return value;
        };
        this.typeEqualities.push({ typeGuard, getNode: left, equalTo: toWrapped(right) });
    }

    private typeOfNodeDict: {[id: string]: {node: ts.Node, type: CType}} = {};
    private setTypeOfNode = (n: ts.Node, t: CType) => this.typeOfNodeDict[n.pos + "_" + n.end] = { node: n, type: t };

    public inferTypes(startNode: ts.Node) {

        this.addTypeEquality(is.Identifier, n => n, n => getDeclaration(this.typeChecker, n));
        this.addTypeEquality(is.PropertyAccessExpression, n => n, this.transforms.propertyOf(n => n.expression, n => n.name.getText()));
        this.addTypeEquality(is.ElementAccessExpression, n => n, this.transforms.propertyOf(n => n.expression, n => n.argumentExpression.getText().slice(1, -1)));
        this.addTypeEquality(is.CallExpression, n => n, n => getDeclaration(this.typeChecker, n.expression));
        
        this.addTypeEquality(is.VariableDeclaration, n => n, n => n.initializer);
        this.addTypeEquality(is.PropertyAssignment, n => n, n => n.initializer);
        this.addTypeEquality(is.PropertyAssignment, n => n, this.transforms.propertyOf(n => n.parent, n => n.name.getText()));
        this.addTypeEquality(is.FunctionDeclaration, n => n, VoidType);
        this.addTypeEquality(is.ForOfStatement, n => n.initializer, this.transforms.elementOf(n => n.expression));
        this.addTypeEquality(is.ForInStatement, n => n.initializer, StringVarType);
        this.addTypeEquality(is.BinaryExpression, n => n.left, n => n.right);
        this.addTypeEquality(is.ReturnStatement, n => n.expression, n => findParentFunction(n));

        let equalities: {
            node1: ts.Node,
            node2: ts.Node,
            node2Property: string,
            node2Transform: (t: CType, param?: string) => CType
        }[] = [];
        processAllNodes(startNode, node => {
            for (let eq of this.typeEqualities) {
                if (eq.typeGuard(node))
                    equalities.push({
                        node1: eq.getNode(node),
                        node2: eq.equalTo.nodeFunc(node),
                        node2Property: eq.equalTo.propFunc && eq.equalTo.propFunc(node),
                        node2Transform: eq.equalTo.typeTransform
                    });

                // standard calls
                if (is.CallExpression(node) && StandardCallHelper.isStandardCall(this, node))
                    equalities.push({
                        node1: node,
                        node2: getDeclaration(this.typeChecker, node),
                        node2Property: null,
                        node2Transform: t => StandardCallHelper.getReturnType(this, node)
                    });
            }
        });

        let changed;
        do {
            changed = false;
            for (let equality of equalities) {
                if (equality.node1 == null || equality.node2 == null)
                    continue;
                
                let type1 = this.getCType(equality.node1);
                let type2 = equality.node2Transform(this.getCType(equality.node2), equality.node2Property);
                let { type } = this.mergeTypes(type1, type2);
                if (type && type1 != type2) {
                    changed = true;
                    this.setTypeOfNode(equality.node1, type);
                    if (!equality.node2Property)
                        this.setTypeOfNode(equality.node2, type);
                    else {
                        let node2Type = this.getCType(equality.node2);
                        if (node2Type instanceof StructType)
                            node2Type.properties[equality.node2Property] = type;
                        else
                            console.log("Internal error: accessing property " + equality.node2Property + " of non-structure.");
                    }
                }
            }
        } while (changed);

        for (let k in this.typeOfNodeDict) {
            console.log(this.typeOfNodeDict[k].node.getText(), this.typeOfNodeDict[k].type);
        }
    }
   

    private determineArrayType(arrLiteral: ts.ArrayLiteralExpression): ArrayType {
        let elementType: CType = PointerVarType;
        let cap = arrLiteral.elements.length;
        if (cap > 0)
            elementType = this.convertType(this.typeChecker.getTypeAtLocation(arrLiteral.elements[0]));

        let type = new ArrayType(elementType, cap, false);
        this.arrayLiteralsTypes[arrLiteral.pos] = type;
        return type;
    }

    private mergeTypes(currentType: CType, newType: CType) {
        let newResult = { type: newType, replaced: true };
        let currentResult = { type: currentType, replaced: false };

        if (!currentType && newType)
            return newResult;
        else if (!newType)
            return currentResult;
            
        else if (newType == VoidType)
            return currentResult;
        else if (newType == PointerVarType)
            return currentResult;
        else if (newType == UniversalVarType)
            return currentResult;

        else if (currentType == VoidType)
            return newResult;
        else if (currentType == PointerVarType)
            return newResult;
        else if (currentType == UniversalVarType)
            return newResult;

        else if (currentType == StringVarType && newType == StringVarType)
            return currentResult;
        else if (currentType == NumberVarType && newType == NumberVarType)
            return currentResult;
        else if (currentType == BooleanVarType && newType == BooleanVarType)
            return currentResult;

        else if (currentType instanceof ArrayType && newType instanceof ArrayType) {
            let cap = Math.max(newType.capacity, currentType.capacity);
            newType.capacity = cap;
            currentType.capacity = cap;
            let isDynamicArray = newType.isDynamicArray || currentType.isDynamicArray;
            newType.isDynamicArray = isDynamicArray;
            currentType.isDynamicArray = isDynamicArray;

            let mergeResult = this.mergeTypes(currentType.elementType, newType.elementType);
            newType.elementType = mergeResult.type;
            currentType.elementType = mergeResult.type;
            if (mergeResult.replaced)
                return newResult;

            return currentResult;
        }
        else if (currentType instanceof DictType && newType instanceof ArrayType) {
            if (newType.elementType == currentType.elementType || currentType.elementType == PointerVarType)
                return newResult;
        }
        else if (currentType instanceof ArrayType && newType instanceof DictType) {
            if (newType.elementType == currentType.elementType || newType.elementType == PointerVarType)
                return currentResult;
        }
        else if (currentType instanceof StructType && newType instanceof StructType) {
            let props = Object.keys(currentType.properties).concat(Object.keys(newType.properties));
            for (let p of props) {
                newType.properties[p] = this.mergeTypes(currentType.properties[p], newType.properties[p]).type;
            }
            return newResult;
        }
        else if (currentType instanceof StructType && newType instanceof DictType) {
            return newResult;
        }
        else if (currentType instanceof DictType && newType instanceof DictType) {
            if (newType.elementType != PointerVarType && currentType.elementType == PointerVarType)
                return newResult;

            return currentResult;
        }

        console.log("WARNING: candidate for UniversalVarType! Current: " + this.getTypeString(currentType) + ", new: " + this.getTypeString(newType));
        return currentResult;
    }

}