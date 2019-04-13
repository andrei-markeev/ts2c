import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory, getAllNodesUnder} from '../template';
import {CVariable, CVariableDestructors} from './variable';
import {IScope, CProgram} from '../program';
import {FuncType} from '../types';
import { StandardCallHelper } from '../standard';

@CodeTemplate(`{returnType} {name}({parameters {, }=> {this}});`)
export class CFunctionPrototype {
    public returnType: string;
    public name: string;
    public parameters: CVariable[] = [];
    constructor(scope: IScope, node: ts.FunctionDeclaration) {
        const type = scope.root.typeHelper.getCType(node) as FuncType;
        this.returnType = scope.root.typeHelper.getTypeString(type.returnType);

        this.name = node.name.getText();
        this.parameters = node.parameters.map((p, i) => new CVariable(scope, p.name.getText(), type.parameterTypes[i], { removeStorageSpecifier: true }));
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

        this.name = node.name.getText();
        const funcType = root.typeHelper.getCType(node) as FuncType;
        this.funcDecl = new CVariable(root, this.name, funcType.returnType, { removeStorageSpecifier: true });

        this.parameters = node.parameters.map((p, i) => {
            return new CVariable(this, (<ts.Identifier>p.name).text, funcType.parameterTypes[i], { removeStorageSpecifier: true });
        });
        if (funcType.instanceType)
            this.parameters.unshift(new CVariable(this, "this", funcType.instanceType, { removeStorageSpecifier: true }));

        this.variables = [];

        this.gcVarNames = root.memoryManager.getGCVariablesForScope(node);
        for (let gcVarName of this.gcVarNames) {
            if (root.variables.filter(v => v.name == gcVarName).length)
                continue;
            let gcType = gcVarName.indexOf("arrays") == -1 ? "ARRAY(void *)" : "ARRAY(ARRAY(void *))";
            root.variables.push(new CVariable(root, gcVarName, gcType));
        }

        const nodesInFunction = getAllNodesUnder(node);
        const declaredFunctionNames = root.functions.map(f => f.name);
        nodesInFunction.filter(n => ts.isCallExpression(n) && !StandardCallHelper.isStandardCall(root.typeHelper, n))
            .forEach((c: ts.CallExpression) => {
                if (ts.isIdentifier(c.expression) && declaredFunctionNames.indexOf(c.expression.text) === -1) {
                    const decl = root.typeHelper.getDeclaration(c.expression);
                    if (decl)
                        root.functionPrototypes.push(new CFunctionPrototype(root, <ts.FunctionDeclaration>decl))
                }
            });

        node.body.statements.forEach(s => this.statements.push(CodeTemplateFactory.createForNode(this, s)));

        if (node.body.statements[node.body.statements.length - 1].kind != ts.SyntaxKind.ReturnStatement) {
            this.destructors = new CVariableDestructors(this, node);
        }
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