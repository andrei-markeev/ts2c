import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../template';
import { CVariable, CVariableDestructors, CVariableAllocation } from './variable';
import { IScope, CProgram } from '../program';
import { FuncType, getTypeText } from '../types/ctypes';
import { StandardCallHelper } from '../standard';
import { isEqualsExpression, findParentSourceFile, getAllNodesUnder, findParentFunction } from '../types/utils';
import { CExpression } from './expressions';

@CodeTemplate(`{returnType} {name}({parameters {, }=> {this}});`)
export class CFunctionPrototype extends CTemplateBase {
    public returnType: string;
    public name: string;
    public parameters: CVariable[] = [];
    constructor(scope: IScope, node: ts.FunctionDeclaration) {
        super();
        const funcType = scope.root.typeHelper.getCType(node) as FuncType;
        this.returnType = scope.root.typeHelper.getTypeString(funcType.returnType);

        this.name = node.name.getText();
        this.parameters = node.parameters.map((p, i) => new CVariable(scope, p.name.getText(), funcType.parameterTypes[i], { removeStorageSpecifier: true }));
        if (funcType.instanceType)
            this.parameters.unshift(new CVariable(scope, "this", funcType.instanceType, { removeStorageSpecifier: true }));
        for (let p of funcType.closureParams)
            this.parameters.push(new CVariable(scope, p.node.text, p.node, { removeStorageSpecifier: true }));
    }
}

@CodeTemplate(`
{funcDecl}({parameters {, }=> {this}})
{
    {variables  {    }=> {this};\n}
    {#if scopeVarAllocator != null}
        {scopeVarAllocator}
    {/if}
    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}

    {statements {    }=> {this}}

    {destructors}
}`)
export class CFunction extends CTemplateBase implements IScope {
    public parent: IScope;
    public func = this;
    public funcDecl: CVariable;
    public name: string;
    public parameters: CVariable[] = [];
    public variables: CVariable[] = [];
    public scopeVarAllocator: CVariableAllocation = null;
    public statements: CExpression[] = [];
    public gcVarNames: string[];
    public destructors: CVariableDestructors;

    constructor(public root: CProgram, node: ts.FunctionDeclaration | ts.FunctionExpression) {
        super();

        this.parent = root;

        this.name = node.name && node.name.text;
        if (!this.name) {
            let funcExprName = "func";
            if (isEqualsExpression(node.parent) && node.parent.right == node && ts.isIdentifier(node.parent.left))
                funcExprName = node.parent.left.text + "_func";
            if (ts.isVariableDeclaration(node.parent) && node.parent.initializer == node && ts.isIdentifier(node.parent.name))
                funcExprName = node.parent.name.text + "_func";
            if (ts.isPropertyAssignment(node.parent) && ts.isIdentifier(node.parent.name))
                funcExprName = node.parent.name.text + "_func";
            this.name = root.symbolsHelper.addTemp(findParentSourceFile(node), funcExprName);
        }
        const funcType = root.typeHelper.getCType(node) as FuncType;
        this.funcDecl = new CVariable(this, this.name, funcType.returnType, { removeStorageSpecifier: true, arraysToPointers: true });

        this.parameters = node.parameters.map((p, i) => {
            return new CVariable(this, (<ts.Identifier>p.name).text, funcType.parameterTypes[i], { removeStorageSpecifier: true });
        });
        if (funcType.instanceType)
            this.parameters.unshift(new CVariable(this, "this", funcType.instanceType, { removeStorageSpecifier: true }));
        if (funcType.needsClosureStruct) {
            const closureParamVarName = root.symbolsHelper.getClosureVarName(node);
            this.parameters.push(new CVariable(this, closureParamVarName, funcType));
        } else {
            for (let p of funcType.closureParams) {
                const type = root.typeHelper.getCType(p.node);
                const ptype = p.assigned ? getTypeText(type) + "*" : type;
                this.parameters.push(new CVariable(this, p.node.text, ptype, { removeStorageSpecifier: true }));
            }
        }

        if (funcType.scopeType) {
            const scopeVarName = root.symbolsHelper.getScopeVarName(node);
            this.variables.push(new CVariable(this, scopeVarName, funcType.scopeType));
            this.scopeVarAllocator = new CVariableAllocation(this, scopeVarName, funcType.scopeType, node);
        }

        this.gcVarNames = root.memoryManager.getGCVariablesForScope(node);
        for (let gcVarName of this.gcVarNames) {
            if (root.variables.filter(v => v.name == gcVarName).length)
                continue;
            let gcType = gcVarName.indexOf("arrays") == -1 ? "ARRAY(void *)" : "ARRAY(ARRAY(void *))";
            root.variables.push(new CVariable(root, gcVarName, gcType));
        }

        node.body.statements.forEach(s => this.statements.push(CodeTemplateFactory.createForNode(this, s)));

        if (node.body.statements.length > 0 && node.body.statements[node.body.statements.length - 1].kind != ts.SyntaxKind.ReturnStatement) {
            this.destructors = new CVariableDestructors(this, node);
        }

        const nodesInFunction = getAllNodesUnder(node);
        const declaredFunctionNames = (root.functions as {name: string}[]).concat(root.functionPrototypes).map(f => f.name);
        nodesInFunction.filter(n => ts.isCallExpression(n) && !StandardCallHelper.isStandardCall(root.typeHelper, n))
            .forEach((c: ts.CallExpression) => {
                if (ts.isIdentifier(c.expression) && declaredFunctionNames.indexOf(c.expression.text) === -1) {
                    const decl = root.typeHelper.getDeclaration(c.expression);
                    if (decl && decl !== node && ts.isFunctionDeclaration(decl)) {
                        root.functionPrototypes.push(new CFunctionPrototype(root, decl))
                        declaredFunctionNames.push(decl.name.text);
                    }
                }
            });
    }
}

@CodeTemplate(`
{#statements}
    {#if isClosureFunc}
        {closureParams => {scopeVarName}->{key} = {value};\n}
        {allocator}
        {closureVarName}->func = {name};
        {closureVarName}->scope = {scopeVarName};
    {/if}
{/statements}
{expression}`, [ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.FunctionDeclaration])
export class CFunctionExpression extends CTemplateBase {
    public name: string;
    public expression: string = '';

    public isClosureFunc: boolean = false;
    public allocator: CVariableAllocation;
    public closureVarName: string;
    public closureParams: { key: string, value: CExpression }[];
    public scopeVarName: string;

    constructor(scope: IScope, node: ts.FunctionExpression | ts.FunctionDeclaration) {
        super();

        const type = scope.root.typeHelper.getCType(node);
        const parentFunc = findParentFunction(node.parent);
        if (type instanceof FuncType && type.needsClosureStruct && parentFunc) {
            const parentFuncType = scope.root.typeHelper.getCType(parentFunc) as FuncType;
            this.isClosureFunc = true;
            this.closureVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            scope.root.symbolsHelper.ensureClosureStruct(type, parentFuncType, this.closureVarName);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.variables.push(new CVariable(scope, this.closureVarName, type));
            this.allocator = new CVariableAllocation(scope, this.closureVarName, type, node);

            /** since we're anyway passing the whole scope object, probably a good idea to move this fragment into @see CFunction */
            this.scopeVarName = parentFuncType && scope.root.symbolsHelper.getScopeVarName(node);
            const parentClosureVarName = parentFuncType && parentFuncType.needsClosureStruct && scope.root.symbolsHelper.getClosureVarName(parentFunc);
            const prefix = parentClosureVarName ? parentClosureVarName + "->scope->" : "";
            const closureParamsFromParent = parentFuncType.closureParams.map(p => ({ key: p.node.text, value: prefix + p.node.text }));
            const paramsFromParent = type.closureParams.filter(p => scope.root.typeHelper.getDeclaration(p.node).parent === parentFunc).map(p => ({ key: p.node.text, value: p.node.text }));
            this.closureParams = closureParamsFromParent.concat(paramsFromParent);
        }

        const func = new CFunction(scope.root, node);
        scope.root.functions.push(func);
        this.name = func.name;

        if (ts.isFunctionExpression(node))
            this.expression = this.closureVarName || func.name;
    }
}