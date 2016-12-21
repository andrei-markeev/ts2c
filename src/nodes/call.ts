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
    {#if printfCalls.length}
        {printfCalls => {this}\n}
    {/if}
{/statements}
{#if standardCall}
    {standardCall}
{#elseif propName == "indexOf" && arguments.length == 1}
    {funcName}({varAccess}, {arg1})
{#elseif propName == "lastIndexOf" && arguments.length == 1}
    {funcName}({varAccess}, {arg1})
{#elseif printfCall}
    {printfCall}
{#else}
    {funcName}({arguments {, }=> {this}})
{/if}`, ts.SyntaxKind.CallExpression)
export class CCallExpression {
    public funcName: string;
    public propName: string = null;
    public standardCall: CExpression;
    public topExpressionOfStatement: boolean;
    public varAccess: CElementAccess;
    public arguments: CExpression[];
    public arg1: CExpression;
    public printfCalls: any[] = [];
    public printfCall: any = null;
    constructor(scope: IScope, call: ts.CallExpression) {
        this.funcName = call.expression.getText();
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.standardCall = StandardCallHelper.createTemplate(scope, call);

        if (this.standardCall)
            return;

        if (this.funcName != "console.log") {
            this.arguments = call.arguments.map(a => CodeTemplateFactory.createForNode(scope, a));
            this.arg1 = this.arguments[0];
        }
        if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
            let propAccess = <ts.PropertyAccessExpression>call.expression;
            this.propName = propAccess.name.getText();
            this.varAccess = new CElementAccess(scope, propAccess.expression);

            if (this.funcName == "console.log" && call.arguments.length) {
                for (let i = 0; i < call.arguments.length-1; i++)
                    this.printfCalls.push(ConsoleLogHelper.create(scope, call.arguments[i], i == call.arguments.length - 1));
                this.printfCall = ConsoleLogHelper.create(scope, call.arguments[call.arguments.length-1], true)
                scope.root.headerFlags.printf = true;
            }
            else if ((this.propName == "indexOf" || this.propName == "lastIndexOf") && this.arguments.length == 1) {
                let type = scope.root.typeHelper.getCType(propAccess.expression);
                if (type == StringVarType && this.propName == "indexOf") {
                    this.funcName = "str_pos";
                    scope.root.headerFlags.str_pos = true;
                } else if (type == StringVarType && this.propName == "lastIndexOf") {
                    this.funcName = "str_rpos";
                    scope.root.headerFlags.str_rpos = true;
                }
            }
        }
    }
}
