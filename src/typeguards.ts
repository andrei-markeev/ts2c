import * as ts from 'typescript';

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
export function isConvertToNumberExpression(n): n is ts.PrefixUnaryExpression {
    return ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.PlusToken;
}
export const SyntaxKind_NaNKeyword = ts.SyntaxKind.Count + 1;
export function isNullOrUndefinedOrNaN(n): n is ts.Node {
    return n.kind === ts.SyntaxKind.NullKeyword || n.kind === ts.SyntaxKind.UndefinedKeyword || n.kind === SyntaxKind_NaNKeyword;
}
export function isDeleteExpression(n): n is DeleteExpression {
    return ts.isDeleteExpression(n) && (ts.isPropertyAccessExpression(n.expression) || ts.isElementAccessExpression(n.expression));
}
export function isThisKeyword(n): n is ts.Node {
    return n.kind === ts.SyntaxKind.ThisKeyword;
}