import { AssignmentHelper, CAssignment } from './assignment';
import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {IScope} from '../program';
import {StringVarType, RegexVarType, NumberVarType, UniversalVarType, CType, BooleanVarType, ArrayType, StructType, DictType, toNumberCanBeNaN, operandsToNumber, equalityOps} from '../types';
import {CVariable, CAsUniversalVar} from './variable';
import {CRegexAsString} from './regexfunc';
import { CString } from './literals';
import { CArraySize, CSimpleElementAccess } from './elementaccess';

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
        if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
            this.expression = new CPlusExpression(scope, node);
            return;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.PlusEqualsToken) {
            const left = CodeTemplateFactory.createForNode(scope, node.left);
            const right = new CPlusExpression(scope, node);
            this.expression = "(" + CodeTemplateFactory.templateToString(left) + " = " + CodeTemplateFactory.templateToString(<any>right) + ")";
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

        }
        else if (isEqualityOp && (leftType == UniversalVarType || rightType == UniversalVarType)) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['js_var_eq|, TRUE', ' == FALSE'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['js_var_eq|, FALSE', ' == FALSE'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['js_var_eq|, TRUE', ' == TRUE'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['js_var_eq|, FALSE', ' == TRUE'];
            this.left = new CAsUniversalVar(scope, this.left, leftType);
            this.right = new CAsUniversalVar(scope, this.right, rightType);
            scope.root.headerFlags.js_var_eq = true;
        }
        else if (!isEqualityOp && (toNumberCanBeNaN(leftType) || toNumberCanBeNaN(rightType))) {

            const js_var_operator_map = {
                [ts.SyntaxKind.AsteriskToken]: "JS_VAR_ASTERISK",
                [ts.SyntaxKind.SlashToken]: "JS_VAR_SLASH",
                [ts.SyntaxKind.PercentToken]: "JS_VAR_PERCENT",
                [ts.SyntaxKind.MinusToken]: "JS_VAR_MINUS"
            };
            
            this.computeOperation = js_var_operator_map[operatorKind];
            this.left = new CAsUniversalVar(scope, this.left, leftType);
            this.right = new CAsUniversalVar(scope, this.right, rightType);
            scope.root.headerFlags.js_var_compute = true;

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

            this.strlen_left = new CArgStrLen(scope, node.left, this.left, leftType);
            this.strlen_right = new CArgStrLen(scope, node.right, this.right, rightType);

            this.strcat_left = new CArgStrCat(scope, node.left, tempVarName, this.left, leftType);
            this.strcat_right = new CArgStrCat(scope, node.right, tempVarName, this.right, rightType);

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
{#statements}
    {#if isArrayOfString}
        {lengthVarName} = 0;
        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)
            {lengthVarName} += strlen({arrayElement});
    {#elseif isArrayOfUniversalVar}
        {lengthVarName} = 0;
        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {
            {lengthVarName} += strlen({tmpVarName} = js_var_to_str({arrayElement}, &{needDisposeVarName}));
            if ({needDisposeVarName})
                free((void *){tmpVarName});
        }
    {/if}
{/statements}
{#if isNumber}
    STR_INT16_T_BUFLEN
{#elseif isString}
    strlen({arg})
{#elseif isBoolean}
    (5-{arg})
{#elseif isArrayOfNumber}
    (STR_INT16_T_BUFLEN + 1) * {arraySize}
{#elseif isArrayOfBoolean}
    6 * {arraySize}
{#elseif isArrayOfObj}
    16 * {arraySize}
{#elseif isArrayOfString || isArrayOfUniversalVar}
    {lengthVarName}
{#elseif isArrayOfArray}
    /* determining string length of array {arg} is not supported yet */
{#else}
    15
{/if}`)
class CArgStrLen {
    public isNumber: boolean;
    public isString: boolean;
    public isBoolean: boolean;
    public isArray: boolean;
    public isArrayOfString: boolean;
    public isArrayOfNumber: boolean;
    public isArrayOfBoolean: boolean;
    public isArrayOfUniversalVar: boolean;
    public isArrayOfArray: boolean;
    public isArrayOfObj: boolean;
    public arraySize: CArraySize;
    public arrayElement: CSimpleElementAccess;
    public tmpVarName: string;
    public needDisposeVarName: string;
    public lengthVarName: string;
    public iteratorVarName: string;
    constructor(scope: IScope, node: ts.Node, public arg: CExpression, public type: CType) {
        this.isNumber = type === NumberVarType;
        this.isString = type === StringVarType;
        this.isBoolean = type === BooleanVarType;
        this.isArrayOfString = type instanceof ArrayType && type.elementType === StringVarType;
        this.isArrayOfNumber = type instanceof ArrayType && type.elementType === NumberVarType;
        this.isArrayOfBoolean = type instanceof ArrayType && type.elementType === BooleanVarType;
        this.isArrayOfUniversalVar = type instanceof ArrayType && type.elementType === UniversalVarType;
        this.isArrayOfArray = type instanceof ArrayType && type.elementType instanceof Array;
        this.isArrayOfObj = type instanceof ArrayType && (type.elementType instanceof DictType || type.elementType instanceof StructType);
        this.arraySize = type instanceof ArrayType && new CArraySize(scope, arg, type);

        if (this.isArrayOfString || this.isArrayOfUniversalVar) {
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
            this.arrayElement = new CSimpleElementAccess(scope, type, arg, this.iteratorVarName);
            this.lengthVarName = scope.root.symbolsHelper.addTemp(node, "len", false);
            if (!scope.variables.some(v => v.name == this.lengthVarName))
                scope.variables.push(new CVariable(scope, this.lengthVarName, NumberVarType));

            scope.root.headerFlags.strings = true;
        }

        if (this.isArrayOfUniversalVar) {
            this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "tmp", false);
            this.needDisposeVarName = scope.root.symbolsHelper.addTemp(node, "need_dispose", false);
            if (!scope.variables.some(v => v.name == this.tmpVarName))
                scope.variables.push(new CVariable(scope, this.tmpVarName, StringVarType));
            if (!scope.variables.some(v => v.name == this.needDisposeVarName))
                scope.variables.push(new CVariable(scope, this.needDisposeVarName, BooleanVarType));

            scope.root.headerFlags.js_var_to_str = true;
        }
    }
}

@CodeTemplate(`
{#if isNumber}
    str_int16_t_cat({buf}, {arg});
{#elseif isString}
    strcat({buf}, {arg});
{#elseif isBoolean}
    strcat({buf}, {arg} ? "true" : "false");
{#elseif isUniversalVar}
    strcat({buf}, ({tmpVarName} = js_var_to_str({arg}, &{needDisposeVarName})));
    if ({needDisposeVarName})
        free((void *){tmpVarName});
{#elseif isArray}
    for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {
        if ({iteratorVarName} != 0)
            strcat({buf}, ",");
        {arrayElementCat}
    }
{#else}
    strcat({buf}, "[object Object]");
{/if}
`)
class CArgStrCat {
    public isNumber: boolean;
    public isString: boolean;
    public isBoolean: boolean;
    public isUniversalVar: boolean;
    public tmpVarName: string;
    public needDisposeVarName: string;
    public isArray: boolean = false;
    public iteratorVarName: string;
    public arrayElementCat: CArgStrCat;
    public arraySize: CArraySize;
    constructor(scope: IScope, node: ts.Node, public buf: CExpression, public arg: CExpression, public type: CType) {
        this.isNumber = type === NumberVarType;
        this.isString = type === StringVarType;
        this.isBoolean = type === BooleanVarType;
        this.isUniversalVar = type === UniversalVarType;
        if (this.isUniversalVar) {
            this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "tmp", false);
            this.needDisposeVarName = scope.root.symbolsHelper.addTemp(node, "need_dispose", false);
            if (!scope.variables.some(v => v.name == this.tmpVarName))
                scope.variables.push(new CVariable(scope, this.tmpVarName, StringVarType));
            if (!scope.variables.some(v => v.name == this.needDisposeVarName))
                scope.variables.push(new CVariable(scope, this.needDisposeVarName, BooleanVarType));

            scope.root.headerFlags.js_var_to_str = true;
        }
        if (type instanceof ArrayType) {
            this.isArray = true;
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
            const arrayElement = new CSimpleElementAccess(scope, type, arg, this.iteratorVarName);
            this.arrayElementCat = new CArgStrCat(scope, node, buf, arrayElement, type.elementType);
            this.arraySize = new CArraySize(scope, arg, type);
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
{#elseif expression}
    {expression}
{#else}
    /* unsupported expression {nodeText} */
{/if}`, [ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression])
class CUnaryExpression {
    public nodeText: string;
    public operator: string;
    public operand: CExpression;
    public isPostfix: boolean;
    public call: string = null;
    public expression: CExpression = null;
    constructor(scope: IScope, node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression) {
        let operatorMap: { [token: number]: string } = {};
        let type = scope.root.typeHelper.getCType(node.operand);

        this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
        this.isPostfix = node.kind == ts.SyntaxKind.PostfixUnaryExpression;
        this.nodeText = node.getText();

        operatorMap[ts.SyntaxKind.ExclamationToken] = '!';
        if (type == NumberVarType || type == BooleanVarType) {
            operatorMap[ts.SyntaxKind.PlusPlusToken] = '++';
            operatorMap[ts.SyntaxKind.MinusMinusToken] = '--';
            operatorMap[ts.SyntaxKind.MinusToken] = '-';
            operatorMap[ts.SyntaxKind.PlusToken] = '+';
            operatorMap[ts.SyntaxKind.TildeToken] = '~';
        }
        if (node.operator === ts.SyntaxKind.PlusToken) {
            if (type == StringVarType) {
                this.call = "str_to_int16_t";
                scope.root.headerFlags.str_to_int16_t = true;
            } else if (type == UniversalVarType) {
                this.call = "js_var_to_number";
                scope.root.headerFlags.js_var_to_number = true;
            } else if (type instanceof StructType) {
                this.call = "js_var_from";
                this.operand = "JS_VAR_NAN";
                scope.root.headerFlags.js_var_from = true;
            } else if (type instanceof ArrayType && !type.isDynamicArray && type.capacity == 0) {
                this.expression = "js_var_from_int16_t(0)";
                scope.root.headerFlags.js_var_from_int16_t = true;
            } else if (type instanceof ArrayType && !type.isDynamicArray && type.capacity > 1) {
                this.expression = "js_var_from(JS_VAR_NAN)";
                scope.root.headerFlags.js_var_from = true;
            } else if (type instanceof DictType) {
                this.expression = "js_var_from(JS_VAR_NAN)";
                scope.root.headerFlags.js_var_from = true;
            }
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

