import * as ts from 'typescript';
import { IScope } from '../program';
import { StandardCallHelper } from '../standard';
import { CodeTemplate, CodeTemplateFactory } from '../template';
import { CExpression } from './expressions';
import { CVariable } from './variable';

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

@CodeTemplate(`
{#statements}
    {#if funcName}
        {varName} = malloc(sizeof(*{varName}));
        assert({varName} != NULL);
    {/if}
{/statements}
{#if funcName}
    {funcName}({arguments {, }=> {this}})
{#else}
    /* Unsupported 'new' expression {nodeText} */
{/if}`, ts.SyntaxKind.NewExpression)
export class CNew {
    public funcName: CExpression = "";
    public arguments: CExpression[];
    public varName: string;
    public nodeText: string;
    constructor(scope: IScope, node: ts.NewExpression) {
        if (ts.isIdentifier(node.expression)) {
            this.funcName = CodeTemplateFactory.createForNode(scope, node.expression);
            this.arguments = node.arguments.map(arg => CodeTemplateFactory.createForNode(scope, arg));
            
            this.varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.variables.push(new CVariable(scope, this.varName, scope.root.typeHelper.getInstanceType(node.expression)))
            this.arguments.unshift(this.varName);

            scope.root.headerFlags.malloc = true;
        }

        this.nodeText = node.getText();
    }
}