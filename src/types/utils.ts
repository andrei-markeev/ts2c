import * as kataw from 'kataw';
import { CType, StringVarType, BooleanVarType, UniversalVarType, NumberVarType, PointerVarType, ArrayType, StructType, DictType, FuncType, VoidType } from './ctypes';
import { TypeMerger } from './merge';

export interface FieldAssignmentExpression extends kataw.BinaryExpression {
    left: kataw.MemberAccessExpression | kataw.IndexExpression;
}
export interface MethodCallExpression extends kataw.CallExpression {
    expression: kataw.IndexExpression;
}
export interface FunctionArgInMethodCall extends kataw.FunctionExpression {
    parent: MethodCallExpression;
}
export interface PropertyDefinitionList extends kataw.PropertyDefinitionList {
    parent: kataw.ObjectLiteral;
}
export interface PropertyDefinition extends kataw.PropertyDefinition {
    parent: PropertyDefinitionList;
}

export interface ForOfWithSimpleInitializer extends kataw.ForOfStatement {
    initializer: kataw.ForBinding;
}
export interface ForInWithSimpleInitializer extends kataw.ForInStatement {
    initializer: kataw.ForBinding;
}
export interface ForOfWithExpressionInitializer extends kataw.ForOfStatement {
    initializer: kataw.Identifier;
}
export interface ForInWithExpressionInitializer extends kataw.ForInStatement {
    initializer: kataw.Identifier;
}

export interface DeleteExpression extends kataw.UnaryExpression {
    operand: kataw.IndexExpression | kataw.MemberAccessExpression;
}

export function isNode(n: any): n is kataw.SyntaxNode {
    return n && n.kind !== undefined && n.flags !== undefined && n.start !== undefined && n.end !== undefined;
}
export function isStringLiteral(n: kataw.SyntaxNode): n is kataw.StringLiteral {
    return n.kind === kataw.SyntaxKind.StringLiteral;
}
export function isObjectLiteral(n: kataw.SyntaxNode): n is kataw.ObjectLiteral {
    return n.kind === kataw.SyntaxKind.ObjectLiteral;
}
export function isArrayLiteral(n: kataw.SyntaxNode): n is kataw.ArrayLiteral {
    return n.kind === kataw.SyntaxKind.ArrayLiteral;
}
export function isNumericLiteral(n: kataw.SyntaxNode): n is kataw.NumericLiteral {
    return n.kind === kataw.SyntaxKind.NumericLiteral;
}
export function isBooleanLiteral(n: kataw.SyntaxNode): n is kataw.SyntaxToken<kataw.SyntaxKind.TrueKeyword | kataw.SyntaxKind.FalseKeyword> {
    return n.kind == kataw.SyntaxKind.TrueKeyword || n.kind == kataw.SyntaxKind.FalseKeyword;
}
export function isLiteral(n: kataw.SyntaxNode): n is kataw.NumericLiteral | kataw.StringLiteral | kataw.RegularExpressionLiteral | kataw.SyntaxToken<kataw.SyntaxKind.TrueKeyword | kataw.SyntaxKind.FalseKeyword> {
    return isNumericLiteral(n) || isStringLiteral(n) || n.kind === kataw.SyntaxKind.RegularExpressionLiteral || n.kind == kataw.SyntaxKind.TrueKeyword || n.kind == kataw.SyntaxKind.FalseKeyword;
}

export function isBinaryExpression(n: kataw.SyntaxNode): n is kataw.BinaryExpression | kataw.AssignmentExpression {
    return n && n.kind == kataw.SyntaxKind.BinaryExpression || n.kind === kataw.SyntaxKind.AssignmentExpression;
}
export function isEqualsExpression(n: kataw.SyntaxNode): n is kataw.BinaryExpression {
    return n && isBinaryExpression(n) && n.operatorToken.kind == kataw.SyntaxKind.Assign;
}
export function isFieldAssignment(n: kataw.SyntaxNode): n is FieldAssignmentExpression {
    return n && isBinaryExpression(n) && n.operatorToken.kind == kataw.SyntaxKind.Assign && (isFieldElementAccess(n.left) || isFieldPropertyAccess(n.left));
}

export function isCall(n: kataw.SyntaxNode): n is kataw.CallExpression {
    return n && n.kind === kataw.SyntaxKind.CallExpression;
}
export function isMethodCall(n): n is MethodCallExpression {
    return isCall(n) && isFieldPropertyAccess(n.expression);
}
export function isFunction(n: kataw.SyntaxNode): n is kataw.FunctionDeclaration | kataw.FunctionExpression {
    return n.kind === kataw.SyntaxKind.FunctionDeclaration || n.kind === kataw.SyntaxKind.FunctionExpression;
}
export function isFunctionDeclaration(n: kataw.SyntaxNode): n is kataw.FunctionDeclaration {
    return n.kind === kataw.SyntaxKind.FunctionDeclaration;
}
export function isFunctionExpression(n: kataw.SyntaxNode): n is kataw.FunctionExpression {
    return n.kind === kataw.SyntaxKind.FunctionExpression;
}
export function isParameter(n: kataw.SyntaxNode): n is kataw.BindingElement {
    return n.kind === kataw.SyntaxKind.BindingElement;
}
export function isReturnStatement(n: kataw.SyntaxNode): n is kataw.ReturnStatement {
    return n.kind === kataw.SyntaxKind.ReturnStatement;
}
export function isVariableDeclaration(n: kataw.SyntaxNode): n is kataw.VariableDeclaration | kataw.LexicalBinding {
    return n.kind === kataw.SyntaxKind.VariableDeclaration || n.kind === kataw.SyntaxKind.LexicalBinding;
}
export function isForBinding(n: kataw.SyntaxNode): n is kataw.ForBinding {
    return n.kind === kataw.SyntaxKind.ForBinding;
}
export function isVariableDeclarationList(n: kataw.SyntaxNode): n is kataw.VariableDeclarationList {
    return n.kind === kataw.SyntaxKind.VariableDeclarationList;
}
export function isPropertyDefinition(n: kataw.SyntaxNode): n is PropertyDefinition {
    return n.kind === kataw.SyntaxKind.PropertyDefinition;
}
export function isFunctionArgInMethodCall(n): n is FunctionArgInMethodCall {
    return isFunctionExpression(n) && isCall(n.parent) && n.parent.argumentList.elements[0] == n && isFieldPropertyAccess(n.parent.expression);
}
export function isFieldElementAccessNotMethodCall(n: kataw.SyntaxNode): n is kataw.MemberAccessExpression {
    return n.kind === kataw.SyntaxKind.MemberAccessExpression && (!isCall(n.parent) || n.parent.expression !== n);
}
export function isFieldPropertyAccessNotMethodCall(n: kataw.SyntaxNode): n is kataw.IndexExpression {
    return n.kind === kataw.SyntaxKind.IndexExpression && (!isCall(n.parent) || n.parent.expression !== n);
}
export function isFieldElementAccess(n: kataw.SyntaxNode): n is kataw.MemberAccessExpression {
    return n.kind === kataw.SyntaxKind.MemberAccessExpression;
}
export function isFieldPropertyAccess(n: kataw.SyntaxNode): n is kataw.IndexExpression {
    return n.kind === kataw.SyntaxKind.IndexExpression;
}
export function isFieldAccess(n: kataw.SyntaxNode): n is kataw.MemberAccessExpression | kataw.IndexExpression {
    return n.kind === kataw.SyntaxKind.MemberAccessExpression || n.kind === kataw.SyntaxKind.IndexExpression;
}
export function isWithStatement(n: kataw.SyntaxNode): n is kataw.WithStatement {
    return n.kind === kataw.SyntaxKind.WithStatement;
}
export function isForOfWithSimpleInitializer(n): n is ForOfWithSimpleInitializer {
    return isForOfStatement(n) && isForBinding(n.initializer) && n.initializer.declarationList.declarations.length == 1;
}
export function isForOfWithIdentifierInitializer(n): n is ForOfWithExpressionInitializer {
    return isForOfStatement(n) && kataw.isIdentifier(n.initializer);
}
export function isForInWithSimpleInitializer(n): n is ForInWithSimpleInitializer {
    return isForInStatement(n) && isForBinding(n.initializer) && n.initializer.declarationList.declarations.length == 1;
}
export function isForInWithIdentifierInitializer(n): n is ForInWithExpressionInitializer {
    return isForInStatement(n) && kataw.isIdentifier(n.initializer);
}
export function isIfStatement(n: kataw.SyntaxNode): n is kataw.IfStatement {
    return n.kind === kataw.SyntaxKind.IfStatement;
}
export function isWhileStatement(n: kataw.SyntaxNode): n is kataw.WhileStatement {
    return n.kind === kataw.SyntaxKind.WhileStatement;
}
export function isDoWhileStatement(n: kataw.SyntaxNode): n is kataw.DoWhileStatement {
    return n.kind === kataw.SyntaxKind.DoWhileStatement;
}
export function isForStatement(n: kataw.SyntaxNode): n is kataw.ForStatement {
    return n.kind === kataw.SyntaxKind.ForStatement;
}
export function isForOfStatement(n: kataw.SyntaxNode): n is kataw.ForOfStatement {
    return n.kind === kataw.SyntaxKind.ForOfStatement;
}
export function isForInStatement(n: kataw.SyntaxNode): n is kataw.ForInStatement {
    return n.kind === kataw.SyntaxKind.ForInStatement;
}
export function isCaseClause(n: kataw.SyntaxNode): n is kataw.CaseClause {
    return n.kind === kataw.SyntaxKind.CaseClause;
}
export function isCatchClause(n: kataw.SyntaxNode): n is kataw.CatchClause {
    return n.kind === kataw.SyntaxKind.Catch;
}
export function isBreakStatement(n: kataw.SyntaxNode): n is kataw.BreakStatement {
    return n.kind === kataw.SyntaxKind.BreakStatement;
}
export function isContinueStatement(n: kataw.SyntaxNode): n is kataw.ContinueStatement {
    return n.kind === kataw.SyntaxKind.ContinueStatement;
}
export function isUnaryExpression(n: kataw.SyntaxNode): n is kataw.UnaryExpression {
    return n.kind === kataw.SyntaxKind.UnaryExpression;
}
export function isParenthesizedExpression(n: kataw.SyntaxNode): n is kataw.ParenthesizedExpression {
    return n.kind === kataw.SyntaxKind.ParenthesizedExpression;
}
export function isConditionalExpression(n: kataw.SyntaxNode): n is kataw.ConditionalExpression {
    return n.kind === kataw.SyntaxKind.ConditionalExpression;
}
export const SyntaxKind_NaNIdentifier = 16636 as kataw.TokenSyntaxKind;
export function isNullOrUndefinedOrNaN(n: kataw.SyntaxNode): n is kataw.SyntaxNode {
    return n.kind === kataw.SyntaxKind.NullKeyword || n.kind === kataw.SyntaxKind.UndefinedKeyword || n.kind === SyntaxKind_NaNIdentifier;
}
export function isNullOrUndefined(n: kataw.SyntaxNode): n is kataw.SyntaxNode {
    return n.kind === kataw.SyntaxKind.NullKeyword || n.kind === kataw.SyntaxKind.UndefinedKeyword;
}
export function isDeleteExpression(n): n is DeleteExpression {
    return isUnaryExpression(n) && n.operandToken.kind === kataw.SyntaxKind.DeleteKeyword && (isFieldPropertyAccess(n.operand) || isFieldElementAccess(n.operand));
}
export function isVoidExpression(n: kataw.SyntaxNode): n is kataw.UnaryExpression {
    return isUnaryExpression(n) && n.operandToken.kind === kataw.SyntaxKind.VoidKeyword;
}
export function isTypeofExpression(n: kataw.SyntaxNode): n is kataw.UnaryExpression {
    return isUnaryExpression(n) && n.operandToken.kind === kataw.SyntaxKind.TypeofKeyword;
}
export function isThisKeyword(n: kataw.SyntaxNode): n is kataw.SyntaxToken<kataw.SyntaxKind.ThisKeyword> {
    return n.kind === kataw.SyntaxKind.ThisKeyword;
}
export function isCompoundAssignment(n: kataw.SyntaxNode) {
    if (isBinaryExpression(n))
        return kataw.isAssignOp(n.operatorToken);
    else
        return kataw.isAssignOp(n);
}

export function isNumberOp(op: kataw.SyntaxKind) {
    return op === kataw.SyntaxKind.Subtract || op === kataw.SyntaxKind.SubtractAssign
        || op === kataw.SyntaxKind.Multiply || op === kataw.SyntaxKind.MultiplyAssign
        || op === kataw.SyntaxKind.Divide || op === kataw.SyntaxKind.DivideAssign
        || op === kataw.SyntaxKind.Modulo || op === kataw.SyntaxKind.ModuloAssign;
}
export function isIntegerOp(op: kataw.SyntaxKind) {
    return op === kataw.SyntaxKind.ShiftLeft || op === kataw.SyntaxKind.ShiftLeftAssign
        || op === kataw.SyntaxKind.ShiftRight || op === kataw.SyntaxKind.ShiftRightAssign
        || op === kataw.SyntaxKind.LogicalShiftRight || op === kataw.SyntaxKind.LogicalShiftRightAssign
        || op === kataw.SyntaxKind.BitwiseOr || op === kataw.SyntaxKind.BitwiseOrAssign
        || op === kataw.SyntaxKind.BitwiseAnd || op === kataw.SyntaxKind.BitwiseAndAssign;
}
export function isRelationalOp(op: kataw.SyntaxKind) {
    return op === kataw.SyntaxKind.LessThan || op === kataw.SyntaxKind.LessThanOrEqual
        || op === kataw.SyntaxKind.GreaterThan || op === kataw.SyntaxKind.GreaterThanOrEqual
}
export function isEqualityOp(op: kataw.SyntaxKind) {
    return op === kataw.SyntaxKind.LooseEqual || op === kataw.SyntaxKind.StrictEqual
        || op === kataw.SyntaxKind.LooseNotEqual || op ===kataw.SyntaxKind.StrictNotEqual
}
export function isLogicOp(op: kataw.SyntaxKind) {
    return op === kataw.SyntaxKind.LogicalOr || op === kataw.SyntaxKind.LogicalAnd;
}
export function isPlusOp(op: kataw.SyntaxKind) {
    return op == kataw.SyntaxKind.Add || op == kataw.SyntaxKind.AddAssign;
}

export function isStringLiteralAsIdentifier(n: kataw.SyntaxNode): n is kataw.StringLiteral {
    return isStringLiteral(n) && /^[A-Za-z_][A-Za-z_0-9]*$/.test(n.text);
}

export function isInBoolContext(n: kataw.SyntaxNode) {
    while (isBinaryExpression(n.parent) && isLogicOp(n.parent.operatorToken.kind))
        n = n.parent;
    return isUnaryExpression(n.parent) && n.parent.operandToken.kind === kataw.SyntaxKind.Negate
        || isIfStatement(n.parent) && n.parent.expression === n
        || isWhileStatement(n.parent) && n.parent.expression === n
        || isDoWhileStatement(n.parent) && n.parent.expression === n
        || isForStatement(n.parent) && n.parent.condition === n;
}

export function isSimpleNode(n: kataw.SyntaxNode) {
    return isStringLiteral(n) || isNumericLiteral(n) || kataw.isIdentifier(n);
}

export function isSideEffectExpression(n: kataw.SyntaxNode) {
    return isEqualsExpression(n) || isCompoundAssignment(n)
        || isUnaryExpression(n) && n.operandToken.kind === kataw.SyntaxKind.Increment
        || isUnaryExpression(n) && n.operandToken.kind === kataw.SyntaxKind.Decrement
        || isCall(n)
        || isNewExpression(n);
}
export function isNewExpression(n: kataw.SyntaxNode): n is kataw.NewExpression {
    return n.kind === kataw.SyntaxKind.NewExpression;
}
export function operandsToNumber(leftType: CType, op: kataw.SyntaxKind, rightType: CType) {
    return isNumberOp(op) || isIntegerOp(op)
        || op == kataw.SyntaxKind.Add && !toNumberCanBeNaN(leftType) && !toNumberCanBeNaN(rightType)
        || isRelationalOp(op) && (leftType !== StringVarType || rightType !== StringVarType);
}

export function getBinExprResultType(mergeTypes: TypeMerger["mergeTypes"], leftType: CType, op: kataw.SyntaxKind, rightType: CType) {
    if (op === kataw.SyntaxKind.Assign)
        return rightType;
    if (isRelationalOp(op) || isEqualityOp(op) || op === kataw.SyntaxKind.InKeyword || op === kataw.SyntaxKind.InstanceofKeyword)
        return BooleanVarType;
    if (leftType == null || rightType == null)
        return null;
    if (isLogicOp(op))
        return mergeTypes(leftType, rightType).type;
    if (isNumberOp(op) || isIntegerOp(op))
        return toNumberCanBeNaN(leftType) || toNumberCanBeNaN(rightType) ? UniversalVarType : NumberVarType;
    if (op === kataw.SyntaxKind.Add || op === kataw.SyntaxKind.AddAssign)
        return leftType === UniversalVarType || rightType === UniversalVarType ? UniversalVarType 
            : toPrimitive(leftType) === StringVarType || toPrimitive(rightType) === StringVarType ? StringVarType
            : toPrimitive(leftType) === NumberVarType && toPrimitive(rightType) == NumberVarType ? NumberVarType
            : null;

    console.log("WARNING: unexpected binary expression!");
    return null;
}

export function getUnaryExprResultType(op: kataw.SyntaxKind, operandType: CType) {
    if (op === kataw.SyntaxKind.Negate) { // exclam
        return BooleanVarType;
    } else if (op === kataw.SyntaxKind.Complement) { // tilde
        return NumberVarType;
    } else if (op === kataw.SyntaxKind.DeleteKeyword) {
        return BooleanVarType;
    } else if (op === kataw.SyntaxKind.VoidKeyword) {
        return UniversalVarType;
    } else if (op === kataw.SyntaxKind.TypeofKeyword) {
        return StringVarType;
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

export function findParentFunction(node: kataw.SyntaxNode): kataw.FunctionDeclaration | kataw.FunctionExpression {
    let parentFunc = node;
    while (parentFunc && !isFunction(parentFunc))
        parentFunc = parentFunc.parent;
    return <kataw.FunctionDeclaration | kataw.FunctionExpression>parentFunc;
}
export function findParentSourceFile(node: kataw.SyntaxNode): kataw.RootNode {
    let parent = node;
    while (parent.kind !== kataw.SyntaxKind.RootNode)
        parent = parent.parent;
    return <kataw.RootNode>parent;
}

export function getAllFunctionNodesInFunction(node: kataw.FunctionExpression | kataw.FunctionDeclaration) {
    const nodes = [...getChildNodes(node)];
    const foundFuncNodes = [];
    let cur: kataw.SyntaxNode;
    while (cur = nodes.shift()) {
        if (isFunction(cur)) {
            foundFuncNodes.push(cur);
        } else
            nodes.push.apply(nodes, getChildNodes(cur));
    }

    return foundFuncNodes;
}

export function getAllNodesInFunction(node: kataw.FunctionExpression | kataw.FunctionDeclaration) {
    let i = 0;
    const nodes = [...getChildNodes(node)];
    while (i < nodes.length) {
        if (isFunction(nodes[i]))
            i++;
        else
            nodes.push.apply(nodes, getChildNodes(nodes[i++]));
    }

    return nodes;
}

const transform = kataw.createTransform();
export function getChildNodes(node: kataw.SyntaxNode) {
    const children = [];
    function visit(node) {
        children.push(node);
        kataw.visitEachChild(transform, node, visit);
        return null;
    }
    kataw.visitEachChild(transform, node, visit);
    return children;
}

export function getAllNodesUnder(node: kataw.SyntaxNode) {
    let i = 0;
    const nodes = [node];
    while (i < nodes.length)
        nodes.push.apply(nodes, getChildNodes(nodes[i++]));
    return nodes;
}

export function isUnder(container: kataw.SyntaxNode, item: kataw.SyntaxNode) {
    let parent = item;
    while (parent && parent !== container)
        parent = parent.parent;
    return parent;
}

export function getNodeText(node: kataw.SyntaxNode) {
    if (node.start === -1)
        return "(synthesized node " + kataw.SyntaxKind[node.kind] + ")";
    let root = node;
    while (root.parent)
        root = root.parent;
    return (root as kataw.RootNode).source.substring(node.start, node.end);
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
