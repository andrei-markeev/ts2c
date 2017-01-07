import { IScope } from '../program';
import { StandardCallHelper } from '../resolver';
import { ConsoleLogHelper } from '../standard/console/log';
import { CodeTemplate, CodeTemplateFactory } from '../template';
import { CExpression } from './expressions';
import * as ts from 'typescript';

@CodeTemplate(`
{#statements}
    {#if printfCalls.length}
        {printfCalls => {this}\n}
    {/if}
{/statements}
{#if standardCall}
    {standardCall}
{#elseif printfCall}
    {printfCall}
{#else}
    {funcName}({arguments {, }=> {this}})
{/if}`, ts.SyntaxKind.CallExpression)
export class CCallExpression {
    public funcName: string;
    public standardCall: CExpression;
    public arguments: CExpression[];
    public printfCalls: any[] = [];
    public printfCall: any = null;
    constructor(scope: IScope, call: ts.CallExpression) {
        this.funcName = call.expression.getText();
        this.standardCall = StandardCallHelper.createTemplate(scope, call);

        if (this.standardCall)
            return;

        if (this.funcName != "console.log") {
            this.arguments = call.arguments.map(a => CodeTemplateFactory.createForNode(scope, a));
        }
        if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
            let propAccess = <ts.PropertyAccessExpression>call.expression;

            if (this.funcName == "console.log" && call.arguments.length) {
                for (let i = 0; i < call.arguments.length-1; i++)
                    this.printfCalls.push(ConsoleLogHelper.create(scope, call.arguments[i], i == call.arguments.length - 1));
                this.printfCall = ConsoleLogHelper.create(scope, call.arguments[call.arguments.length-1], true)
                scope.root.headerFlags.printf = true;
            }
        }
    }
}
