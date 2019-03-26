import { IScope, CProgram } from '../program';
import { StandardCallHelper } from '../standard';
import { CodeTemplate, CodeTemplateFactory } from '../template';
import { CExpression } from './expressions';
import * as ts from 'typescript';
import {CFunction, CFunctionPrototype} from './function';

@CodeTemplate(`
{#if standardCall}
    {standardCall}
{#else}
    {funcName}({arguments {, }=> {this}})
{/if}`, ts.SyntaxKind.CallExpression)
export class CCallExpression {
    public funcName: string;
    public standardCall: CExpression;
    public arguments: CExpression[];
    constructor(scope: IScope, call: ts.CallExpression) {
        this.funcName = call.expression.getText();
        this.standardCall = StandardCallHelper.createTemplate(scope, call);

        if (this.standardCall)
            return;

        this.arguments = call.arguments.map(a => {
            return CodeTemplateFactory.createForNode(scope, a);
        });
    }
}
