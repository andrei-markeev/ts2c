import * as ts from 'typescript';
import { StandardCallHelper } from './standard';
import { isEqualsExpression, isConvertToNumberExpression, isNullOrUndefinedOrNaN, isFieldPropertyAccess, isFieldElementAccess, isMethodCall, isLiteral, isFunctionArgInMethodCall, isForOfWithSimpleInitializer, isForOfWithIdentifierInitializer, isDeleteExpression, isThisKeyword, isCompoundAssignment, isNumberOp, isIntegerOp } from './typeguards';

export type CType = string | StructType | ArrayType | DictType | FuncType;
export const UniversalVarType = "struct js_var";
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
        
        elementTypeText = elementTypeText.replace(/^struct ([a-z0-9_]+)_t \*$/, (all, g1) => g1).replace(/^struct js_var/, "js_var");

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
        else if (elementTypeText.indexOf('{var}') > -1)
            return elementTypeText + "[" + this.capacity + "]";
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
    public external: boolean;
    public forcedType: string;
    public getText() {
        return this.forcedType || 'struct ' + this.structName + ' *';
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
        if (this.elementType == UniversalVarType)
            return "struct dict_js_var_t *";
        else
            return "DICT(" + (typeof this.elementType === "string" ? this.elementType : this.elementType.getText()) + ")";
    }
    public getBodyText() {
        return "{" + getTypeBodyText(this.elementType) + "}";
    }
    constructor(public elementType: CType) { }
}

export class FuncType {
    public static getReturnType(typeHelper: TypeHelper, node: ts.Node): CType {
        const decl = typeHelper.getDeclaration(node);
        const type = typeHelper.getCType(decl);
        return type && type instanceof FuncType ? type.returnType : null;
    }
    public static getInstanceType(typeHelper: TypeHelper, node: ts.Node): CType {
        const decl = typeHelper.getDeclaration(node);
        const type = typeHelper.getCType(decl);
        return type && type instanceof FuncType ? type.instanceType : null
    }
    public getText() {
        return typeof(this.returnType) === "string" ? this.returnType : this.returnType.getText();
    }
    public getBodyText() {
        const paramTypes = [].concat(this.parameterTypes);
        if (this.instanceType)
            paramTypes.unshift(this.instanceType);
        return getTypeBodyText(this.returnType) + "(" + paramTypes.map(pt => pt ? getTypeBodyText(pt) : PointerVarType).join(", ") + ")";
    }
    constructor(public returnType: CType, public parameterTypes: CType[] = [], public instanceType: CType = null) { }
}

export const equalityOps = [
    ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, 
    ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
];
const relationalOps = [
    ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken,
    ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken
];
const logicalOps = [
    ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken
];

export function operandsToNumber(leftType: CType, op: ts.SyntaxKind, rightType: CType) {
    return isNumberOp(op) || isIntegerOp(op)
        || op == ts.SyntaxKind.PlusToken && !toNumberCanBeNaN(leftType) && !toNumberCanBeNaN(rightType)
        || equalityOps.concat(relationalOps).indexOf(op) > -1 && (leftType !== StringVarType || rightType !== StringVarType);
}

export function getBinExprResultType(leftType: CType, op: ts.SyntaxKind, rightType: CType) {
    if (logicalOps.indexOf(op) > -1 || op === ts.SyntaxKind.EqualsToken)
        return rightType;
    if (relationalOps.indexOf(op) > -1 || equalityOps.indexOf(op) > -1)
        return BooleanVarType;
    if (leftType == null || rightType == null)
        return null;
    if (isNumberOp(op) || isIntegerOp(op))
        return toNumberCanBeNaN(leftType) || toNumberCanBeNaN(rightType) ? UniversalVarType : NumberVarType;
    if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.PlusEqualsToken)
        return leftType === UniversalVarType || rightType === UniversalVarType ? UniversalVarType 
            : toPrimitive(leftType) === StringVarType || toPrimitive(rightType) === StringVarType ? StringVarType
            : toPrimitive(leftType) === NumberVarType && toPrimitive(rightType) == NumberVarType ? NumberVarType
            : null;

    console.log("WARNING: unexpected binary expression!");
    return null;
}

export function toNumberCanBeNaN(t) {
    return t !== null && t !== PointerVarType && t !== NumberVarType && t !== BooleanVarType && !(t instanceof ArrayType && !t.isDynamicArray && t.capacity == 1 && !toNumberCanBeNaN(t.elementType));
}

export function toPrimitive(t) {
    return t === null || t === PointerVarType ? t : t === NumberVarType || t === BooleanVarType ? NumberVarType : StringVarType;
}

export function findParentFunction(node: ts.Node): ts.FunctionDeclaration {
    let parentFunc = node;
    while (parentFunc && !ts.isFunctionDeclaration(parentFunc))
        parentFunc = parentFunc.parent;
    return <ts.FunctionDeclaration>parentFunc;
}
export function findParentSourceFile(node: ts.Node): ts.SourceFile {
    let parent = node;
    while (!ts.isSourceFile(parent))
        parent = parent.parent;
    return parent;
}

type NodeFunc<T extends ts.Node> = { (n: T): ts.Node };
type NodeResolver<T extends ts.Node> = { getNode?: NodeFunc<T>, getType?: { (n: T): CType } };
type Equality<T extends ts.Node> = [{ (n): n is T }, NodeFunc<T>, NodeResolver<T>];

export class TypeHelper {

    private arrayLiteralsTypes: { [litArrayPos: number]: CType } = {};
    private objectLiteralsTypes: { [litObjectPos: number]: CType } = {};
    private typeOfNodeDict: { [id: string]: { node: ts.Node, type: CType } } = {};

    constructor(private typeChecker: ts.TypeChecker, private allNodes: ts.Node[]) { }

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

        if (node.kind != ts.SyntaxKind.ImportClause && node.pos != -1) {
            let tsType = this.typeChecker.getTypeAtLocation(node);
            let type = tsType && this.convertType(tsType, node);
            if (type)
                return type;
        }

        return null;
    }

    /** Get textual representation of type of the parameter for inserting into the C code */
    public getTypeString(source) {

        let cType = source;
        if (source && source.flags != null && source.intrinsicName != null) // ts.Type
            cType = this.convertType(source)
        else if (source && source.flags != null && source.callSignatures != null && source.constructSignatures != null) // ts.Type
            cType = this.convertType(source)
        else if (source && source.kind != null && source.flags != null) // ts.Node
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
            return "/* Cannot determine variable type from source " + (source && source.getText ? source.getText() : JSON.stringify(source)) + "*/";
    }

    /** Postprocess TypeScript AST for better type inference and map TS types to C types */
    /** Creates typeOfNodeDict that is later used in getCType */
    public inferTypes() {

        const type = <T extends ts.Node>(t: { (n: T): CType } | string): NodeResolver<T> => ({ getType: typeof (t) === "string" ? _ => t : t });
        const struct = (prop: string, pos: number, elemType: CType = PointerVarType): StructType => new StructType({ [prop]: { type: elemType, order: pos } });

        let typeEqualities: Equality<any>[] = [];

        const addEquality = <T extends ts.Node>(typeGuard: { (n): n is T }, node1: NodeFunc<T>, node2: NodeFunc<T> | NodeResolver<T>) => {
            if (typeof node2 == "function")
                typeEqualities.push([typeGuard, node1, { getNode: node2 }]);
            else
                typeEqualities.push([typeGuard, node1, node2]);
        };

        // expressions
        addEquality(ts.isIdentifier, n => n, n => this.getDeclaration(n));
        addEquality(isEqualsExpression, n => n.left, n => n.right);
        addEquality(ts.isConditionalExpression, n => n.whenTrue, n => n.whenFalse);
        addEquality(ts.isConditionalExpression, n => n, n => n.whenTrue);
        addEquality(isConvertToNumberExpression, n => n, type(n => this.getCType(n.operand) == NumberVarType ? NumberVarType : UniversalVarType));
        addEquality(ts.isBinaryExpression, n => n, type(n => getBinExprResultType(this.getCType(n.left), n.operatorToken.kind, this.getCType(n.right))));
        addEquality(ts.isBinaryExpression, n => n.left, type(n => {
            const resultType = this.getCType(n);
            const operandType = this.getCType(n.left);
            if (resultType === UniversalVarType) {
                return isCompoundAssignment(n.operatorToken) ? UniversalVarType
                    : operandType instanceof ArrayType ? new ArrayType(UniversalVarType, 0, true)
                    : operandType instanceof StructType || operandType instanceof DictType ? new DictType(UniversalVarType)
                    : null;
            } else
                return null;
        }));
        addEquality(ts.isBinaryExpression, n => n.right, type(n => {
            const resultType = this.getCType(n);
            const operandType = this.getCType(n.right);
            if (resultType === UniversalVarType) {
                return operandType instanceof ArrayType ? new ArrayType(UniversalVarType, 0, true)
                    : operandType instanceof StructType || operandType instanceof DictType ? new DictType(UniversalVarType)
                    : null;
            } else
                return null;
        }));
        addEquality(isNullOrUndefinedOrNaN, n => n, type(UniversalVarType));
        addEquality(ts.isParenthesizedExpression, n => n, n => n.expression);
        addEquality(ts.isVoidExpression, n => n, type(UniversalVarType));
        addEquality(ts.isVoidExpression, n => n.expression, type(PointerVarType));
        addEquality(ts.isTypeOfExpression, n => n, type(StringVarType));
        addEquality(isDeleteExpression, n => n, type(BooleanVarType));
        addEquality(isDeleteExpression, n => n.expression.expression, type(n => new DictType(UniversalVarType)));
    
        // fields
        addEquality(ts.isPropertyAssignment, n => n, n => n.initializer);
        addEquality(ts.isPropertyAssignment, n => n.parent, type(n => {
            const propName = (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && n.name.text;
            return struct(propName, n.pos, this.getCType(n) || PointerVarType)
        }));
        addEquality(ts.isPropertyAssignment, n => n, type(n => {
            const propName = (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && n.name.text;
            const type = this.getCType(n.parent);
            return type instanceof StructType ? type.properties[propName] : null;
        }));
        addEquality(isFieldPropertyAccess, n => n.expression, type(n => struct(n.name.getText(), n.pos, this.getCType(n) || PointerVarType)));
        addEquality(isFieldPropertyAccess, n => n, type(n => {
            const type = this.getCType(n.expression);
            return type instanceof StructType ? type.properties[n.name.getText()]
                : type instanceof ArrayType && n.name.getText() == "length" ? NumberVarType
                : type === StringVarType && n.name.getText() == "length" ? NumberVarType
                : type instanceof ArrayType || type instanceof DictType ? type.elementType
                : type === UniversalVarType && n.name.getText() == "length" ? NumberVarType
                : type === UniversalVarType ? UniversalVarType
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
                : ts.isStringLiteral(n.argumentExpression) && type instanceof ArrayType && n.argumentExpression.getText().slice(1, -1) == "length" ? NumberVarType
                : ts.isStringLiteral(n.argumentExpression) && type === StringVarType && n.argumentExpression.getText().slice(1, -1) == "length" ? NumberVarType
                : ts.isStringLiteral(n.argumentExpression) && type === UniversalVarType && n.argumentExpression.getText().slice(1, -1) == "length" ? NumberVarType
                : type instanceof ArrayType || type instanceof DictType ? type.elementType
                : type === UniversalVarType ? UniversalVarType
                : null
        }));
        for (let i = 0; i < 10; i++) {
            addEquality(ts.isArrayLiteralExpression, n => n, type(n => {
                const elemType = this.getCType(n.elements[i]);
                return elemType ? new ArrayType(elemType, 0, false) : null
            }));
            addEquality(ts.isArrayLiteralExpression, n => n.elements[i], type(n => {
                const arrType = this.getCType(n);
                return arrType && arrType instanceof ArrayType ? arrType.elementType
                    : arrType === UniversalVarType ? UniversalVarType
                    : null
            }));
        }

        // calls
        addEquality(ts.isCallExpression, n => n.expression, n => this.getDeclaration(n));
        addEquality(ts.isCallExpression, n => n, type(n => FuncType.getReturnType(this, n.expression)));
        addEquality(ts.isCallExpression, n => n.expression, type(n => this.getCType(n) ? new FuncType(this.getCType(n)) : null));
        for (let i = 0; i < 10; i++)
            addEquality(ts.isCallExpression, n => {
                const func = <ts.FunctionDeclaration>this.getDeclaration(n.expression);
                return func ? func.parameters[i] : null
            }, type(n => this.getCType(n.arguments[i])));
        addEquality(ts.isParameter, n => n, n => n.name);
        addEquality(ts.isParameter, n => n, n => n.initializer);

        addEquality(ts.isNewExpression, n => n, type(n => FuncType.getInstanceType(this, n.expression)));
        for (let i = 0; i < 10; i++)
            addEquality(ts.isNewExpression, n => n.arguments[i], n => {
                const func = <ts.FunctionDeclaration>this.getDeclaration(n.expression);
                return func ? func.parameters[i] : null
            });
        addEquality(isThisKeyword, n => findParentFunction(n), type(n => new FuncType(VoidType, [], this.getCType(n))));
        addEquality(isThisKeyword, n => n, type(n => FuncType.getInstanceType(this, findParentFunction(n))));
    
        addEquality(isMethodCall, n => n.expression.expression, type(n => StandardCallHelper.getObjectType(this, n)));
        addEquality(ts.isCallExpression, n => n, type(n => StandardCallHelper.getReturnType(this, n)));
        for (let i = 0; i < 10; i++)
            addEquality(ts.isCallExpression, n => n.arguments[i], type(n => isLiteral(n.arguments[i]) ? null : StandardCallHelper.getArgumentTypes(this, n)[i]));
            
        // crutch for callback argument type in foreach
        addEquality(isFunctionArgInMethodCall, n => n.parameters[0], type(n => {
            const objType = this.getCType(n.parent.expression.expression);
            return objType instanceof ArrayType && n.parent.expression.name.text == "forEach" ? objType.elementType : null;
        }));

        // statements
        addEquality(ts.isVariableDeclaration, n => n, n => n.initializer);
        addEquality(ts.isFunctionDeclaration, n => n, type(n => new FuncType(VoidType, n.parameters.map(p => this.getCType(p)))));
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
        addEquality(ts.isReturnStatement, n => n.expression, type(n => FuncType.getReturnType(this, findParentFunction(n))));
        addEquality(ts.isReturnStatement, n => findParentFunction(n), type(n => this.getCType(n.expression) ? new FuncType(this.getCType(n.expression)) : null));
        addEquality(ts.isCaseClause, n => n.expression, n => n.parent.parent.expression);
        addEquality(ts.isCatchClause, n => n.variableDeclaration, type(StringVarType));

        this.resolveTypes(typeEqualities);
    }

    private resolveTypes(typeEqualities: Equality<any>[]) {
        this.allNodes.forEach(n => this.setNodeType(n, this.getCType(n)))

        let equalities: [ts.Node, Equality<any>][] = [];
        typeEqualities.forEach(teq =>
            this.allNodes.forEach(node => { if (teq[0].bind(this)(node)) equalities.push([node, teq]); })
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
                    if (node2 && type != type2)
                        changed = true;
                    this.setNodeType(node1, type);
                    if (node2)
                        this.setNodeType(node2, type);
                }
            }
        } while (changed);

        for (let k in this.typeOfNodeDict) {
            const type = this.typeOfNodeDict[k].type;
            if (type instanceof ArrayType && !type.isDynamicArray && type.capacity == 0)
                type.isDynamicArray = true;
        }

        /*
        this.allNodes
            .filter(n => !ts.isToken(n) && !ts.isBlock(n) && n.kind != ts.SyntaxKind.SyntaxList)
            .forEach(n => console.log(n.getText(), "|", ts.SyntaxKind[n.kind], "|", JSON.stringify(this.getCType(n))));
        
        this.allNodes
            .filter(n => ts.isIdentifier(n) && n.getText() == "string1")
            .forEach(n => console.log(
                n.getText(),
                "(" + n.parent.getText() + "/" + ts.SyntaxKind[n.parent.kind] + ")",
                "decl.", getDeclaration(this.typeChecker, n).getText() + "/" + ts.SyntaxKind[getDeclaration(this.typeChecker, n).kind],
                "|", ts.SyntaxKind[n.kind],
                "|", JSON.stringify(this.getCType(n))
            ));
        */

    }

    private static syntheticNodesCounter = 0;
    /** Mostly used inside inferTypes */
    public registerSyntheticNode(n, t) {
        if (!n || !(n.flags & ts.NodeFlags.Synthesized))
            return false;
        
        n.end = TypeHelper.syntheticNodesCounter++;
        this.setNodeType(n, t);
    }

    private setNodeType(n, t) {
        if (n && t)
            this.typeOfNodeDict[n.pos + "_" + n.end] = { node: n, type: t };
    }

    public getDeclaration(n: ts.Node) {
        let s = this.typeChecker.getSymbolAtLocation(n);
        return s && <ts.NamedDeclaration>s.valueDeclaration;
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
    private convertType(tsType: ts.Type, node?: ts.Node): CType {
        if (!tsType || tsType.flags == ts.TypeFlags.Void)
            return VoidType;

        if (tsType.flags == ts.TypeFlags.String || tsType.flags == ts.TypeFlags.StringLiteral)
            return StringVarType;
        if (tsType.flags == ts.TypeFlags.Number || tsType.flags == ts.TypeFlags.NumberLiteral)
            return NumberVarType;
        if (tsType.flags == ts.TypeFlags.Boolean || tsType.flags == (ts.TypeFlags.Boolean + ts.TypeFlags.Union))
            return BooleanVarType;
        if (tsType.flags & ts.TypeFlags.Object && tsType.getProperties().length > 0) {
            const structType = this.generateStructure(tsType);
            const baseType = this.typeChecker.getBaseTypeOfLiteralType(tsType);
            const cTypeTag = baseType && baseType.symbol && baseType.symbol.getJsDocTags().filter(t => t.name == "ctype")[0];
            structType.forcedType = cTypeTag && cTypeTag.text.trim();
            structType.external = baseType && baseType.symbol && findParentSourceFile(baseType.symbol.declarations[0]).isDeclarationFile;
            return structType;
        }

        return null;
    }

    private generateStructure(tsType: ts.Type): StructType {
        let userStructInfo = {};
        for (let prop of tsType.getProperties()) {
            if (prop.name == "prototype")
                continue;
            let declaration = <ts.NamedDeclaration>prop.valueDeclaration;
            let propTsType = this.typeChecker.getTypeOfSymbolAtLocation(prop, declaration);
            let propType = this.convertType(propTsType, <ts.Identifier>declaration.name) || PointerVarType;
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
            elementType = this.convertType(this.typeChecker.getTypeAtLocation(arrLiteral.elements[0])) || PointerVarType;

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

        else if (type1 === VoidType)
            return type2_result;
        else if (type2 === VoidType)
            return type1_result;

        else if (type1 === PointerVarType)
            return type2_result;
        else if (type2 === PointerVarType)
            return type1_result;

        else if (type1 === UniversalVarType)
            return type1_result;
        else if (type2 === UniversalVarType)
            return type2_result;

        else if (type1 === StringVarType && type2 instanceof StructType) {
            if (Object.keys(type2.properties).length == 1 && (type2.properties["length"] == PointerVarType || type2.properties["length"] == NumberVarType))
                return type1_result;
        }
        else if (type1 instanceof StructType && type2 === StringVarType) {
            if (Object.keys(type1.properties).length == 1 && (type1.properties["length"] == PointerVarType || type1.properties["length"] == NumberVarType))
                return type2_result;
        }
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
        else if (type1 instanceof DictType && type2 instanceof StructType) {
            return this.mergeDictAndStruct(type1, type2);
        }
        else if (type1 instanceof StructType && type2 instanceof DictType) {
            return this.mergeDictAndStruct(type2, type1)
        }
        else if (type1 instanceof DictType && type2 instanceof DictType) {
            const { type: elemType, replaced } = this.mergeTypes(type1.elementType, type2.elementType);
            if (replaced)
                return { type: this.ensureNoTypeDuplicates(new DictType(elemType)), replaced: true };
            else
                return noChanges;
        }
        else if (type1 instanceof FuncType && type2 instanceof FuncType) {
            const { type: returnType, replaced: returnTypeReplaced } = this.mergeTypes(type1.returnType, type2.returnType);
            const { type: instanceType, replaced: instanceTypeReplaced } = this.mergeTypes(type1.instanceType, type2.instanceType);
            const paramCount = Math.max(type1.parameterTypes.length, type2.parameterTypes.length);
            let paramTypesReplaced = type1.parameterTypes.length !== type2.parameterTypes.length;
            let paramTypes = [];
            for (let i = 0; i < paramCount; i++) {
                const { type: pType, replaced: pTypeReplaced } = this.mergeTypes(type1.parameterTypes[i], type2.parameterTypes[i]);
                paramTypes.push(pType)
                if (pTypeReplaced)
                    paramTypesReplaced = true;
            }
            
            if (returnTypeReplaced || instanceTypeReplaced || paramTypesReplaced)
                return { type: this.ensureNoTypeDuplicates(new FuncType(returnType, paramTypes, instanceType)), replaced: true };
            else
                return noChanges;
        }
        else
            return { type: UniversalVarType, replaced: true };
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

    private mergeDictAndStruct(dictType: DictType, structType: StructType) {
        let elementType = dictType.elementType;
        for (let k in structType.properties)
            ({ type: elementType } = this.mergeTypes(elementType, structType.properties[k]));
        return { type: this.ensureNoTypeDuplicates(new DictType(elementType)), replaced: true };
    }

}