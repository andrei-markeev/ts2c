import * as ts from 'typescript';
import { IScope } from '../program';
import { StandardCallHelper } from '../standard';
import { CodeTemplate, CodeTemplateFactory } from '../template';
import { CExpression } from './expressions';
import { CVariable, CVariableAllocation } from './variable';
import { FuncType, UniversalVarType } from '../types';
import { CAsUniversalVar } from './typeconvert';
import { isNullOrUndefined } from '../typeguards';
import { CObjectLiteralExpression } from './literals';

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

        this.standardCall = StandardCallHelper.createTemplate(scope, call);

        if (this.standardCall)
            return;

        this.funcName = CodeTemplateFactory.createForNode(scope, call.expression);
        this.arguments = call.arguments.concat(funcType.closureParams).map((a, i) => funcType.parameterTypes[i] === UniversalVarType ? new CAsUniversalVar(scope, a) : CodeTemplateFactory.createForNode(scope, a));
    }
}

@CodeTemplate(`
{#statements}
    {allocator}
{/statements}
{#if funcName}
    {funcName}({arguments {, }=> {this}})
{#elseif expression}
    {expression}
{#else}
    /* Unsupported 'new' expression {nodeText} */
{/if}`, ts.SyntaxKind.NewExpression)
export class CNew {
    public funcName: CExpression = "";
    public arguments: CExpression[];
    public allocator: CVariableAllocation | string = ""; 
    public expression: CExpression = "";
    public nodeText: string;
    constructor(scope: IScope, node: ts.NewExpression) {
        const decl = scope.root.typeHelper.getDeclaration(node.expression);
        if (decl && ts.isIdentifier(node.expression)) {
            const funcType = scope.root.typeHelper.getCType(decl) as FuncType;

            this.funcName = CodeTemplateFactory.createForNode(scope, node.expression);
            this.arguments = node.arguments.map(arg => CodeTemplateFactory.createForNode(scope, arg));
            
            const varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.variables.push(new CVariable(scope, varName, funcType.instanceType))
            this.arguments.unshift(varName);
            this.allocator = new CVariableAllocation(scope, varName, funcType.instanceType, node);
        } else if (ts.isIdentifier(node.expression) && node.expression.text === "Object") {
            if (node.arguments.length === 0 || isNullOrUndefined(node.arguments[0])) {
                const objLiteral: any = node;
                objLiteral.properties = [];
                this.expression = new CObjectLiteralExpression(scope, objLiteral);
            }
        }

        this.nodeText = node.getText();
    }
}