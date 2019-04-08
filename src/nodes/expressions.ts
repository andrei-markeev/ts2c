import { AssignmentHelper } from './assignment';
import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {IScope} from '../program';
import {StringVarType, RegexVarType, NumberVarType, UniversalVarType, BooleanVarType, ArrayType, StructType, DictType, toNumberCanBeNaN, operandsToNumber, equalityOps} from '../types';
import {CVariable} from './variable';
import {CRegexAsString} from './regexfunc';
import { CString } from './literals';
import { CAsNumber, CAsString_Length, CAsString_Concat, CAsUniversalVar } from './typeconvert';
import { isCompoundAssignment, isNumberOp, isIntegerOp } from '../typeguards';

export interface CExpression { }

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

@CodeTemplate(`
{#if expression}
    {expression}
{#elseif operator}
    {left} {operator} {right}
{#elseif replacedWithCall}
    {call}({left}, {right}{callAddArgs}){callCondition}
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
        if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
            this.expression = new CPlusExpression(scope, node);
            return;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.PlusEqualsToken) {
            const left = CodeTemplateFactory.createForNode(scope, node.left);
            const right = new CPlusExpression(scope, node);
            this.expression = "(" + CodeTemplateFactory.templateToString(left) + " = " + CodeTemplateFactory.templateToString(<any>right) + ")";
        }
        if (isNumberOp(node.operatorToken.kind) || isIntegerOp(node.operatorToken.kind)) {
            this.expression = new CArithmeticExpression(scope, node);
            return;
        }

        let leftType = scope.root.typeHelper.getCType(node.left);
        this.left = CodeTemplateFactory.createForNode(scope, node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        this.right = CodeTemplateFactory.createForNode(scope, node.right);
        const operatorKind = node.operatorToken.kind;

        let operatorMap: { [token: number]: string } = {};
        let callReplaceMap: { [token: number]: [string, string] } = {};
        
        operatorMap[ts.SyntaxKind.AmpersandAmpersandToken] = '&&';
        operatorMap[ts.SyntaxKind.BarBarToken] = '||';

        const isEqualityOp = equalityOps.indexOf(operatorKind) > -1;
        
        if (leftType == BooleanVarType && operandsToNumber(leftType, operatorKind, rightType))
            leftType = NumberVarType;
        if (rightType == BooleanVarType && operandsToNumber(leftType, operatorKind, rightType))
            rightType = NumberVarType;

        if (leftType == NumberVarType && rightType == NumberVarType) {
            operatorMap[ts.SyntaxKind.GreaterThanToken] = '>';
            operatorMap[ts.SyntaxKind.GreaterThanEqualsToken] = '>=';
            operatorMap[ts.SyntaxKind.LessThanToken] = '<';
            operatorMap[ts.SyntaxKind.LessThanEqualsToken] = '<=';
            operatorMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.ExclamationEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = '==';
            operatorMap[ts.SyntaxKind.EqualsEqualsToken] = '==';
        }
        else if (leftType == StringVarType && rightType == StringVarType) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['strcmp', ' == 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['strcmp', ' == 0'];

            if (callReplaceMap[operatorKind])
                scope.root.headerFlags.strings = true;

        }
        else if (leftType == NumberVarType && rightType == StringVarType
            || leftType == StringVarType && rightType == NumberVarType) {

            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['str_int16_t_cmp', ' != 0'];
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

        }
        else if (isEqualityOp && (leftType == UniversalVarType || rightType == UniversalVarType)) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['js_var_eq|, TRUE', ' == FALSE'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['js_var_eq|, FALSE', ' == FALSE'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['js_var_eq|, TRUE', ' == TRUE'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['js_var_eq|, FALSE', ' == TRUE'];
            this.left = new CAsUniversalVar(scope, this.left, leftType);
            this.right = new CAsUniversalVar(scope, this.right, rightType);
            scope.root.headerFlags.js_var_eq = true;

        } else if (leftType instanceof StructType || leftType instanceof ArrayType || leftType instanceof DictType
                || rightType instanceof StructType || rightType instanceof ArrayType || rightType instanceof DictType) {

            operatorMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.ExclamationEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = '==';
            operatorMap[ts.SyntaxKind.EqualsEqualsToken] = '==';

            if (isEqualityOp && leftType != rightType) {
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
    }
}

@CodeTemplate(`
{#if operator}
    {left} {operator} {right}
{#elseif computeOperation && isCompoundAssignment}
    {left} = js_var_compute({left}, {computeOperation}, {right})
{#elseif computeOperation}
    js_var_compute({left}, {computeOperation}, {right})
{#else}
    /* unsupported arithmetic expression {nodeText} */
{/if}`)
class CArithmeticExpression {
    public isCompoundAssignment;
    public operator: string = null;
    public computeOperation: string = null;
    public left: CExpression;
    public right: CExpression;
    public nodeText: string;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        let leftType = scope.root.typeHelper.getCType(node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        this.isCompoundAssignment = isCompoundAssignment(node.operatorToken);
        
        if (toNumberCanBeNaN(leftType) || toNumberCanBeNaN(rightType)) {
            const js_var_operator_map = {
                [ts.SyntaxKind.AsteriskToken]: "JS_VAR_ASTERISK",
                [ts.SyntaxKind.AsteriskEqualsToken]: "JS_VAR_ASTERISK",
                [ts.SyntaxKind.SlashToken]: "JS_VAR_SLASH",
                [ts.SyntaxKind.SlashEqualsToken]: "JS_VAR_SLASH",
                [ts.SyntaxKind.PercentToken]: "JS_VAR_PERCENT",
                [ts.SyntaxKind.PercentEqualsToken]: "JS_VAR_PERCENT",
                [ts.SyntaxKind.MinusToken]: "JS_VAR_MINUS",
                [ts.SyntaxKind.MinusEqualsToken]: "JS_VAR_MINUS",
                [ts.SyntaxKind.LessThanLessThanToken]: "JS_VAR_SHL",
                [ts.SyntaxKind.LessThanLessThanEqualsToken]: "JS_VAR_SHL",
                [ts.SyntaxKind.GreaterThanGreaterThanToken]: "JS_VAR_SHR",
                [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: "JS_VAR_SHR",
                [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: "JS_VAR_USHR",
                [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: "JS_VAR_USHR",
                [ts.SyntaxKind.BarToken]: "JS_VAR_OR",
                [ts.SyntaxKind.BarEqualsToken]: "JS_VAR_OR",
                [ts.SyntaxKind.AmpersandToken]: "JS_VAR_AND",
                [ts.SyntaxKind.AmpersandEqualsToken]: "JS_VAR_AND"
            };
            
            this.computeOperation = js_var_operator_map[node.operatorToken.kind];
            this.left = new CAsUniversalVar(scope, node.left);
            this.right = new CAsUniversalVar(scope, node.right);
            scope.root.headerFlags.js_var_compute = true;
        } else {
            this.operator = node.operatorToken.getText();
            this.left = new CAsNumber(scope, node.left);
            this.right = new CAsNumber(scope, node.right);

            if (node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken
                || node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken)
            {
                this.operator = ">>";
                const leftAsString = CodeTemplateFactory.templateToString(this.left as any);
                this.left = "((uint16_t)" + leftAsString + ")";
                if (node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken)
                    this.left = leftAsString + " = " + this.left;
                scope.root.headerFlags.uint16_t = true;
            }
        }
        this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
    }
}


@CodeTemplate(`
{#statements}
    {#if replacedWithVar}
        {replacementVarName} = malloc({strlen_left} + {strlen_right} + 1);
        assert({replacementVarName} != NULL);
        {replacementVarName}[0] = '\\0';
        {strcat_left}
        {strcat_right}
    {/if}
    {#if replacedWithVar && gcVarName}
        ARRAY_PUSH({gcVarName}, {replacementVarName});
    {/if}

{/statements}
{#if addNumbers}
    {left} + {right}
{#elseif replacedWithVar}
    {replacementVarName}
{#elseif isUniversalVar}
    js_var_plus({left}, {right})
{/if}`)
class CPlusExpression {
    public addNumbers: boolean = false;
    public isUniversalVar: boolean = false;
    public replacedWithVar: boolean = false;
    public replacementVarName: string = null;
    public gcVarName: string = null;
    public left: CExpression;
    public right: CExpression;
    public strcat_left: CExpression;
    public strcat_right: CExpression;
    public strlen_left: CExpression;
    public strlen_right: CExpression;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        let leftType = scope.root.typeHelper.getCType(node.left);
        this.left = CodeTemplateFactory.createForNode(scope, node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        this.right = CodeTemplateFactory.createForNode(scope, node.right);

        if (leftType == RegexVarType) {
            leftType = StringVarType;
            this.left = new CRegexAsString(this.left);
        }
        if (rightType == RegexVarType) {
            rightType = StringVarType;
            this.right = new CRegexAsString(this.right);
        }

        if ((leftType === NumberVarType || leftType === BooleanVarType) && (rightType === NumberVarType || rightType === BooleanVarType)) {
            this.addNumbers = true;
        }
        else if (leftType === UniversalVarType || rightType === UniversalVarType) {
            this.isUniversalVar = true;
            this.left = new CAsUniversalVar(scope, this.left, leftType);
            this.right = new CAsUniversalVar(scope, this.right, rightType);
            scope.root.headerFlags.js_var_plus = true;
        }
        else {
            let tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            scope.func.variables.push(new CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
            this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
            this.replacedWithVar = true;
            this.replacementVarName = tempVarName;

            this.strlen_left = new CAsString_Length(scope, node.left, this.left, leftType);
            this.strlen_right = new CAsString_Length(scope, node.right, this.right, rightType);

            this.strcat_left = new CAsString_Concat(scope, node.left, tempVarName, this.left, leftType);
            this.strcat_right = new CAsString_Concat(scope, node.right, tempVarName, this.right, rightType);

            scope.root.headerFlags.strings = true;
            scope.root.headerFlags.malloc = true;
            scope.root.headerFlags.str_int16_t_cat = true;

            if (this.gcVarName) {
                scope.root.headerFlags.gc_iterator = true;
                scope.root.headerFlags.array = true;
            }
        }

    }
}


@CodeTemplate(`
{#if isCompound}
    ({operand} = {before}{operand}{after})
{#else}
    {before}{operand}{after}
{/if}`, [ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression])
class CUnaryExpression {
    public before: string = "";
    public operand: CExpression;
    public after: string = "";
    public isPostfix: boolean;
    public isCompound: boolean = false;
    constructor(scope: IScope, node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression) {
        this.isPostfix = node.kind == ts.SyntaxKind.PostfixUnaryExpression;

        const type = scope.root.typeHelper.getCType(node.operand);
        if (node.operator === ts.SyntaxKind.PlusToken)
            this.operand = new CAsNumber(scope, node.operand);
        else if (node.operator === ts.SyntaxKind.MinusToken) {
            this.before = "-";
            this.operand = new CAsNumber(scope, node.operand);
            if (toNumberCanBeNaN(type)) {
                this.before = "js_var_compute(js_var_from_int16_t(0), JS_VAR_MINUS, ";
                this.after = ")";
                scope.root.headerFlags.js_var_compute = true;
                scope.root.headerFlags.js_var_from_int16_t = true;
            }
        } else if (node.operator === ts.SyntaxKind.TildeToken) {
            this.before = "~";
            this.operand = new CAsNumber(scope, node.operand);
            if (toNumberCanBeNaN(type))
                this.after = ".number";
        } else if (node.operator === ts.SyntaxKind.ExclamationToken) {
            this.before = "!";
            this.operand = new CCondition(scope, node.operand);
        } else if (node.operator === ts.SyntaxKind.PlusPlusToken) {
            if (this.isPostfix) {
                if (toNumberCanBeNaN(type))
                    this.operand = `/* not supported expression ${node.getText()} */`;
                else {
                    this.operand = new CAsNumber(scope, node.operand);
                    this.after = "++";
                }
            } else {
                if (toNumberCanBeNaN(type)) {
                    this.isCompound = true;
                    this.before = "js_var_plus(js_var_to_number(";
                    this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
                    this.after = "), js_var_from_int16_t(1))";
                    scope.root.headerFlags.js_var_plus = true;
                    scope.root.headerFlags.js_var_from_int16_t = true;
                } else {
                    this.before = "++";
                    this.operand = new CAsNumber(scope, node.operand);
                }
            }
        } else if (node.operator === ts.SyntaxKind.MinusMinusToken) {
            if (this.isPostfix) {
                if (toNumberCanBeNaN(type))
                    this.operand = `/* not supported expression ${node.getText()} */`;
                else {
                    this.operand = new CAsNumber(scope, node.operand);
                    this.after = "--";
                }
            } else {
                if (toNumberCanBeNaN(type)) {
                    this.isCompound = true;
                    this.before = "js_var_compute(";
                    this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
                    this.after = ", JS_VAR_MINUS, js_var_from_int16_t(1))";
                    scope.root.headerFlags.js_var_compute = true;
                    scope.root.headerFlags.js_var_from_int16_t = true;
                } else {
                    this.before = "++";
                    this.operand = new CAsNumber(scope, node.operand);
                }
            }
        }
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
{#statements}
    {tempVarName} = dict_find_pos({dict}->index->data, {dict}->index->size, {argExpression});
    if ({tempVarName} >= 0)
    {
        ARRAY_REMOVE({dict}->index, {tempVarName}, 1);
        ARRAY_REMOVE({dict}->values, {tempVarName}, 1);
    }
{/statements}
{#if !topExpressionOfStatement}
    TRUE
{/if}`, ts.SyntaxKind.DeleteExpression)
class CDelete {
    public dict: CExpression;
    public argExpression: CExpression;
    public tempVarName: string;
    public topExpressionOfStatement: boolean;
    constructor(scope: IScope, node: ts.DeleteExpression) {
        this.topExpressionOfStatement = node.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.dict = (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
            && CodeTemplateFactory.createForNode(scope, node.expression.expression);
        if (ts.isElementAccessExpression(node.expression))
            this.argExpression = ts.isNumericLiteral(node.expression.argumentExpression)
                ? '"' + node.expression.argumentExpression.text + '"' 
                : CodeTemplateFactory.createForNode(scope, node.expression.argumentExpression)
        else if (ts.isPropertyAccessExpression(node.expression))
            this.argExpression = new CString(scope, node.expression.name.text);
        this.tempVarName = scope.root.symbolsHelper.addTemp(node, "tmp_dict_pos");
        scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
        scope.root.headerFlags.bool = true;
        scope.root.headerFlags.array_remove = true;
    }
}

