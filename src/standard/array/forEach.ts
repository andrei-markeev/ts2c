import * as ts from 'typescript';
import { ArrayType, NumberVarType } from '../../ctypes';
import { CElementAccess } from '../../nodes/elementaccess';
import { CodeTemplate, CodeTemplateFactory } from '../../template';
import { CVariable } from '../../nodes/variable';
import { IScope, CProgram } from '../../program';
import { StandardCallResolver, IResolver } from '../../standard';
import { TypeHelper } from '../../typehelper';

@StandardCallResolver
class ArrayForEachResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "forEach" && objType instanceof ArrayType;
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CArrayForEach(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
    public getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
        return node;
    }
}

@CodeTemplate(`
for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {
    {variables {   }=> {this};\n}
    {paramName} = {varAccess}[{iteratorVarName}];
    {statements {    }=> {this}}
}
`)
class CArrayForEach implements IScope {
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    public variables: CVariable[] = [];
    public statements: any[] = [];
    public iteratorFnAccess: CElementAccess = null;
    public iteratorVarName: string;
    public arraySize: string = '';
    public topExpressionOfStatement: boolean;
    public varAccess: string;
    public paramName: string;

    constructor(scope: IScope, call: ts.CallExpression) {
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;

        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = <ArrayType>scope.root.typeHelper.getCType(propAccess.expression);

        this.varAccess = CodeTemplateFactory.templateToString(<any>new CElementAccess(scope, propAccess.expression));
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(call);
        this.arraySize = objType.isDynamicArray ? this.varAccess + "->size" : objType.capacity + "";
        const iteratorFunc = <ts.FunctionExpression>call.arguments[0];
        scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));

        this.paramName = (<ts.Identifier>iteratorFunc.parameters[0].name).text;
        iteratorFunc.body.statements.forEach(s => this.statements.push(CodeTemplateFactory.createForNode(this, s)));
        this.variables.push(new CVariable(scope, this.paramName, objType.elementType));

    }

}
