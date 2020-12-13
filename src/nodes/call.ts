import * as ts from 'typescript';
import { IScope } from '../program';
import { StandardCallHelper } from '../standard';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../template';
import { CExpression } from './expressions';
import { CVariable, CVariableAllocation } from './variable';
import { FuncType, UniversalVarType, StructType, PointerVarType } from '../types/ctypes';
import { CAsUniversalVar } from './typeconvert';
import { isNullOrUndefined, findParentFunction } from '../types/utils';
import { CObjectLiteralExpression } from './literals';

@CodeTemplate(`
{#if standardCall}
    {standardCall}
{#elseif funcName}
    {funcName}({arguments {, }=> {this}})
{#else}
    /* Unsupported function call: {nodeText} */
{/if}`, ts.SyntaxKind.CallExpression)
export class CCallExpression extends CTemplateBase {
    public funcName: CExpression = null;
    public standardCall: CExpression = null;
    public arguments: CExpression[];
    public nodeText: string;
    constructor(scope: IScope, call: ts.CallExpression) {
        super();

        this.standardCall = StandardCallHelper.createTemplate(scope, call);
        if (this.standardCall)
            return;

        // calling function that uses "this"
        const funcType = scope.root.typeHelper.getCType(call.expression) as FuncType;
        if (!funcType || funcType.instanceType != null) {
            this.nodeText = call.getText();
            return;
        }

        this.funcName = CodeTemplateFactory.createForNode(scope, call.expression);
        this.arguments = call.arguments.map((a, i) => funcType.parameterTypes[i] === UniversalVarType ? new CAsUniversalVar(scope, a) : CodeTemplateFactory.createForNode(scope, a));
        if (funcType.needsClosureStruct) {
            this.arguments.push(this.funcName);
            this.funcName = CodeTemplateFactory.templateToString(this.funcName) + "->func";
        } else {
            for (let p of funcType.closureParams) {
                const parentFunc = findParentFunction(call);
                const funcType = scope.root.typeHelper.getCType(parentFunc) as FuncType;
                const closureVarName = funcType && funcType.needsClosureStruct && scope.root.symbolsHelper.getClosureVarName(parentFunc);
                let value = p.node.text;
                if (closureVarName && funcType.closureParams.some(p => p.node.text === value))
                    value = closureVarName + "->scope->" + value;
                this.arguments.push((p.assigned ? "&" : "") + value);
            }
        }
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
export class CNew extends CTemplateBase {
    public funcName: CExpression = "";
    public arguments: CExpression[];
    public allocator: CVariableAllocation | string = ""; 
    public expression: CExpression = "";
    public nodeText: string;
    constructor(scope: IScope, node: ts.NewExpression) {
        super();

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
                const objLiteral = ts.createObjectLiteral();
                objLiteral.parent = node;
                scope.root.typeHelper.registerSyntheticNode(objLiteral, PointerVarType);
                this.expression = new CObjectLiteralExpression(scope, objLiteral);
            }
        }

        this.nodeText = node.getText();
    }
}