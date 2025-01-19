import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../template';
import { CVariable, CVariableDestructors, CVariableAllocation } from './variable';
import { IScope, CProgram } from '../program';
import { FuncType, getTypeText } from '../types/ctypes';
import { isEqualsExpression, findParentSourceFile, getAllNodesUnder, findParentFunction, getNodeText, isPropertyDefinition, isVariableDeclaration, isCall, isFunctionDeclaration, isFunctionExpression, isMaybeStandardCall } from '../types/utils';
import { CExpression } from './expressions';

@CodeTemplate(`{funcDecl}({parameters {, }=> {this}});`)
export class CFunctionPrototype extends CTemplateBase {
    public funcDecl: CVariable;
    public name: string;
    public parameters: (CVariable | string)[] = [];
    constructor(scope: IScope, node: kataw.FunctionDeclaration) {
        super();
        this.name = node.name.text;

        const funcType = scope.root.typeHelper.getCType(node) as FuncType;
        this.funcDecl = new CVariable(scope, this.name, funcType.returnType, { removeStorageSpecifier: true, arraysToPointers: true, funcDecl: true });

        this.parameters = node.formalParameterList.formalParameters.map((p, i) => 
            kataw.isIdentifier(p) ?
                new CVariable(scope, p.text, funcType.parameterTypes[i], { removeStorageSpecifier: true })
                : "/* unsupported parameter '" + getNodeText(p) + "' */"
        );
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
    public parameters: (CVariable | string)[] = [];
    public variables: CVariable[] = [];
    public scopeVarAllocator: CVariableAllocation = null;
    public statements: CExpression[] = [];
    public gcVarNames: string[];
    public destructors: CVariableDestructors;

    constructor(public root: CProgram, node: kataw.FunctionDeclaration | kataw.FunctionExpression) {
        super();

        this.parent = root;

        this.name = node.name && node.name.text;
        if (!this.name) {
            let funcExprName = "func";
            if (isEqualsExpression(node.parent) && node.parent.right == node && kataw.isIdentifier(node.parent.left))
                funcExprName = node.parent.left.text + "_func";
            else if (isVariableDeclaration(node.parent) && node.parent.initializer == node && kataw.isIdentifier(node.parent.binding))
                funcExprName = node.parent.binding.text + "_func";
            else if (isPropertyDefinition(node.parent) && kataw.isIdentifier(node.parent.left))
                funcExprName = node.parent.left.text + "_func";
            this.name = root.symbolsHelper.addTemp(findParentSourceFile(node), funcExprName);
        }
        const funcType = root.typeHelper.getCType(node) as FuncType;
        this.funcDecl = new CVariable(this, this.name, funcType.returnType, { removeStorageSpecifier: true, arraysToPointers: true, funcDecl: true });

        this.parameters = node.formalParameterList.formalParameters.map((p, i) =>
            kataw.isIdentifier(p) ?
                new CVariable(this, p.text, funcType.parameterTypes[i], { removeStorageSpecifier: true })
                : "/* unsupported parameter '" + getNodeText(p) + "' */"
        );
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
            root.headerFlags.array_pointer_t = true;
            const simplePointerArray = "struct array_pointer_t *"
            let gcType = simplePointerArray;
            if (gcVarName.indexOf("_arrays") > -1) gcType = "ARRAY(struct array_pointer_t *)";
            if (gcVarName.indexOf("_arrays_c") > -1) gcType = "ARRAY(ARRAY(struct array_pointer_t *))";
            if (gcVarName.indexOf("_dicts") > -1) gcType = "ARRAY(DICT(void *))";
            if (gcType !== simplePointerArray)
                root.headerFlags.gc_array = true;
            root.variables.push(new CVariable(root, gcVarName, gcType));
        }

        const statements = node.contents.functionStatementList.statements;
        statements.forEach(s => this.statements.push(CodeTemplateFactory.createForNode(this, s)));

        if (statements.length > 0 && statements[statements.length - 1].kind != kataw.SyntaxKind.ReturnStatement) {
            this.destructors = new CVariableDestructors(this, node);
        }

        if (node.name) {
            const nodesInFunction = getAllNodesUnder(node);
            const declaredFunctionNames = new Set<string>();
            declaredFunctionNames.add(node.name.text);
            for (const func of root.functions)
                if ('name' in func)
                    declaredFunctionNames.add(func.name);
            for (const funcProt of root.functionPrototypes)
                declaredFunctionNames.add(funcProt.name);
            for (let n of nodesInFunction) {
                if (kataw.isIdentifier(n) && !declaredFunctionNames.has(n.text)) {
                    const decl = root.typeHelper.getDeclaration(n);
                    if (decl && decl.id !== n.id && isFunctionDeclaration(decl.parent)) {
                        root.functionPrototypes.push(new CFunctionPrototype(root, decl.parent))
                        declaredFunctionNames.add(decl.text);
                    }
                }
            }
        }
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
{expression}`, [kataw.SyntaxKind.FunctionExpression, kataw.SyntaxKind.FunctionDeclaration])
export class CFunctionExpression extends CTemplateBase {
    public name: string;
    public expression: string = '';

    public isClosureFunc: boolean = false;
    public allocator: CVariableAllocation;
    public closureVarName: string;
    public closureParams: { key: string, value: CExpression }[];
    public scopeVarName: string;

    constructor(scope: IScope, node: kataw.FunctionExpression | kataw.FunctionDeclaration) {
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
            const paramsFromParent = type.closureParams.filter(p => scope.root.typeHelper.getDeclaration(p.node).parent.parent === parentFunc).map(p => ({ key: p.node.text, value: p.node.text }));
            this.closureParams = closureParamsFromParent.concat(paramsFromParent);
        }

        const func = new CFunction(scope.root, node);
        scope.root.functions.push(func);
        this.name = func.name;

        if (isFunctionExpression(node))
            this.expression = this.closureVarName || func.name;
    }
}