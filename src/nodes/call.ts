import * as ts from 'typescript';
import { IScope } from '../program';
import { StandardCallHelper } from '../standard';
import { CodeTemplate, CodeTemplateFactory } from '../template';
import { CExpression } from './expressions';
import { CVariable, CVariableAllocation } from './variable';
import { FuncType, UniversalVarType } from '../types';
import { CAsUniversalVar } from './typeconvert';

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
        const funcType = decl && scope.root.typeHelper.getCType(decl) as FuncType;
        if (funcType && funcType.instanceType != null)
            return;

        this.funcName = call.expression.getText();
        this.standardCall = StandardCallHelper.createTemplate(scope, call);

        if (this.standardCall)
            return;

        this.arguments = call.arguments.map((a, i) => funcType.parameterTypes[i] === UniversalVarType ? new CAsUniversalVar(scope, a) : CodeTemplateFactory.createForNode(scope, a));
    }
}

@CodeTemplate(`
{#statements}
    {allocator}
{/statements}
{#if funcName}
    {funcName}({arguments {, }=> {this}})
{#else}
    /* Unsupported 'new' expression {nodeText} */
{/if}`, ts.SyntaxKind.NewExpression)
export class CNew {
    public funcName: CExpression = "";
    public arguments: CExpression[];
    public allocator: CVariableAllocation = null; 
    public nodeText: string;
    constructor(scope: IScope, node: ts.NewExpression) {
        if (ts.isIdentifier(node.expression)) {
            const decl = scope.root.typeHelper.getDeclaration(node.expression);
            const funcType = scope.root.typeHelper.getCType(decl) as FuncType;

            this.funcName = CodeTemplateFactory.createForNode(scope, node.expression);
            this.arguments = node.arguments.map(arg => CodeTemplateFactory.createForNode(scope, arg));
            
            const varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.variables.push(new CVariable(scope, varName, funcType.instanceType))
            this.arguments.unshift(varName);
            this.allocator = new CVariableAllocation(scope, varName, funcType.instanceType, node);
        }

        this.nodeText = node.getText();
    }
}