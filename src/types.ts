import * as ts from 'typescript';
import { StandardCallHelper } from './standard';

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
        
        elementTypeText = elementTypeText.replace(/^struct ([a-z0-9_]+)_t \*$/, (all, g1) => g1);

        //elementTypeText = elementTypeText.replace(/^struct array_(.*)_t \*$/, (all, g1) => "array_" + g1);

        return "array_" +
            elementTypeText
                .replace(/^static /, '').replace('{var}', '').replace(/[\[\]]/g, '')
                .replace(/ /g, '_')
                .replace(/const char \*/g, 'string')
                .replace(/\*/g, 'p') + "_t";
    }

    public getText() {

        let elementType = this.elementType;
        let elementTypeText;
        if (typeof elementType === 'string')
            elementTypeText = elementType;
        else
            elementTypeText = elementType.getText();

        let structName = ArrayType.getArrayStructName(elementTypeText);

        if (this.isDynamicArray)
            return "struct " + structName + " *";
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

type PropertiesDictionary = { readonly[propName: string]: CType };

/** Type that represents JS object with static properties (implemented as C struct) */
export class StructType {
    public structName: string;
    public getText() {
        return 'struct ' + this.structName + ' *';
    }
    get properties(): PropertiesDictionary {
        return Object.keys(this.propertyDefs)
            .sort((a, b) => this.propertyDefs[a].order - this.propertyDefs[b].order)
            .reduce((acc, k) => { acc[k] = this.propertyDefs[k].type; return acc; }, {});
    }
    public getBodyText() {
        return "{" + Object.keys(this.propertyDefs).sort().map(k => k + ": " + getTypeBodyText(this.properties[k])).join("; ") + "}";
    }
    constructor(
        public propertyDefs: { [propName: string]: { type: CType, order: number } }
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

export function isNode(n): n is ts.Node {
    return n && n.kind !== undefined && n.flags !== undefined && n.pos !== undefined && n.end !== undefined;
}
export function isEqualsExpression(n): n is ts.BinaryExpression {
    return n && n.kind == ts.SyntaxKind.BinaryExpression && n.operatorToken.kind == ts.SyntaxKind.EqualsToken;
}
export function isMethodCall(n): n is MethodCallExpression {
    return ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression);
}
export function isFieldElementAccess(n): n is ts.ElementAccessExpression {
    return ts.isElementAccessExpression(n) && (!ts.isCallExpression(n.parent) || n.parent.expression != n);
}
export function isFieldPropertyAccess(n): n is ts.PropertyAccessExpression {
    return ts.isPropertyAccessExpression(n) && (!ts.isCallExpression(n.parent) || n.parent.expression != n);
}
export function isForOfWithSimpleInitializer(n): n is ForOfWithSimpleInitializer {
    return ts.isForOfStatement(n) && ts.isVariableDeclarationList(n.initializer) && n.initializer.declarations.length == 1;
}
export function isForOfWithIdentifierInitializer(n): n is ForOfWithExpressionInitializer {
    return ts.isForOfStatement(n) && ts.isIdentifier(n.initializer);
}
export function isLiteral(n): n is ts.LiteralExpression {
    return ts.isNumericLiteral(n) || ts.isStringLiteral(n) || ts.isRegularExpressionLiteral(n) || n.kind == ts.SyntaxKind.TrueKeyword || n.kind == ts.SyntaxKind.FalseKeyword;
}


type NodeFunc<T extends ts.Node> = { (n: T): ts.Node };
type NodeResolver<T extends ts.Node> = { getNode?: NodeFunc<T>, getType?: { (n: T): CType } };
type Equality<T extends ts.Node> = [{ (n): n is T }, NodeFunc<T>, NodeResolver<T>];
interface MethodCallExpression extends ts.LeftHandSideExpression, ts.Declaration {
    kind: ts.SyntaxKind.CallExpression;
    expression: ts.PropertyAccessExpression;
    typeArguments?: ts.NodeArray<ts.TypeNode>;
    arguments: ts.NodeArray<ts.Expression>;
}

interface ForOfWithSimpleInitializer extends ts.ForOfStatement {
    initializer: ts.VariableDeclarationList;
}
interface ForOfWithExpressionInitializer extends ts.ForOfStatement {
    initializer: ts.Identifier;
}

export class TypeHelper {

    private arrayLiteralsTypes: { [litArrayPos: number]: CType } = {};
    private objectLiteralsTypes: { [litObjectPos: number]: CType } = {};
    private typeOfNodeDict: { [id: string]: { node: ts.Node, type: CType } } = {};

    constructor(private typeChecker: ts.TypeChecker) { }

    /** Get C type of TypeScript node */
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

        let cType = source;
        if (source.flags != null && source.intrinsicName != null) // ts.Type
            cType = this.convertType(source)
        else if (source.flags != null && source.callSignatures != null && source.constructSignatures != null) // ts.Type
            cType = this.convertType(source)
        else if (source.kind != null && source.flags != null) // ts.Node
            cType = this.getCType(source);

        if (cType instanceof ArrayType) {
            return cType.getText();
        } else if (cType instanceof StructType)
            return cType.getText();
        else if (cType instanceof DictType)
            return cType.getText();
        else if (typeof cType === 'string')
            return cType;
        else
            throw new Error("Cannot determine variable type from source " + (source && source.getText ? source.getText() : JSON.stringify(source)));
    }

    /** Postprocess TypeScript AST for better type inference */
    /** Creates typeOfNodeDict that is later used in getCType */
    public inferTypes(allNodes: ts.Node[]) {

        const type = <T extends ts.Node>(t: { (n: T): CType } | string): NodeResolver<T> => ({ getType: typeof (t) === "string" ? _ => t : t });
        const struct = (prop: string, pos: number, elemType: CType = PointerVarType): StructType => new StructType({ [prop]: { type: elemType, order: pos } });

        let typeEqualities: Equality<any>[] = [];

        const addEquality = <T extends ts.Node>(typeGuard: { (n): n is T }, node1: NodeFunc<T>, node2: NodeFunc<T> | NodeResolver<T>) => {
            if (typeof node2 == "function")
                typeEqualities.push([typeGuard, node1, { getNode: node2 }]);
            else
                typeEqualities.push([typeGuard, node1, node2]);
        };

        addEquality(ts.isIdentifier, n => n, n => getDeclaration(this.typeChecker, n));
        addEquality(isEqualsExpression, n => n.left, n => n.right);
        addEquality(ts.isConditionalExpression, n => n.whenTrue, n => n.whenFalse);
        addEquality(ts.isConditionalExpression, n => n, n => n.whenTrue);
        addEquality(ts.isVariableDeclaration, n => n, n => n.initializer);

        addEquality(ts.isPropertyAssignment, n => n, n => n.initializer);
        addEquality(ts.isPropertyAssignment, n => n.parent, type(n => struct(n.name.getText(), n.pos, this.getCType(n) || PointerVarType)));
        addEquality(ts.isPropertyAssignment, n => n, type(n => {
            const type = this.getCType(n.parent);
            return type instanceof StructType ? type.properties[n.name.getText()] : null;
        }));

        addEquality(isFieldPropertyAccess, n => n.expression, type(n => struct(n.name.getText(), n.pos, this.getCType(n) || PointerVarType)));
        addEquality(isFieldPropertyAccess, n => n, type(n => {
            const type = this.getCType(n.expression);
            return type instanceof StructType ? type.properties[n.name.getText()]
                : type instanceof ArrayType && n.name.getText() == "length" ? NumberVarType
                    : null;
        }));

        addEquality(isFieldElementAccess, n => n.expression, type(n => {
            const type = this.getCType(n.argumentExpression);
            const elementType = this.getCType(n) || PointerVarType;
            return ts.isStringLiteral(n.argumentExpression) ? struct(n.argumentExpression.getText().slice(1, -1), n.pos, elementType)
                : ts.isNumericLiteral(n.argumentExpression) ? new ArrayType(elementType, 0, false)
                    : type == NumberVarType ? new ArrayType(elementType, 0, false)
                        : type == StringVarType ? new DictType(elementType)
                            : null
        }));
        addEquality(isFieldElementAccess, n => n, type(n => {
            const type = this.getCType(n.expression);
            return ts.isStringLiteral(n.argumentExpression) && type instanceof StructType ? type.properties[n.argumentExpression.getText().slice(1, -1)]
                : ts.isStringLiteral(n.argumentExpression) && type instanceof ArrayType && n.argumentExpression.getText() == "length" ? NumberVarType
                    : type instanceof ArrayType || type instanceof DictType ? type.elementType
                        : null
        }));

        addEquality(ts.isCallExpression, n => n, n => getDeclaration(this.typeChecker, n.expression));
        for (let i = 0; i < 10; i++)
            addEquality(ts.isCallExpression, n => n.arguments[i], n => {
                const func = <ts.FunctionDeclaration>getDeclaration(this.typeChecker, n.expression);
                return func ? func.parameters.map(p => p.name)[i] : null
            });
        addEquality(ts.isParameter, n => n.name, n => n.initializer);
        addEquality(isMethodCall, n => n.expression.expression, type(n => StandardCallHelper.getObjectType(this, n)));
        for (let i = 0; i < 10; i++)
            addEquality(isMethodCall, n => n.arguments[i], type(n => isLiteral(n.arguments[i]) ? null : StandardCallHelper.getArgumentTypes(this, n)[i]));

        addEquality(ts.isFunctionDeclaration, n => n, type(VoidType));
        addEquality(isForOfWithSimpleInitializer, n => n.expression, type(n => new ArrayType(this.getCType(n.initializer.declarations[0]) || PointerVarType, 0, false)));
        addEquality(isForOfWithSimpleInitializer, n => n.initializer.declarations[0], type(n => {
            const type = this.getCType(n.expression);
            return type instanceof ArrayType ? type.elementType : null
        }));
        addEquality(isForOfWithIdentifierInitializer, n => n.expression, type(n => new ArrayType(this.getCType(n.initializer) || PointerVarType, 0, false)));
        addEquality(isForOfWithIdentifierInitializer, n => n.initializer, type(n => {
            const type = this.getCType(n.expression);
            return type instanceof ArrayType ? type.elementType : null
        }));
        addEquality(ts.isForInStatement, n => n.initializer, type(StringVarType));
        addEquality(ts.isReturnStatement, n => n.expression, n => findParentFunction(n));

        this.resolveTypes(allNodes, typeEqualities);
    }

    private resolveTypes(allNodes: ts.Node[], typeEqualities: Equality<any>[]) {
        allNodes.forEach(n => this.setNodeType(n, this.getCType(n)))

        let equalities: [ts.Node, Equality<any>][] = [];
        typeEqualities.forEach(teq =>
            allNodes.forEach(node => { if (teq[0].bind(this)(node)) equalities.push([node, teq]); })
        );

        let changed;
        do {
            changed = false;
            for (let equality of equalities) {
                let [node, [_, node1_func, node2_resolver]] = equality;
                let node1 = node1_func(node);
                if (!node1)
                    continue;

                let type1 = this.getCType(node1);

                let node2 = node2_resolver.getNode ? node2_resolver.getNode(node) : null;
                let type2 = node2_resolver.getType ? node2_resolver.getType(node) : this.getCType(node2);
                if (!node2 && !type2)
                    continue;

                let { type, replaced } = this.mergeTypes(type1, type2);
                if (type && replaced) {
                    if (type != type1)
                        changed = true;
                    this.setNodeType(node1, type);
                    if (node2)
                        this.setNodeType(node2, type);
                }
            }
        } while (changed);

        allNodes
            .filter(n => !ts.isToken(n) && !ts.isBlock(n) && n.kind != ts.SyntaxKind.SyntaxList)
            .forEach(n => console.log(n.getText(), "|", ts.SyntaxKind[n.kind], "|", JSON.stringify(this.getCType(n))));

    }
    private setNodeType(n, t) {
        if (n && t)
            this.typeOfNodeDict[n.pos + "_" + n.end] = { node: n, type: t };
    }

    private typesDict = {};
    private ensureNoTypeDuplicates(t) {
        if (!t)
            return null;
        let typeBodyText = getTypeBodyText(t);
        let type = this.typesDict[typeBodyText];
        if (type instanceof ArrayType)
            type.capacity = Math.max(type.capacity, t.capacity);
        if (!type)
            type = this.typesDict[typeBodyText] = t;
        return type;
    }


    /** Convert ts.Type to CType */
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
        let userStructInfo = {};
        for (let prop of tsType.getProperties()) {
            let declaration = <ts.NamedDeclaration>prop.valueDeclaration;
            let propTsType = this.typeChecker.getTypeOfSymbolAtLocation(prop, declaration);
            let propType = this.convertType(propTsType, <ts.Identifier>declaration.name);
            if (propType == PointerVarType && ts.isPropertyAssignment(declaration)) {
                if (declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer))
                    propType = this.determineArrayType(<ts.ArrayLiteralExpression>declaration.initializer);
            }
            userStructInfo[prop.name] = { type: propType, order: declaration.pos };
        }
        return this.ensureNoTypeDuplicates(new StructType(userStructInfo));
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
        let type1_result = { type: this.ensureNoTypeDuplicates(type1), replaced: true };
        let type2_result = { type: this.ensureNoTypeDuplicates(type2), replaced: true };
        let noChanges = { type: this.ensureNoTypeDuplicates(type1), replaced: false };

        if (!type1 && type2)
            return type2_result;
        else if (type1 && !type2)
            return type1_result;
        else if (!type1 && !type2)
            return noChanges;

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
            let cap = Math.max(type2.capacity, type1.capacity);
            let isDynamicArray = type2.isDynamicArray || type1.isDynamicArray;
            let elementTypeMergeResult = this.mergeTypes(type1.elementType, type2.elementType);
            if (type1.capacity != cap || type2.capacity != cap
                || type1.isDynamicArray != isDynamicArray || type2.isDynamicArray != isDynamicArray
                || elementTypeMergeResult.replaced)
                return { type: this.ensureNoTypeDuplicates(new ArrayType(elementTypeMergeResult.type, cap, isDynamicArray)), replaced: true };

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
            let newProps = {};
            for (let p of props) {
                let result = this.mergeTypes(type1.properties[p], type2.properties[p]);
                let order = Math.max(type1.propertyDefs[p] ? type1.propertyDefs[p].order : 0, type2.propertyDefs[p] ? type2.propertyDefs[p].order : 0);
                newProps[p] = { type: result.type, order: order };
                if (result.replaced)
                    changed = true;
            }
            return changed ? { type: this.ensureNoTypeDuplicates(new StructType(newProps)), replaced: true } : noChanges;
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
        else if (type1 instanceof DictType && type2 instanceof StructType) {
            return type1_result;
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
            if (p == "length")
                continue;
            if (isNaN(+p))
                needPromoteToDictionary = true;
            if (this.mergeTypes(arrayType.elementType, structType.properties[p]).replaced)
                needPromoteToTuple = true;
        }
        if (needPromoteToDictionary && needPromoteToTuple)
            return { type: this.ensureNoTypeDuplicates(new DictType(UniversalVarType)), replaced: true };
        else if (needPromoteToDictionary)
            return { type: this.ensureNoTypeDuplicates(new DictType(arrayType.elementType)), replaced: true };
        else if (needPromoteToTuple)
            return { type: this.ensureNoTypeDuplicates(new ArrayType(UniversalVarType, arrayType.capacity, arrayType.isDynamicArray)), replaced: true };
        else
            return { type: arrayType, replaced: true };
    }

}