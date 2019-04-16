import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory, getAllNodesUnder} from '../template';
import {CVariable, CVariableDestructors} from './variable';
import {IScope, CProgram} from '../program';
import {FuncType, getTypeText} from '../types';
import { StandardCallHelper } from '../standard';
import { isEqualsExpression } from '../typeguards';

@CodeTemplate(`{returnType} {name}({parameters {, }=> {this}});`)
export class CFunctionPrototype {
    public returnType: string;
    public name: string;
    public parameters: CVariable[] = [];
    constructor(scope: IScope, node: ts.FunctionDeclaration) {
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
    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}

    {statements {    }=> {this}}

    {destructors}
}`)
export class CFunction implements IScope {
    public parent: IScope;
    public func = this;
    public funcDecl: CVariable;
    public name: string;
    public parameters: CVariable[] = [];
    public variables: CVariable[] = [];
    public statements: any[] = [];
    public gcVarNames: string[];
    public destructors: CVariableDestructors;

    constructor(public root: CProgram, node: ts.FunctionDeclaration | ts.FunctionExpression) {
        this.parent = root;

        this.name = node.name && node.name.text;
        if (!this.name) {
            let funcExprName = "func";
            if (isEqualsExpression(node.parent) && node.parent.right == node && ts.isIdentifier(node.parent.left))
                funcExprName = node.parent.left.text + "_func";
            if (ts.isVariableDeclaration(node.parent) && node.parent.initializer == node && ts.isIdentifier(node.parent.name))
                funcExprName = node.parent.name.text + "_func";
            this.name = root.symbolsHelper.addTemp(node, funcExprName);
        }
        const funcType = root.typeHelper.getCType(node) as FuncType;
        this.funcDecl = new CVariable(this, this.name, funcType.returnType, { removeStorageSpecifier: true, arraysToPointers: true });

        this.parameters = node.parameters.map((p, i) => {
            return new CVariable(this, (<ts.Identifier>p.name).text, funcType.parameterTypes[i], { removeStorageSpecifier: true });
        });
        if (funcType.instanceType)
            this.parameters.unshift(new CVariable(this, "this", funcType.instanceType, { removeStorageSpecifier: true }));
        for (let p of funcType.closureParams) {
            const type = root.typeHelper.getCType(p.node);
            this.parameters.push(new CVariable(this, p.node.text, type, { removeStorageSpecifier: true }));
        }

        this.variables = [];

        this.gcVarNames = root.memoryManager.getGCVariablesForScope(node);
        for (let gcVarName of this.gcVarNames) {
            if (root.variables.filter(v => v.name == gcVarName).length)
                continue;
            let gcType = gcVarName.indexOf("arrays") == -1 ? "ARRAY(void *)" : "ARRAY(ARRAY(void *))";
            root.variables.push(new CVariable(root, gcVarName, gcType));
        }

        node.body.statements.forEach(s => this.statements.push(CodeTemplateFactory.createForNode(this, s)));

        if (node.body.statements[node.body.statements.length - 1].kind != ts.SyntaxKind.ReturnStatement) {
            this.destructors = new CVariableDestructors(this, node);
        }

        const nodesInFunction = getAllNodesUnder(node);
        const declaredFunctionNames = root.functions.concat(root.functionPrototypes).map(f => f.name);
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

@CodeTemplate(``, ts.SyntaxKind.FunctionDeclaration)
export class CFunctionDeclaration {
    constructor(scope: IScope, node: ts.FunctionDeclaration) {
        scope.root.functions.push(new CFunction(scope.root, node));
    }
}

@CodeTemplate(`{name}`, ts.SyntaxKind.FunctionExpression)
export class CFunctionExpression {
    public name: string;

    constructor(scope: IScope, node: ts.FunctionExpression) {
        const dynamicFunction = new CFunction(scope.root, node);
        scope.root.functions.push(dynamicFunction);
        this.name = dynamicFunction.name;
    }
}