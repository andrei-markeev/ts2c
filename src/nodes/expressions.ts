import { AssignmentHelper, CAssignment } from './assignment';
import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {IScope} from '../program';
import {CType, ArrayType, StructType, StringVarType, RegexVarType, NumberVarType, BooleanVarType, UniversalVarType, PointerVarType} from '../types';
import {CVariable} from './variable';
import {CElementAccess} from './elementaccess';
import {CRegexAsString} from './regexfunc';

export interface CExpression { }

@CodeTemplate(`{expression}`, ts.SyntaxKind.BinaryExpression)
class CBinaryExpression {
    public expression: CExpression;
    constructor(scope: IScope, node: ts.BinaryExpression)
    {
        if (node.operatorToken.kind == ts.SyntaxKind.FirstAssignment) {
            this.expression = AssignmentHelper.create(scope, node.left, node.right, true);
            return;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.CommaToken) {
            let nodeAsStatement = <ts.ExpressionStatement>ts.createNode(ts.SyntaxKind.ExpressionStatement);
            nodeAsStatement.expression = node.left;
            nodeAsStatement.parent = node.getSourceFile();
            scope.statements.push(CodeTemplateFactory.createForNode(scope, nodeAsStatement));
            this.expression = CodeTemplateFactory.createForNode(scope, node.right);
            return;
        }

        let leftType = scope.root.typeHelper.getCType(node.left);
        let left = CodeTemplateFactory.createForNode(scope, node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        let right = CodeTemplateFactory.createForNode(scope, node.right);
        this.expression = new CSimpleBinaryExpression(scope, left, leftType, right, rightType, node.operatorToken.kind, node);
    }
}

@CodeTemplate(`
{#statements}
    {#if replacedWithVar && strPlusStr}
        {replacementVarName} = malloc(strlen({left}) + strlen({right}) + 1);
        assert({replacementVarName} != NULL);
        strcpy({replacementVarName}, {left});
        strcat({replacementVarName}, {right});
    {#elseif replacedWithVar && strPlusNumber}
        {replacementVarName} = malloc(strlen({left}) + STR_INT16_T_BUFLEN + 1);
        assert({replacementVarName} != NULL);
        {replacementVarName}[0] = '\\0';
        strcat({replacementVarName}, {left});
        str_int16_t_cat({replacementVarName}, {right});
    {#elseif replacedWithVar && numberPlusStr}
        {replacementVarName} = malloc(strlen({right}) + STR_INT16_T_BUFLEN + 1);
        assert({replacementVarName} != NULL);
        {replacementVarName}[0] = '\\0';
        str_int16_t_cat({replacementVarName}, {left});
        strcat({replacementVarName}, {right});
    {/if}
    {#if replacedWithVar && gcVarName}
        ARRAY_PUSH({gcVarName}, {replacementVarName});
    {/if}

{/statements}
{#if operator}
    {left} {operator} {right}
{#elseif replacedWithCall}
    {call}({left}, {right}){callCondition}
{#elseif replacedWithVarAssignment}
    ({left} = {replacementVarName})
{#elseif replacedWithVar}
    {replacementVarName}
{#else}
    /* unsupported expression {nodeText} */
{/if}`)
export class CSimpleBinaryExpression {
    public nodeText: string;
    public operator: string;
    public replacedWithCall: boolean = false;
    public call: string;
    public callCondition: string;
    public replacedWithVar: boolean = false;
    public replacedWithVarAssignment: boolean = false;
    public replacementVarName: string;
    public gcVarName: string = null;
    public strPlusStr: boolean = false;
    public strPlusNumber: boolean = false;
    public numberPlusStr: boolean = false;
    constructor(scope: IScope, public left: CExpression, leftType: CType, public right: CExpression, rightType: CType, operatorKind: ts.SyntaxKind, node: ts.Node) {
        let operatorMap: { [token: number]: string } = {};
        let callReplaceMap: { [token: number]: [string, string] } = {};
        
        if (leftType == RegexVarType && operatorKind == ts.SyntaxKind.PlusToken) {
            leftType = StringVarType;
            this.left = new CRegexAsString(left);
        }
        if (rightType == RegexVarType && operatorKind == ts.SyntaxKind.PlusToken) {
            rightType = StringVarType;
            this.right = new CRegexAsString(right);
        }

        operatorMap[ts.SyntaxKind.AmpersandAmpersandToken] = '&&';
        operatorMap[ts.SyntaxKind.BarBarToken] = '||';
        if (leftType == NumberVarType && rightType == NumberVarType) {
            operatorMap[ts.SyntaxKind.GreaterThanToken] = '>';
            operatorMap[ts.SyntaxKind.GreaterThanEqualsToken] = '>=';
            operatorMap[ts.SyntaxKind.LessThanToken] = '<';
            operatorMap[ts.SyntaxKind.LessThanEqualsToken] = '<=';
            operatorMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.ExclamationEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = '==';
            operatorMap[ts.SyntaxKind.EqualsEqualsToken] = '==';
            operatorMap[ts.SyntaxKind.AsteriskToken] = '*';
            operatorMap[ts.SyntaxKind.SlashToken] = '/';
            operatorMap[ts.SyntaxKind.PlusToken] = '+';
            operatorMap[ts.SyntaxKind.MinusToken] = '-';
            operatorMap[ts.SyntaxKind.FirstCompoundAssignment] = '+=';
            operatorMap[ts.SyntaxKind.AmpersandToken] = '&';
            operatorMap[ts.SyntaxKind.BarToken] = '|';
        }
        else if (leftType == StringVarType && rightType == StringVarType) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['strcmp', ' == 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['strcmp', ' == 0'];

            if (callReplaceMap[operatorKind])
                scope.root.headerFlags.strings = true;

            if (operatorKind == ts.SyntaxKind.PlusToken || operatorKind == ts.SyntaxKind.FirstCompoundAssignment) {
                let tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                scope.func.variables.push(new CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                this.replacedWithVar = true;
                this.replacedWithVarAssignment = operatorKind == ts.SyntaxKind.FirstCompoundAssignment;
                this.replacementVarName = tempVarName;
                this.strPlusStr = true;
                scope.root.headerFlags.strings = true;
                scope.root.headerFlags.malloc = true;
            }
        }
        else if (leftType == NumberVarType && rightType == StringVarType
            || leftType == StringVarType && rightType == NumberVarType) {

            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['str_int16_t_cmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['str_int16_t_cmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['str_int16_t_cmp', ' == 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['str_int16_t_cmp', ' == 0'];

            if (callReplaceMap[operatorKind]) {
                scope.root.headerFlags.str_int16_t_cmp = true;
                // str_int16_t_cmp expects certain order of arguments (string, number)
                if (leftType == NumberVarType) {
                    let tmp = this.left;
                    this.left = this.right;
                    this.right = tmp;
                }
            }

            if (operatorKind == ts.SyntaxKind.PlusToken || operatorKind == ts.SyntaxKind.FirstCompoundAssignment) {
                let tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                scope.func.variables.push(new CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                this.replacedWithVar = true;
                this.replacedWithVarAssignment = operatorKind == ts.SyntaxKind.FirstCompoundAssignment;
                this.replacementVarName = tempVarName;
                if (leftType == NumberVarType)
                    this.numberPlusStr = true;
                else
                    this.strPlusNumber = true;
                scope.root.headerFlags.strings = true;
                scope.root.headerFlags.malloc = true;
                scope.root.headerFlags.str_int16_t_cat = true;
            }

        }
        this.operator = operatorMap[operatorKind];
        if (callReplaceMap[operatorKind]) {
            this.replacedWithCall = true;
            [this.call, this.callCondition] = callReplaceMap[operatorKind];
        }
        this.nodeText = node.getText();

        if (this.gcVarName) {
            scope.root.headerFlags.gc_iterator = true;
            scope.root.headerFlags.array = true;
        }
    }
}


@CodeTemplate(`
{#if isPostfix && operator}
    {operand}{operator}
{#elseif !isPostfix && operator}
    {operator}{operand}
{#elseif replacedWithCall}
    {call}({operand}){callCondition}
{#else}
    /* unsupported expression {nodeText} */
{/if}`, [ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression])
class CUnaryExpression {
    public nodeText: string;
    public operator: string;
    public operand: CExpression;
    public isPostfix: boolean;
    public replacedWithCall: boolean = false;
    public call: string;
    public callCondition: string;
    constructor(scope: IScope, node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression) {
        let operatorMap: { [token: number]: string } = {};
        let callReplaceMap: { [token: number]: [string, string] } = {};
        let type = scope.root.typeHelper.getCType(node.operand);
        if (type == NumberVarType) {
            operatorMap[ts.SyntaxKind.PlusPlusToken] = '++';
            operatorMap[ts.SyntaxKind.MinusMinusToken] = '--';
            operatorMap[ts.SyntaxKind.MinusToken] = '-';
            operatorMap[ts.SyntaxKind.ExclamationToken] = '!';
            operatorMap[ts.SyntaxKind.PlusToken] = '+';
        }
        if (type == StringVarType) {
            callReplaceMap[ts.SyntaxKind.PlusToken] = ["atoi", ""];
            if (callReplaceMap[node.operator])
                scope.root.headerFlags.atoi = true;
        }
        this.operator = operatorMap[node.operator];
        if (callReplaceMap[node.operator]) {
            this.replacedWithCall = true;
            [this.call, this.callCondition] = callReplaceMap[node.operator];
        }
        this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
        this.isPostfix = node.kind == ts.SyntaxKind.PostfixUnaryExpression;
        this.nodeText = node.getText();
    }
}

@CodeTemplate(`{condition} ? {whenTrue} : {whenFalse}`, ts.SyntaxKind.ConditionalExpression)
class CTernaryExpression {
    public condition: CExpression;
    public whenTrue: CExpression;
    public whenFalse: CExpression;
    constructor(scope: IScope, node: ts.ConditionalExpression) {
        this.condition = CodeTemplateFactory.createForNode(scope, node.condition);
        this.whenTrue = CodeTemplateFactory.createForNode(scope, node.whenTrue);
        this.whenFalse = CodeTemplateFactory.createForNode(scope, node.whenFalse);
    }
}

@CodeTemplate(`({expression})`, ts.SyntaxKind.ParenthesizedExpression)
class CGroupingExpression {
    public expression: CExpression;
    constructor(scope: IScope, node: ts.ParenthesizedExpression) {
        this.expression = CodeTemplateFactory.createForNode(scope, node.expression);
    }
}
