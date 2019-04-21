import * as ts from 'typescript';
import { CType, StringVarType, BooleanVarType, UniversalVarType, NumberVarType, PointerVarType, ArrayType, StructType, DictType, FuncType } from './ctypes';
import { TypeHelper } from './typehelper';

export interface MethodCallExpression extends ts.CallExpression {
    expression: ts.PropertyAccessExpression;
}
export interface FunctionArgInMethodCall extends ts.FunctionExpression {
    parent: MethodCallExpression;
}

export interface ForOfWithSimpleInitializer extends ts.ForOfStatement {
    initializer: ts.VariableDeclarationList;
}
export interface ForOfWithExpressionInitializer extends ts.ForOfStatement {
    initializer: ts.Identifier;
}

export interface DeleteExpression extends ts.DeleteExpression {
    expression: ts.PropertyAccessExpression | ts.ElementAccessExpression;
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
export function isFunction(n): n is ts.FunctionDeclaration | ts.FunctionExpression {
    return ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n);
}
export function isFunctionArgInMethodCall(n): n is FunctionArgInMethodCall {
    return ts.isFunctionExpression(n) && ts.isCallExpression(n.parent) && n.parent.arguments[0] == n && ts.isPropertyAccessExpression(n.parent.expression);
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
export function isUnaryExpression(n): n is ts.PrefixUnaryExpression {
    return ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n);
}
export const SyntaxKind_NaNKeyword = ts.SyntaxKind.Count + 1;
export function isNullOrUndefinedOrNaN(n): n is ts.Node {
    return n.kind === ts.SyntaxKind.NullKeyword || n.kind === ts.SyntaxKind.UndefinedKeyword || n.kind === SyntaxKind_NaNKeyword;
}
export function isNullOrUndefined(n): n is ts.Node {
    return n.kind === ts.SyntaxKind.NullKeyword || n.kind === ts.SyntaxKind.UndefinedKeyword;
}
export function isDeleteExpression(n): n is DeleteExpression {
    return ts.isDeleteExpression(n) && (ts.isPropertyAccessExpression(n.expression) || ts.isElementAccessExpression(n.expression));
}
export function isThisKeyword(n): n is ts.Node {
    return n.kind === ts.SyntaxKind.ThisKeyword;
}
export function isCompoundAssignment(n: ts.Node) {
    if (ts.isBinaryExpression(n))
        return n.operatorToken.kind >= ts.SyntaxKind.FirstCompoundAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastCompoundAssignment;
    else
        return n.kind >= ts.SyntaxKind.FirstCompoundAssignment && n.kind <= ts.SyntaxKind.LastCompoundAssignment;
}

export function isNumberOp(op: ts.SyntaxKind) {
    return [
        ts.SyntaxKind.MinusToken, ts.SyntaxKind.MinusEqualsToken,
        ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.AsteriskEqualsToken,
        ts.SyntaxKind.SlashToken, ts.SyntaxKind.SlashEqualsToken,
        ts.SyntaxKind.PercentToken, ts.SyntaxKind.PercentEqualsToken,
    ].indexOf(op) > -1;
}
export function isIntegerOp(op: ts.SyntaxKind) {
    return [
        ts.SyntaxKind.LessThanLessThanToken, ts.SyntaxKind.LessThanLessThanEqualsToken,
        ts.SyntaxKind.GreaterThanGreaterThanToken, ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
        ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
        ts.SyntaxKind.BarToken, ts.SyntaxKind.BarEqualsToken,
        ts.SyntaxKind.AmpersandToken, ts.SyntaxKind.AmpersandEqualsToken
    ].indexOf(op) > -1;
}
export function isRelationalOp(op: ts.SyntaxKind) {
    return [
        ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken,
        ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken
    ].indexOf(op) > -1;
}
export function isEqualityOp(op: ts.SyntaxKind) {
    return [
        ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, 
        ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ].indexOf(op) > -1;
}
export function isLogicOp(op: ts.SyntaxKind) {
    return [
        ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken
    ].indexOf(op) > -1;
}
export function isPlusOp(op: ts.SyntaxKind) {
    return op == ts.SyntaxKind.PlusToken || op == ts.SyntaxKind.PlusEqualsToken;
}

export function isStringLiteralAsIdentifier(n: ts.Node): n is ts.StringLiteral {
    return ts.isStringLiteral(n) && /^[A-Za-z_][A-Za-z_0-9]*$/.test(n.text);
}

export function isInBoolContext(n: ts.Node) {
    while (ts.isBinaryExpression(n.parent) && isLogicOp(n.parent.operatorToken.kind))
        n = n.parent;
    return ts.isPrefixUnaryExpression(n.parent) && n.parent.operator === ts.SyntaxKind.ExclamationToken
        || ts.isIfStatement(n.parent) && n.parent.expression === n
        || ts.isWhileStatement(n.parent) && n.parent.expression === n
        || ts.isDoStatement(n.parent) && n.parent.expression === n
        || ts.isForStatement(n.parent) && n.parent.condition === n;
}

export function isSimpleNode(n: ts.Node) {
    return ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isIdentifier(n);
}

export function isSideEffectExpression(n: ts.Node) {
    return isEqualsExpression(n) || isCompoundAssignment(n)
        || isUnaryExpression(n) && n.operator === ts.SyntaxKind.PlusPlusToken
        || isUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusMinusToken
        || ts.isCallExpression(n)
        || ts.isNewExpression(n);
}
export function operandsToNumber(leftType: CType, op: ts.SyntaxKind, rightType: CType) {
    return isNumberOp(op) || isIntegerOp(op)
        || op == ts.SyntaxKind.PlusToken && !toNumberCanBeNaN(leftType) && !toNumberCanBeNaN(rightType)
        || isRelationalOp(op) && (leftType !== StringVarType || rightType !== StringVarType);
}

export function getBinExprResultType(mergeTypes: TypeHelper["mergeTypes"], leftType: CType, op: ts.SyntaxKind, rightType: CType) {
    if (op === ts.SyntaxKind.EqualsToken)
        return rightType;
    if (isRelationalOp(op) || isEqualityOp(op) || op === ts.SyntaxKind.InKeyword || op === ts.SyntaxKind.InstanceOfKeyword)
        return BooleanVarType;
    if (leftType == null || rightType == null)
        return null;
    if (isLogicOp(op))
        return mergeTypes(leftType, rightType).type;
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

export function getUnaryExprResultType(op: ts.SyntaxKind, operandType: CType) {
    if (op === ts.SyntaxKind.ExclamationToken) {
        return BooleanVarType;
    } else if (op === ts.SyntaxKind.TildeToken) {
        return NumberVarType;
    } else {
        return toNumberCanBeNaN(operandType) ? UniversalVarType : NumberVarType;
    }
}

export function toNumberCanBeNaN(t: CType) {
    return t !== null && t !== PointerVarType && t !== NumberVarType && t !== BooleanVarType && !(t instanceof ArrayType && !t.isDynamicArray && t.capacity == 1 && !toNumberCanBeNaN(t.elementType));
}

export function toPrimitive(t: CType) {
    return t === null || t === PointerVarType ? t : t === NumberVarType || t === BooleanVarType ? NumberVarType : StringVarType;
}

export function findParentFunction(node: ts.Node): ts.FunctionDeclaration {
    let parentFunc = node;
    while (parentFunc && !isFunction(parentFunc))
        parentFunc = parentFunc.parent;
    return <ts.FunctionDeclaration>parentFunc;
}
export function findParentSourceFile(node: ts.Node): ts.SourceFile {
    let parent = node;
    while (!ts.isSourceFile(parent))
        parent = parent.parent;
    return parent;
}

export function getAllNodesUnder(node: ts.Node) {
    let i = 0;
    const nodes = [node];
    while (i < nodes.length)
        nodes.push.apply(nodes, nodes[i++].getChildren());
    return nodes;
}

export function isUnder(refNode, node) {
    let parent = node;
    while (parent && parent != refNode)
        parent = parent.parent;
    return parent;
}

export function hasType(refType, type) {
    return refType == type
        || refType instanceof StructType && Object.keys(refType.properties).some(k => hasType(refType.properties[k], type))
        || refType instanceof ArrayType && hasType(refType.elementType, type)
        || refType instanceof DictType && hasType(refType.elementType, type)
        || refType instanceof FuncType && hasType(refType.returnType, type)
        || refType instanceof FuncType && hasType(refType.instanceType, type)
        || refType instanceof FuncType && refType.parameterTypes.some(pt => hasType(pt, type))
}
