import * as ts from 'typescript';
import {StandardCallHelper} from './standard';
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

const getTypeBodyText = (t: CType) => typeof t === "string" ? t : t.getBodyText();

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
    public getBodyText() {
        return getTypeBodyText(this.elementType) + "[" + (this.isDynamicArray ? "" : this.capacity) + "]";
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
        return 'struct ' + this.structName + ' *';
    }
    public getBodyText() {
        return "{" + Object.keys(this.properties).map(k => k + ": " + getTypeBodyText(this.properties[k])).join("; ") + "}";
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
    public getBodyText() {
        return "{" + getTypeBodyText(this.elementType) + "}";
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
export function getDeclaration(typechecker: ts.TypeChecker, n: ts.Node) {
    let s = typechecker.getSymbolAtLocation(n);
    return s && <ts.NamedDeclaration>s.valueDeclaration
}

type NodeFunc<T extends ts.Node> = { (n: T): ts.Node };
type NodeResolver<T extends ts.Node> = { getNode: NodeFunc<T>, getProp: { (n: T): string }, getType: { (t: CType, n: T, param?: string): CType }, setType: { (n, t, p): void } };
type Equality<T extends ts.Node> = [ { (n): n is T }, NodeFunc<T>, NodeResolver<T> ];

export class TypeHelper {

    private arrayLiteralsTypes: { [litArrayPos: number]: CType } = {};
    private objectLiteralsTypes: { [litObjectPos: number]: CType } = {};
    private typeOfNodeDict: {[id: string]: {node: ts.Node, type: CType}} = {};
    private structsNumber = 0;

    constructor(private typeChecker: ts.TypeChecker) { }

    public getCType(node: ts.Node): CType {
        if (!node || !node.kind)
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
    
    /** Get textual representation of type of the parameter for inserting into the C code */
    public getTypeString(source) {

        if (source.flags != null && source.intrinsicName != null) // ts.Type
            source = this.convertType(source)
        else if (source.flags != null && source.callSignatures != null && source.constructSignatures != null) // ts.Type
            source = this.convertType(source)
        else if (source.kind != null && source.flags != null) // ts.Node
            source = this.getCType(source);

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

    public inferTypes(allNodes: ts.Node[]) {

        const propertyOf = <T extends ts.Node>(nodeFunc: NodeFunc<T>, propFunc: { (n: T): string }): NodeResolver<T> => ({
            getNode: nodeFunc,
            getProp: propFunc,
            getType: (t, n, p) => t instanceof StructType && t.properties[p],
            setType: (n, t, p) => this.setNodeType(n, this.mergeTypes(this.getCType(n), new StructType("struct_" + (this.structsNumber++) + "_t", { [p]: t })).type)
        });
        const elementOf = <T extends ts.Node>(nodeFunc: NodeFunc<T>): NodeResolver<T> => ({
            getNode: nodeFunc,
            getProp: n => null,
            getType: (t, n, p) => t instanceof ArrayType && t.elementType,
            setType: (n, t, p) => this.setNodeType(n, this.mergeTypes(this.getCType(n), new ArrayType(t, 0, false)).type)
        });
        const propertyOrElementOf = <T extends ts.Node>(nodeFunc: NodeFunc<T>, propFunc: { (n: T): string }): NodeResolver<T> => ({
            getNode: nodeFunc,
            getProp: propFunc,
            getType: (t, n, p) => t instanceof StructType && t.properties[p] || !isNaN(+p) && t instanceof ArrayType && t.elementType,
            setType: (n, t, p) => {
                this.setNodeType(n, this.getCType(n) instanceof ArrayType
                ? this.mergeTypes(this.getCType(n), new ArrayType(t, +p, false)).type
                : this.mergeTypes(this.getCType(n), new StructType("struct_" + (this.structsNumber++) + "_t", { [p]: t })).type)
            }
        });

        let typeEqualities: Equality<any>[] = [];

        const addEquality = <T extends ts.Node>(typeGuard: { (n): n is T }, node1: NodeFunc<T>, node2: string | NodeFunc<T> | NodeResolver<T>) => {
            if (typeof node2 == "string")
                typeEqualities.push([ typeGuard, node1, { getNode: node1, getProp: n => null, getType: t => node2, setType: (n, t, p) => null } ]);
            else if (typeof node2 == "function")
                typeEqualities.push([ typeGuard, node1, { getNode: node2, getProp: n => null, getType: t => t, setType: this.setNodeType.bind(this) }]);
            else
                typeEqualities.push([ typeGuard, node1, node2 ]);
        };

        addEquality(is.Identifier, n => n, n => getDeclaration(this.typeChecker, n));
        addEquality(is.PropertyAccessExpression, n => n, propertyOf(n => n.expression, n => n.name.getText()));
        addEquality(this.isSimpleElementAccess, n => n, propertyOrElementOf(n => n.expression, n => n.argumentExpression.getText().replace(/^"(.*)"$/g,"$1")));

        addEquality(is.CallExpression, n => n, n => getDeclaration(this.typeChecker, n.expression));
        addEquality(this.isStandardCall, n => n, {
            getNode: n => n,
            getProp: n => null,
            getType: (t, n, p) => StandardCallHelper.getReturnType(this, n),
            setType: this.setNodeType.bind(this)
        });

        addEquality(is.VariableDeclaration, n => n, n => n.initializer);
        addEquality(is.PropertyAssignment, n => n, n => n.initializer);
        addEquality(is.PropertyAssignment, n => n, propertyOf(n => n.parent, n => n.name.getText()));
        addEquality(is.FunctionDeclaration, n => n, VoidType);
        addEquality(is.ForOfStatement, n => n.initializer, elementOf(n => n.expression));
        addEquality(is.ForInStatement, n => n.initializer, StringVarType);
        addEquality(is.BinaryExpression, n => n.left, n => n.right);
        addEquality(is.ReturnStatement, n => n.expression, n => findParentFunction(n));

        this.resolveTypes(allNodes, typeEqualities);
    }

    private resolveTypes(allNodes: ts.Node[], typeEqualities: Equality<any>[]) {
        let equalities: [ ts.Node, Equality<any> ][] = [];
        typeEqualities.forEach(teq =>
            allNodes.forEach(node => { if (teq[0].bind(this)(node)) equalities.push([node, teq]); })
        );

        let typesDict = {};
        let changed;
        do {
            changed = false;
            for (let equality of equalities) {
                let [ node, [ _, node1_func, node2_resolver ] ] = equality;
                let node1 = node1_func(node);
                let node2 = node2_resolver.getNode(node);
                if (!node1 || !node2)
                    continue;

                let node2Property = node2_resolver.getProp(node);
                let type1 = this.getCType(node1);
                let type2 = node2_resolver.getType(this.getCType(node2), node, node2Property);

                let { type, replaced } = this.mergeTypes(type2, type1);
                if (type) {
                    if (replaced)
                        changed = true;
                    this.setNodeType(node1, type);
                    node2_resolver.setType(node2, type, node2Property)
                }
            }
        } while (changed);

    }

    private isStandardCall(n: ts.Node): n is ts.CallExpression {
        return StandardCallHelper.isStandardCall(this, n);
    }
    private isSimpleElementAccess(n: ts.Node): n is ts.ElementAccessExpression {
        return is.ElementAccessExpression(n) && (is.StringLiteral(n.argumentExpression) || is.NumericLiteral(n.argumentExpression))
    }
    private setNodeType(n, t) {
        if (n)
            this.typeOfNodeDict[n.pos + "_" + n.end] = { node: n, type: t };
    }

    private typesDict = {};
    private ensureNoTypeDuplicates(t) {
        if (!t)
            return null;
        let typeBodyText = getTypeBodyText(t);
        let type = this.typesDict[typeBodyText];
        if (!type)
            type = this.typesDict[typeBodyText] = t;
        return type;
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
        return this.ensureNoTypeDuplicates(new StructType("struct_" + (this.structsNumber++) + "_t", userStructInfo));
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

    private mergeTypes(type1: CType, type2: CType): { type: CType, replaced: boolean } {
        let type2_result = { type: this.ensureNoTypeDuplicates(type2), replaced: true };
        let type1_result = { type: this.ensureNoTypeDuplicates(type1), replaced: true };
        let noChanges = { type: this.ensureNoTypeDuplicates(type1), replaced: false };

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
                return { type: new ArrayType(elementTypeMergeResult.type, cap, isDynamicArray), replaced: true };

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
            let newStruct = new StructType("struct_" + (this.structsNumber++) + "_t", {});
            for (let p of props) {
                let result = this.mergeTypes(type1.properties[p], type2.properties[p]);
                newStruct.properties[p] = result.type;
                if (result.replaced)
                    changed = true;
            }
            return changed ? { type: this.ensureNoTypeDuplicates(newStruct), replaced: true } : noChanges;
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
            if (type1.elementType != PointerVarType && type2.elementType == PointerVarType)
                return type1_result;
            if (type2.elementType != PointerVarType && type1.elementType == PointerVarType)
                return type2_result;

            return noChanges;
        }

        throw new Error("Error: Not supported yet. This code requires universal variable types, that aren't yet implemented. " +
                        "Variable is assigned incompatible values: " + this.getTypeString(type1) + " and " + this.getTypeString(type2));
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
            return { type: arrayType, replaced: true };
    }

}