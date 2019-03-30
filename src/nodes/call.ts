import * as ts from 'typescript';
import { IScope } from '../program';
import { StandardCallHelper } from '../standard';
import { CodeTemplate, CodeTemplateFactory } from '../template';
import { CExpression } from './expressions';
import { CVariable } from './variable';
import { FuncType } from '../types';

@CodeTemplate(`
{#if standardCall}
    {standardCall}
{#elseif funcName}
    {funcName}({arguments {, }=> {this}})
{#else}
    /* Not supported yet: calling function that references 'this'. Use 'new'. */
{/if}`, ts.SyntaxKind.CallExpression)
export class CCallExpression {
    public funcName: string = '';
    public standardCall: CExpression = '';
    public arguments: CExpression[];
    constructor(scope: IScope, call: ts.CallExpression) {

        // call of function that uses "this"
        const decl = scope.root.typeHelper.getDeclaration(call.expression);
        if (decl) {
            const funcType = scope.root.typeHelper.getCType(decl) as FuncType;
            if (funcType.instanceType != null)
                return;
        }

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
            const decl = scope.root.typeHelper.getDeclaration(node.expression);
            const funcType = scope.root.typeHelper.getCType(decl) as FuncType;

            this.funcName = CodeTemplateFactory.createForNode(scope, node.expression);
            this.arguments = node.arguments.map(arg => CodeTemplateFactory.createForNode(scope, arg));
            
            this.varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.variables.push(new CVariable(scope, this.varName, funcType.instanceType))
            this.arguments.unshift(this.varName);

            scope.root.headerFlags.malloc = true;
        }

        this.nodeText = node.getText();
    }
}