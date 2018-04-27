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
    return s && <ts.NamedDeclaration>s.valueDeclaration
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
        if (tsType.flags == ts.TypeFlags.Boolean || tsType.flags == (ts.TypeFlags.Boolean + ts.TypeFlags.Union))
            return BooleanVarType;
        if (tsType.flags & ts.TypeFlags.Object && tsType.getProperties().length > 0)
            return this.generateStructure(tsType);
        if (tsType.flags == ts.TypeFlags.Any)
            return PointerVarType;

        if (this.typeChecker.typeToString(tsType) != "{}")
            console.log("WARNING: Non-standard type: " + this.typeChecker.typeToString(tsType));
        return PointerVarType;
    }
    
    private generateStructure(tsType: ts.Type): StructType {
        let userStructInfo: PropertiesDictionary = {};
        for (let prop of tsType.getProperties()) {
            let declaration = <ts.NamedDeclaration>prop.valueDeclaration;
            let propTsType = this.typeChecker.getTypeOfSymbolAtLocation(prop, declaration);
            let propType = this.convertType(propTsType, <ts.Identifier>declaration.name);
            if (propType == PointerVarType && is.PropertyAssignment(declaration)) {
                if (declaration.initializer && is.ArrayLiteralExpression(declaration.initializer))
                    propType = this.determineArrayType(<ts.ArrayLiteralExpression>declaration.initializer);
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
        this.addTypeEquality(is.ElementAccessExpression, n => n, this.transforms.propertyOf(n => n.expression, n => {
            let text = n.argumentExpression.getText();
            return text.indexOf('"') == 0 ? text.slice(1, -1) : text
        }));
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

        for (let eq of equalities.filter(eq => eq.node1 && eq.node2))
            console.log(eq.node1.getText()," == ",eq.node2.getText(), eq.node2Property ? "prop:" + eq.node2Property : "");

        let changed;
        do {
            changed = false;
            for (let equality of equalities) {
                if (equality.node1 == null || equality.node2 == null)
                    continue;
                
                let type1 = this.getCType(equality.node1);
                let type2 = equality.node2Transform(this.getCType(equality.node2), equality.node2Property);
                let { type, replaced } = this.mergeTypes(type1, type2);
                if (type && replaced) {
                    changed = true;
                    this.setTypeOfNode(equality.node1, type);
                    if (!equality.node2Property)
                        this.setTypeOfNode(equality.node2, type);
                    else {
                        let node2Type = this.getCType(equality.node2);
                        if (!node2Type) {
                            node2Type = new StructType("", {});
                            this.setTypeOfNode(equality.node2, node2Type);
                        }
                        if (node2Type instanceof StructType)
                            node2Type.properties[equality.node2Property] = type;
                        else if (!(node2Type instanceof ArrayType) || isNaN(+equality.node2Property))
                            console.log("Internal error: accessing property " + equality.node2Property + " of ", node2Type);
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

    private mergeTypes(type1: CType, type2: CType) {
        let type2_result = { type: type2, replaced: true };
        let type1_result = { type: type1, replaced: true };
        let noChanges = { type: type1, replaced: false };

        if (!type1 && type2)
            return type2_result;
        else if (!type2)
            return type1_result;

        else if (typeof type1 == "string" && typeof type2 == "string" && type1 == type2)
            return noChanges;
            
        else if (type1 == VoidType)
            return type2_result;
        else if (type1 == PointerVarType)
            return type2_result;
        else if (type1 == UniversalVarType)
            return type2_result;

        else if (type2 == VoidType)
            return type1_result;
        else if (type2 == PointerVarType)
            return type1_result;
        else if (type2 == UniversalVarType)
            return type1_result;

        else if (type1 instanceof ArrayType && type2 instanceof ArrayType) {
            let changed = false;
            let cap = Math.max(type2.capacity, type1.capacity);
            let isDynamicArray = type2.isDynamicArray || type1.isDynamicArray;
            let elementTypeMergeResult = this.mergeTypes(type1.elementType, type2.elementType);
            if (type1.capacity != cap || type2.capacity != cap
                || type1.isDynamicArray != isDynamicArray || type2.isDynamicArray != isDynamicArray
                || elementTypeMergeResult.replaced)
                return { type: new ArrayType(elementTypeMergeResult.type, cap, isDynamicArray), changed: true };

            return noChanges;
        }
        else if (type1 instanceof DictType && type2 instanceof ArrayType) {
            return type1_result;
        }
        else if (type1 instanceof ArrayType && type2 instanceof DictType) {
            return type2_result;
        }
        else if (type1 instanceof StructType && type2 instanceof StructType) {
            let props = Object.keys(type1.properties).concat(Object.keys(type2.properties));
            let changed = false;
            for (let p of props) {
                let result = this.mergeTypes(type1.properties[p], type2.properties[p]);
                type2.properties[p] = result.type;
                if (!type1.properties[p] || result.replaced)
                    changed = true;
            }
            return changed ? type2_result : noChanges;
        }
        else if (type1 instanceof ArrayType && type2 instanceof StructType) {
            return this.mergeArrayAndStruct(type1, type2);
        }
        else if (type1 instanceof StructType && type2 instanceof ArrayType) {
            return this.mergeArrayAndStruct(type2, type1);
        }
        else if (type1 instanceof StructType && type2 instanceof DictType) {
            return type2_result;
        }
        else if (type1 instanceof DictType && type2 instanceof DictType) {
            if (type2.elementType != PointerVarType && type1.elementType == PointerVarType)
                return type2_result;

            return noChanges;
        }

        console.log("WARNING: candidate for UniversalVarType! Current: " + this.getTypeString(type1) + ", new: " + this.getTypeString(type2));
        return noChanges;
    }

    private mergeArrayAndStruct(arrayType: ArrayType, structType: StructType) {
        let props = Object.keys(structType.properties);
        let needPromoteToDictionary = false;
        let needPromoteToTuple = false;
        for (let p of props) {
            if (isNaN(+p))
                needPromoteToDictionary = true;
            if (this.mergeTypes(arrayType.elementType, structType.properties[p]).replaced)
                needPromoteToTuple = true;
        }
        if (needPromoteToDictionary && needPromoteToTuple)
            return { type: new DictType(UniversalVarType), replaced: true };
        else if (needPromoteToDictionary)
            return { type: new DictType(arrayType.elementType), replaced: true };
        else if (needPromoteToTuple)
            return { type: new ArrayType(UniversalVarType, arrayType.capacity, arrayType.isDynamicArray), replaced: true };
        else
            return { type: arrayType, replaced: false };
    }

}