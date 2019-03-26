import { AssignmentHelper } from './assignment';
import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {IScope} from '../program';
import {StringVarType, RegexVarType, NumberVarType, UniversalVarType, CType, BooleanVarType, ArrayType, StructType, DictType} from '../types';
import {CVariable, CAsUniversalVar} from './variable';
import {CRegexAsString} from './regexfunc';

export interface CExpression { }

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
{#if expression}
    {expression}
{#elseif operator}
    {left} {operator} {right}
{#elseif replacedWithCall}
    {call}({left}, {right}{callAddArgs}){callCondition}
{#elseif replacedWithVarAssignment}
    ({left} = {replacementVarName})
{#elseif replacedWithVar}
    {replacementVarName}
{#elseif computeOperation}
    js_var_compute({left}, {computeOperation}, {right})
{#else}
    /* unsupported expression {nodeText} */
{/if}`, ts.SyntaxKind.BinaryExpression)
export class CBinaryExpression {
    public nodeText: string;
    public operator: string;
    public replacedWithCall: boolean = false;
    public call: string;
    public callCondition: string;
    public callAddArgs: string = "";
    public replacedWithVar: boolean = false;
    public replacedWithVarAssignment: boolean = false;
    public replacementVarName: string = null;
    public gcVarName: string = null;
    public strPlusStr: boolean = false;
    public strPlusNumber: boolean = false;
    public numberPlusStr: boolean = false;
    public computeOperation: string = null;
    public expression: CExpression = null;
    public left: CExpression;
    public right: CExpression;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        if (node.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
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
        this.left = CodeTemplateFactory.createForNode(scope, node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        this.right = CodeTemplateFactory.createForNode(scope, node.right);
        const operatorKind = node.operatorToken.kind;

        let operatorMap: { [token: number]: string } = {};
        let callReplaceMap: { [token: number]: [string, string] } = {};
        
        if (leftType == RegexVarType && operatorKind == ts.SyntaxKind.PlusToken) {
            leftType = StringVarType;
            this.left = new CRegexAsString(this.left);
        }
        if (rightType == RegexVarType && operatorKind == ts.SyntaxKind.PlusToken) {
            rightType = StringVarType;
            this.right = new CRegexAsString(this.right);
        }

        operatorMap[ts.SyntaxKind.AmpersandAmpersandToken] = '&&';
        operatorMap[ts.SyntaxKind.BarBarToken] = '||';

        const isEqualityOp = operatorKind == ts.SyntaxKind.EqualsEqualsToken || operatorKind == ts.SyntaxKind.EqualsEqualsEqualsToken
            || operatorKind == ts.SyntaxKind.ExclamationEqualsToken || operatorKind == ts.SyntaxKind.ExclamationEqualsEqualsToken;

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
            operatorMap[ts.SyntaxKind.PercentToken] = '%';
            operatorMap[ts.SyntaxKind.PlusToken] = '+';
            operatorMap[ts.SyntaxKind.MinusToken] = '-';
            operatorMap[ts.SyntaxKind.AmpersandToken] = '&';
            operatorMap[ts.SyntaxKind.BarToken] = '|';
            operatorMap[ts.SyntaxKind.CaretToken] = '^';
            operatorMap[ts.SyntaxKind.GreaterThanGreaterThanToken] = '>>';
            operatorMap[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken] = '>>';
            operatorMap[ts.SyntaxKind.LessThanLessThanToken] = '<<';

            operatorMap[ts.SyntaxKind.AsteriskEqualsToken] = '*=';
            operatorMap[ts.SyntaxKind.SlashEqualsToken] = '/=';
            operatorMap[ts.SyntaxKind.PercentEqualsToken] = '%=';
            operatorMap[ts.SyntaxKind.PlusEqualsToken] = '+=';
            operatorMap[ts.SyntaxKind.MinusEqualsToken] = '-=';
            operatorMap[ts.SyntaxKind.AmpersandEqualsToken] = '&=';
            operatorMap[ts.SyntaxKind.BarEqualsToken] = '|=';
            operatorMap[ts.SyntaxKind.CaretEqualsToken] = '^=';
            operatorMap[ts.SyntaxKind.GreaterThanGreaterThanEqualsToken] = '>>=';
            operatorMap[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken] = '>>';
            operatorMap[ts.SyntaxKind.LessThanLessThanEqualsToken] = '<<=';

            if (operatorKind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken
                || operatorKind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken)
            {
                const leftAsString = CodeTemplateFactory.templateToString(this.left as any);
                this.left = "((uint16_t)" + leftAsString + ")";
                if (operatorKind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken)
                    this.left = leftAsString + " = " + this.left;
                scope.root.headerFlags.uint16_t = true;
            }
        }
        else if (leftType == StringVarType && rightType == StringVarType) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['strcmp', ' == 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['strcmp', ' == 0'];

            if (callReplaceMap[operatorKind])
                scope.root.headerFlags.strings = true;

            if (operatorKind == ts.SyntaxKind.PlusToken || operatorKind == ts.SyntaxKind.PlusEqualsToken) {
                let tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                scope.func.variables.push(new CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                this.replacedWithVar = true;
                this.replacedWithVarAssignment = operatorKind === ts.SyntaxKind.PlusEqualsToken;
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

            if (operatorKind == ts.SyntaxKind.PlusToken || operatorKind == ts.SyntaxKind.PlusEqualsToken) {
                let tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                scope.func.variables.push(new CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                this.replacedWithVar = true;
                this.replacedWithVarAssignment = operatorKind === ts.SyntaxKind.PlusEqualsToken;
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
        else if (isEqualityOp && (leftType == UniversalVarType || rightType == UniversalVarType)) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['js_var_eq|, TRUE', ' == FALSE'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['js_var_eq|, FALSE', ' == FALSE'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['js_var_eq|, TRUE', ' == TRUE'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['js_var_eq|, FALSE', ' == TRUE'];
            this.left = new CAsUniversalVar(scope, node.left, this.left, leftType);
            this.right = new CAsUniversalVar(scope, node.right, this.right, rightType);
            scope.root.headerFlags.js_var_eq = true;
        }
        else if (!isEqualityOp && (leftType == UniversalVarType || rightType == UniversalVarType)) {

            const js_var_operator_map = {
                [ts.SyntaxKind.AsteriskToken]: "JS_VAR_ASTERISK",
                [ts.SyntaxKind.SlashToken]: "JS_VAR_SLASH",
                [ts.SyntaxKind.PercentToken]: "JS_VAR_PERCENT",
                [ts.SyntaxKind.PlusToken]: "JS_VAR_PLUS",
                [ts.SyntaxKind.MinusToken]: "JS_VAR_MINUS"
            };
            
            this.computeOperation = js_var_operator_map[operatorKind];
            this.left = new CAsUniversalVar(scope, node.left, this.left, leftType);
            this.right = new CAsUniversalVar(scope, node.right, this.right, rightType);
            scope.root.headerFlags.js_var_compute = true;

        } else if (leftType instanceof StructType || leftType instanceof ArrayType || leftType instanceof DictType
                || rightType instanceof StructType || rightType instanceof ArrayType || rightType instanceof DictType) {

            operatorMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.ExclamationEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = '==';
            operatorMap[ts.SyntaxKind.EqualsEqualsToken] = '==';

            if (leftType != rightType) {
                this.expression = "FALSE";
                scope.root.headerFlags.bool = true;
            }

        }
        this.operator = operatorMap[operatorKind];
        if (callReplaceMap[operatorKind]) {
            this.replacedWithCall = true;
            [this.call, this.callCondition] = callReplaceMap[operatorKind];
            if (this.call.indexOf('|') > -1)
                [this.call, this.callAddArgs] = this.call.split('|');
        }
        this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();

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
{#elseif call}
    {call}({operand})
{#else}
    /* unsupported expression {nodeText} */
{/if}`, [ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression])
class CUnaryExpression {
    public nodeText: string;
    public operator: string;
    public operand: CExpression;
    public isPostfix: boolean;
    public call: string = null;
    public callPostfix: string = "";
    constructor(scope: IScope, node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression) {
        let operatorMap: { [token: number]: string } = {};
        let type = scope.root.typeHelper.getCType(node.operand);

        this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
        this.isPostfix = node.kind == ts.SyntaxKind.PostfixUnaryExpression;
        this.nodeText = node.getText();

        operatorMap[ts.SyntaxKind.ExclamationToken] = '!';
        if (type == NumberVarType) {
            operatorMap[ts.SyntaxKind.PlusPlusToken] = '++';
            operatorMap[ts.SyntaxKind.MinusMinusToken] = '--';
            operatorMap[ts.SyntaxKind.MinusToken] = '-';
            operatorMap[ts.SyntaxKind.PlusToken] = '+';
            operatorMap[ts.SyntaxKind.TildeToken] = '~';
        }
        if (type != NumberVarType && type != UniversalVarType && node.operator === ts.SyntaxKind.PlusToken) {
            this.call = "str_to_int16_t";
            scope.root.headerFlags.str_to_int16_t = true;
        } else if (type == UniversalVarType && node.operator == ts.SyntaxKind.PlusToken) {
            this.call = "js_var_to_number";
            scope.root.headerFlags.js_var_to_number = true;
        }
        this.operator = operatorMap[node.operator];
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

@CodeTemplate(`
{#if isUniversalVar}
    js_var_typeof({expression})
{#elseif isString}
    "string"
{#elseif isNumber}
    "number"
{#elseif isBoolean}
    "number"
{#else}
    "object"
{/if}`, ts.SyntaxKind.TypeOfExpression)
class CTypeOf {
    expression: CExpression;
    isUniversalVar: boolean;
    isNumber: boolean;
    isBoolean: boolean;
    isString: boolean;
    constructor(scope: IScope, node: ts.TypeOfExpression) {
        const type = scope.root.typeHelper.getCType(node.expression);
        this.isUniversalVar = type === UniversalVarType;
        this.isString = type === StringVarType;
        this.isNumber = type === NumberVarType;
        this.isBoolean = type === BooleanVarType;
        this.expression = CodeTemplateFactory.createForNode(scope, node.expression);

        if (type == UniversalVarType) {
            scope.root.headerFlags.js_var = true;
            scope.root.headerFlags.js_var_typeof = true;
        }
    }
}

@CodeTemplate(`js_var_to_undefined({expression})`, ts.SyntaxKind.VoidExpression)
class CVoid {
    public expression: CExpression;
    constructor(scope: IScope, node: ts.TypeOfExpression) {
        this.expression = CodeTemplateFactory.createForNode(scope, node.expression);
        scope.root.headerFlags.js_var = true;
        scope.root.headerFlags.js_var_to_undefined = true;
    }
}

@CodeTemplate(`
{#if universalWrapper}
    js_var_to_bool({expression})
{#elseif isString && expressionIsIdentifier}
    *{expression}
{#elseif isString}
    *({expression})
{#else}
    {expression}
{/if}`)
export class CCondition {
    public universalWrapper: boolean = false;
    public isString: boolean = false;
    public expression: CExpression;
    public expressionIsIdentifier: boolean = false;
    constructor(scope: IScope, node: ts.Expression) {
        this.expression = CodeTemplateFactory.createForNode(scope, node);
        this.expressionIsIdentifier = ts.isIdentifier(node);
        const type = scope.root.typeHelper.getCType(node);
        this.isString = type == StringVarType;
        if (type == UniversalVarType) {
            this.universalWrapper = true;
            scope.root.headerFlags.js_var_to_bool = true;
        }
    }
}