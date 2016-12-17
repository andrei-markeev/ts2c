import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {IScope} from '../program';
import {ArrayType, StringVarType, NumberVarType} from '../types';
import {CElementAccess, CSimpleElementAccess} from './elementaccess';
import {CExpression, CSimpleBinaryExpression} from './expressions';
import {CVariable} from './variable';
import {ConsoleLogHelper} from '../standard/console/log';
import {StandardCallHelper} from '../resolver';

@CodeTemplate(`
{#statements}
    {#if propName == "push" && tempVarName}
        ARRAY_PUSH({varAccess}, {arguments});
        {tempVarName} = {varAccess}->size;
    {#elseif propName == "unshift" && tempVarName}
        ARRAY_INSERT({varAccess}, 0, {arguments});
        {tempVarName} = {varAccess}->size;
    {#elseif propName == "shift" && tempVarName}
        {tempVarName} = {varAccess}->data[0];
        ARRAY_REMOVE({varAccess}, 0, 1);
    {#elseif propName == "indexOf" && tempVarName && staticArraySize}
        {tempVarName} = -1;
        for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++) {
            if ({comparison}) {
                {tempVarName} = {iteratorVarName};
                break;
            }
        }
    {#elseif propName == "indexOf" && tempVarName}
        {tempVarName} = -1;
        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++) {
            if ({comparison}) {
                {tempVarName} = {iteratorVarName};
                break;
            }
        }
    {#elseif propName == "lastIndexOf" && tempVarName && staticArraySize}
        {tempVarName} = -1;
        for ({iteratorVarName} = {staticArraySize} - 1; {iteratorVarName} >= 0; {iteratorVarName}--) {
            if ({comparison}) {
                {tempVarName} = {iteratorVarName};
                break;
            }
        }
    {#elseif propName == "lastIndexOf" && tempVarName}
        {tempVarName} = -1;
        for ({iteratorVarName} = {varAccess}->size - 1; {iteratorVarName} >= 0; {iteratorVarName}--) {
            if ({comparison}) {
                {tempVarName} = {iteratorVarName};
                break;
            }
        }
    {/if}
{/statements}
{#if standardCall}
    {standardCall}
{#elseif topExpressionOfStatement && propName == "unshift" && arguments.length == 1}
    ARRAY_INSERT({varAccess}, 0, {arguments})
{#elseif tempVarName}
    {tempVarName}
{#elseif propName == "indexOf" && arguments.length == 1}
    {funcName}({varAccess}, {arg1})
{#elseif propName == "lastIndexOf" && arguments.length == 1}
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
    public standardCall: CExpression;
    public topExpressionOfStatement: boolean;
    public varAccess: CElementAccess;
    public tempVarName: string = '';
    public tempVar2Name: string;
    public tempVar3Name: string;
    public tempVar4Name: string;
    public iteratorVarName: string;
    public staticArraySize: string = '';
    public arguments: CExpression[];
    public printfCalls: any[] = [];
    public arg1: CExpression;
    public arg2: CExpression;
    public insertValues: CInsertValue[] = [];
    public spliceNeedsRemove: boolean = true;
    public comparison: CExpression;
    constructor(scope: IScope, call: ts.CallExpression) {
        this.funcName = call.expression.getText();
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.standardCall = StandardCallHelper.createTemplate(scope, call);

        if (this.standardCall)
            return;

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
                for (let i = 0; i < call.arguments.length; i++) {
                    this.printfCalls.push(ConsoleLogHelper.create(scope, call.arguments[i], i == call.arguments.length - 1));
                }
                scope.root.headerFlags.printf = true;
            }
            else if ((this.propName == "push" || this.propName == "unshift") && this.arguments.length == 1) {
                if (!this.topExpressionOfStatement) {
                    this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "arr_size");
                    scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
                }
                scope.root.headerFlags.array = true;
                if (propAccess.name.getText() == "unshift")
                    scope.root.headerFlags.array_insert = true;
            }
            else if (this.propName == "pop" && this.arguments.length == 0) {
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.array_pop = true;
            }
            else if (this.propName == "shift" && this.arguments.length == 0) {
                this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "value");
                let type = <ArrayType>scope.root.typeHelper.getCType(propAccess.expression);
                scope.variables.push(new CVariable(scope, this.tempVarName, type.elementType));
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.array_remove = true;
            }
            else if ((this.propName == "indexOf" || this.propName == "lastIndexOf") && this.arguments.length == 1) {
                let type = scope.root.typeHelper.getCType(propAccess.expression);
                if (type == StringVarType && this.propName == "indexOf") {
                    this.funcName = "str_pos";
                    scope.root.headerFlags.str_pos = true;
                } else if (type == StringVarType && this.propName == "lastIndexOf") {
                    this.funcName = "str_rpos";
                    scope.root.headerFlags.str_rpos = true;
                } else if (type instanceof ArrayType) {
                    this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "arr_pos");
                    this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(propAccess);
                    this.staticArraySize = type.isDynamicArray ? "" : type.capacity + "";
                    scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
                    scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
                    let arrayElementAccess = new CSimpleElementAccess(scope, type, this.varAccess, this.iteratorVarName); 
                    this.comparison = new CSimpleBinaryExpression(scope, arrayElementAccess, type.elementType, this.arg1, type.elementType, ts.SyntaxKind.EqualsEqualsToken, call);
                    scope.root.headerFlags.array = true;
                }
            }
        }
    }
}

@CodeTemplate(`ARRAY_INSERT({varAccess}, {startIndex}, {value});\n`)
class CInsertValue {
    constructor(scope: IScope, public varAccess: CElementAccess, public startIndex: CExpression, public value: CExpression) { }
}
