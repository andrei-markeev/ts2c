import * as kataw from '@andrei-markeev/kataw';
import { IScope } from '../program';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../template';
import { CExpression } from './expressions';
import { CVariable, CVariableAllocation } from './variable';
import { FuncType, UniversalVarType, PointerVarType } from '../types/ctypes';
import { CAsUniversalVar } from './typeconvert';
import { isNullOrUndefined, findParentFunction, getNodeText, isMaybeStandardCall, isFunctionDeclaration } from '../types/utils';
import { CObjectLiteralExpression } from './literals';
import { CAssignment } from './assignment';

@CodeTemplate(`
{#if standardCall}
    {standardCall}
{#elseif isSimpleClosureCall}
    {funcName}->func({arguments {, }=> {this}})
{#elseif closureVarName}
    ({closureVarName} = {funcName}, {closureVarName}->func({arguments {, }=> {this}}))
{#elseif funcName}
    {funcName}({arguments {, }=> {this}})
{#else}
    /* Unsupported function call: {nodeText} */
{/if}`, kataw.SyntaxKind.CallExpression)
export class CCallExpression extends CTemplateBase {
    public funcName: CExpression = null;
    public standardCall: CExpression = null;
    public arguments: CExpression[];
    public isSimpleClosureCall: boolean = false;
    public closureVarName: string = null;
    public nodeText: string;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();

        this.standardCall = isMaybeStandardCall(call) && scope.root.standardCallHelper.createTemplate(scope, call);
        if (this.standardCall)
            return;

        const symbol = scope.root.symbolsHelper.getSymbolAtLocation(call.expression);
        if (symbol && symbol.resolver)
            this.standardCall = symbol.resolver.createTemplate(scope, call);
        if (this.standardCall)
            return;

        // calling function that uses "this"
        const funcType = scope.root.typeHelper.getCType(call.expression) as FuncType;
        if (!funcType || !(funcType instanceof FuncType) || funcType.instanceType != null) {
            this.nodeText = getNodeText(call);
            return;
        }

        this.funcName = CodeTemplateFactory.createForNode(scope, call.expression);
        this.arguments = call.argumentList.elements.map((a, i) => funcType.parameterTypes[i] === UniversalVarType ? new CAsUniversalVar(scope, a) : CodeTemplateFactory.createForNode(scope, a));
        if (funcType.argumentsType) {
            const argumentsArrayVarName = scope.root.symbolsHelper.addTemp(call, "args");
            const argsCount = this.arguments.length;
            scope.variables.push(new CVariable(scope, argumentsArrayVarName, funcType.argumentsType));
            scope.statements.push(new CVariableAllocation(scope, argumentsArrayVarName, funcType.argumentsType, call));
            for (let i = 0; i < this.arguments.length; i++) {
                let assignment = new CAssignment(scope, argumentsArrayVarName, i + "", funcType.argumentsType, call.argumentList.elements[i])
                scope.statements.push(assignment);
            }
            if (kataw.isIdentifier(call.expression)) {
                const func = scope.root.typeHelper.getDeclaration(call.expression);
                if (isFunctionDeclaration(func.parent))
                    this.arguments.length = func.parent.formalParameterList.formalParameters.length;
            } else
                console.error("Unsupported call expression for arguments array!")

            this.arguments.push(argumentsArrayVarName);
            this.arguments.push(argsCount+"");
        }
        if (funcType.needsClosureStruct) {
            // nested calls e.g. `func(1, 2)()`;
            if (this.funcName instanceof CCallExpression) {
                this.closureVarName = scope.root.symbolsHelper.addTemp(call, "tmp_closure");
                scope.variables.push(new CVariable(scope, this.closureVarName, funcType));
                this.arguments.push(this.closureVarName)
            } else {
                this.arguments.push(this.funcName);
                this.isSimpleClosureCall = true;
            }
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
{#if standardCall}
    {standardCall}
{#elseif funcName}
    {funcName}({arguments {, }=> {this}})
{#elseif expression}
    {expression}
{#else}
    /* Unsupported 'new' expression {nodeText} */
{/if}`, kataw.SyntaxKind.NewExpression)
export class CNew extends CTemplateBase {
    public funcName: CExpression = "";
    public arguments: CExpression[];
    public allocator: CVariableAllocation | string = ""; 
    public expression: CExpression = "";
    public nodeText: string;
    public standardCall: CExpression = "";
    constructor(scope: IScope, node: kataw.NewExpression) {
        super();

        const symbol = scope.root.symbolsHelper.getSymbolAtLocation(node.expression);
        if (symbol && symbol.resolver)
            this.standardCall = symbol.resolver.createTemplate(scope, node);
        if (this.standardCall)
            return;

        const decl = kataw.isIdentifier(node.expression) ? scope.root.typeHelper.getDeclaration(node.expression) : null;
        if (decl) {
            const funcType = scope.root.typeHelper.getCType(decl) as FuncType;

            this.funcName = CodeTemplateFactory.createForNode(scope, node.expression);
            this.arguments = node.argumentList.elements.map(arg => CodeTemplateFactory.createForNode(scope, arg));
            
            const varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.variables.push(new CVariable(scope, varName, funcType.instanceType))
            this.arguments.unshift(varName);
            this.allocator = new CVariableAllocation(scope, varName, funcType.instanceType, node);
            return;
        } else if (kataw.isIdentifier(node.expression) && node.expression.text === "Object") {
            const isRootScopeObject = scope.root.symbolsHelper.findSymbolScope(node.expression).parent === undefined;
            if (isRootScopeObject && node.argumentList.elements.length === 0 || isNullOrUndefined(node.argumentList.elements[0])) {
                const propList = kataw.createPropertyDefinitionList([], false, kataw.NodeFlags.None, -1, -1);
                const objLiteral = kataw.createObjectLiteral(propList, kataw.NodeFlags.None, -1, -1);
                objLiteral.parent = node;
                scope.root.typeHelper.registerSyntheticNode(objLiteral, PointerVarType);
                this.expression = new CObjectLiteralExpression(scope, objLiteral);
            }
            return;
        }

        this.nodeText = getNodeText(node);
    }
}