import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {IScope} from '../program';
import {CType, ArrayType, StructType, StringVarType, NumberVarType, BooleanVarType, UniversalVarType, PointerVarType} from '../types';
import {AssignmentHelper, CAssignment} from './assignment';
import {PrintfHelper} from './printf';
import {CVariable} from './variable';
import {CElementAccess} from './elementaccess';

export interface CExpression { }

@CodeTemplate(`
{#statements}
    {#if propName == "push" && tempVarName}
        ARRAY_PUSH({varAccess}, {arguments});
        {tempVarName} = {varAccess}->size;
    {#elseif propName == "indexOf" && tempVarName && staticArraySize}
        {tempVarName} = -1;
        for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++) {
            if ({varAccess}[{iteratorVarName}] == {arg1}) {
                {tempVarName} = {iteratorVarName};
                break;
            }
        }
    {#elseif propName == "indexOf" && tempVarName}
        {tempVarName} = -1;
        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++) {
            if ({varAccess}->data[{iteratorVarName}] == {arg1}) {
                {tempVarName} = {iteratorVarName};
                break;
            }
        }
    {/if}
{/statements}
{#if propName == "push" && arguments.length == 1 && topExpressionOfStatement}
    ARRAY_PUSH({varAccess}, {arguments})
{#elseif tempVarName}
    {tempVarName}
{#elseif propName == "indexOf" && arguments.length == 1}
    {funcName}({varAccess}, {arg1})
{#elseif propName == "pop" && arguments.length == 0}
    ARRAY_POP({varAccess})
{#elseif printfCalls.length == 1}
    {printfCalls}
{#elseif printfCalls.length > 1}
    {
        {printfCalls {    }=>{this}\n}
    }
{#else}
    {funcName}({arguments {, }=> {this}})
{/if}`, ts.SyntaxKind.CallExpression)
export class CCallExpression {
    public funcName: string;
    public propName: string = null;
    public topExpressionOfStatement: boolean;
    public varAccess: CElementAccess;
    public tempVarName: string = '';
    public iteratorVarName: string;
    public staticArraySize: string = '';
    public arguments: CExpression[];
    public printfCalls: any[] = [];
    public arg1: CExpression;
    public arg2: CExpression;
    constructor(scope: IScope, call: ts.CallExpression) {
        this.funcName = call.expression.getText();
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (this.funcName != "console.log") {
            this.arguments = call.arguments.map(a => CodeTemplateFactory.createForNode(scope, a));
            this.arg1 = this.arguments[0];
            this.arg2 = this.arguments[1];
        }

        if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
            let propAccess = <ts.PropertyAccessExpression>call.expression;
            this.propName = propAccess.name.getText();
            this.varAccess = new CElementAccess(scope, propAccess.expression);

            if (this.funcName == "console.log") {
                for (let i=0;i<call.arguments.length; i++)
                {
                    this.printfCalls.push(PrintfHelper.create(scope, call.arguments[i], i == call.arguments.length - 1));
                }
                scope.root.headerFlags.printf = true;
            }
            else if (propAccess.name.getText() == 'push' && this.arguments.length == 1) {
                if (!this.topExpressionOfStatement)
                {
                    this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "arr_size");
                    scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
                }
                scope.root.headerFlags.array = true;
            }
            else if (propAccess.name.getText() == 'pop' && this.arguments.length == 0) {
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.array_pop = true;
            }
            else if (propAccess.name.getText() == 'indexOf' && this.arguments.length == 1) {
                let type = scope.root.typeHelper.getCType(propAccess.expression);
                if (type == StringVarType) {
                    this.funcName = "str_pos";
                    scope.root.headerFlags.str_pos = true;
                } else if (type instanceof ArrayType) {
                    this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "arr_pos");
                    this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(propAccess);
                    this.staticArraySize = type.isDynamicArray ? '' : type.capacity+"";
                    scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
                    scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
                    scope.root.headerFlags.array = true;
                }
            }
        }
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
{#elseif replacedWithVar}
    {replacementVarName}
{#else}
    /* unsupported expression {nodeText} */
{/if}`, ts.SyntaxKind.BinaryExpression)
class CBinaryExpression {
    public nodeText: string;
    public operator: string;
    public replacedWithCall: boolean = false;
    public call: string;
    public callCondition: string;
    public replacedWithVar: boolean = false;
    public replacementVarName: string;
    public gcVarName: string = null;
    public strPlusStr: boolean = false;
    public strPlusNumber: boolean = false;
    public numberPlusStr: boolean = false;
    public left: CExpression;
    public right: CExpression;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        let operatorMap: { [token: number]: string } = {};
        let callReplaceMap: { [token: number]: [string, string] } = {};
        let leftType = scope.root.typeHelper.getCType(node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        this.left = CodeTemplateFactory.createForNode(scope, node.left);
        this.right = CodeTemplateFactory.createForNode(scope, node.right);
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
        }
        else if (leftType == StringVarType && rightType == StringVarType) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['strcmp', ' == 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['strcmp', ' == 0'];

            if (callReplaceMap[node.operatorToken.kind])
                scope.root.headerFlags.strings = true;

            if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
                let tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                scope.func.variables.push(new CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                this.replacedWithVar = true;
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

            if (callReplaceMap[node.operatorToken.kind]) {
                scope.root.headerFlags.str_int16_t_cmp = true;
                // str_int16_t_cmp expects certain order of arguments (string, number)
                if (leftType == NumberVarType) {
                    let tmp = this.left;
                    this.left = this.right;
                    this.right = tmp;
                }
            }

            if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
                let tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                scope.func.variables.push(new CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                this.replacedWithVar = true;
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
        this.operator = operatorMap[node.operatorToken.kind];
        if (callReplaceMap[node.operatorToken.kind]) {
            this.replacedWithCall = true;
            [this.call, this.callCondition] = callReplaceMap[node.operatorToken.kind];
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

@CodeTemplate(`{expression}`, ts.SyntaxKind.ArrayLiteralExpression)
class CArrayLiteralExpression {
    public expression: string;
    constructor(scope: IScope, node: ts.ArrayLiteralExpression) {
        let arrSize = node.elements.length;
        if (arrSize == 0) {
            this.expression = "/* Empty array is not supported inside expressions */";
            return;
        }

        let type = scope.root.typeHelper.getCType(node);
        if (type instanceof ArrayType) {
            let varName: string;
            let canUseInitializerList = node.elements.every(e => e.kind == ts.SyntaxKind.NumericLiteral || e.kind == ts.SyntaxKind.StringLiteral);
            if (!type.isDynamicArray && canUseInitializerList) {
                varName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_array");
                let s = "{ ";
                for (let i = 0; i < arrSize; i++) {
                    if (i != 0)
                        s += ", ";
                    let cExpr = CodeTemplateFactory.createForNode(scope, node.elements[i]);
                    s += typeof cExpr === 'string' ? cExpr : (<any>cExpr).resolve();
                }
                s += " }";
                scope.variables.push(new CVariable(scope, varName, type, { initializer: s }));
            }
            else {
                if (type.isDynamicArray) {
                    varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                    scope.func.variables.push(new CVariable(scope, varName, type, { initializer: "NULL" }));
                    scope.root.headerFlags.array = true;
                    scope.statements.push("ARRAY_CREATE(" + varName + ", " + arrSize + ", " + arrSize + ");\n");
                    let gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                    if (gcVarName) {
                        scope.statements.push("ARRAY_PUSH(" + gcVarName + ", (void *)" + varName + ");\n");
                        scope.root.headerFlags.gc_iterator = true;
                        scope.root.headerFlags.array = true;
                    }
                }
                else
                {
                    varName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_array");
                    scope.variables.push(new CVariable(scope, varName, type));
                }
                for (let i = 0; i < arrSize; i++) {
                    let assignment = new CAssignment(scope, varName, i + "", type, node.elements[i])
                    scope.statements.push(assignment);
                }
            }
            this.expression = type.isDynamicArray ? "((void *)" + varName + ")" : varName;
        }
        else
            this.expression = "/* Unsupported use of array literal expression */";
    }
}

@CodeTemplate(`
{#statements}
    {#if varName}
        {varName} = malloc(sizeof(*{varName}));
        assert({varName} != NULL);
        {initializers}
    {/if}
{/statements}
{expression}`, ts.SyntaxKind.ObjectLiteralExpression)
class CObjectLiteralExpression {
    public expression: string = '';
    public varName: string = '';
    public initializers: CAssignment[] = [];
    constructor(scope: IScope, node: ts.ObjectLiteralExpression) {
        if (node.properties.length == 0)
            return;
        let type = scope.root.typeHelper.getCType(node);
        if (type instanceof StructType) {
            this.varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            scope.func.variables.push(new CVariable(scope, this.varName, type, { initializer: "NULL" }));
            
            this.initializers = node.properties
                .filter(p => p.kind == ts.SyntaxKind.PropertyAssignment)
                .map(p => <ts.PropertyAssignment>p)
                .map(p => new CAssignment(scope, this.varName, p.name.getText(), type, p.initializer));
            
            this.expression = this.varName;
        }
        else
            this.expression = "/* Unsupported use of object literal expression */";
    }
}


@CodeTemplate(`{value}`, ts.SyntaxKind.StringLiteral)
export class CString {
    public value: string;
    constructor(scope: IScope, value: ts.StringLiteral) {
        let s = value.getText();
        s = s.replace(/\\u([A-Fa-f0-9]{4})/g, (match, g1) => String.fromCharCode(parseInt(g1, 16)));
        if (s.indexOf("'") == 0)
            this.value = '"' + s.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            this.value = s;
    }
}

@CodeTemplate(`{value}`, [ts.SyntaxKind.NumericLiteral])
export class CNumber {
    public value: string;
    constructor(scope: IScope, value: ts.Node) {
        this.value = value.getText();
    }
}
