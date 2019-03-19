import * as ts from 'typescript';
import {ArrayType, StringVarType, NumberVarType, TypeHelper, StructType} from '../types';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {CVariable, CVariableDestructors} from './variable';
import {IScope, CProgram} from '../program';
import {StandardCallResolver, IResolver} from '../standard';
import { CExpression } from './expressions';
import { StandardCallHelper } from '../standard';

let anonymousNameCounter = 0;

@CodeTemplate(`{returnType} {name}({parameters {, }=> {this}});`)
export class CFunctionPrototype {
    public returnType: string;
    public name: string;
    public parameters: CVariable[] = [];
    constructor(scope: IScope, node: ts.FunctionDeclaration) {
        this.returnType = scope.root.typeHelper.getTypeString(node);

        this.name = node.name.getText();
        this.parameters = node.parameters.map(p => new CVariable(scope, p.name.getText(), p.name, { removeStorageSpecifier: true }));
    }
}

@CodeTemplate(`
{funcDecl}({parameters {, }=> {this}})
{
    {variables  {    }=> {this};\n}
    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}

    {statements {    }=> {this}}

    {destructors}
}`, ts.SyntaxKind.FunctionDeclaration)
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

        if (node.name) {
            this.name = node.name.getText();
        }
        else {
            this.name = `anonymousFunction${anonymousNameCounter++}`;
        }

        this.funcDecl = new CVariable(root, this.name, node, { removeStorageSpecifier: true });

        this.parameters = node.parameters.map(p => {
            return new CVariable(this, p.name.getText(), p.name, { removeStorageSpecifier: true });
        });
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
    }
}

@CodeTemplate(`{name}`, ts.SyntaxKind.FunctionExpression)
export class CFunctionExpression {
    public name: string;

    constructor(scope: IScope, expression: ts.FunctionExpression) {
        const dynamicFunction = new CFunction(scope.root, expression);
        scope.root.functions.push(dynamicFunction);
        this.name = dynamicFunction.name;
    }
}