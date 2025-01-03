import * as kataw from 'kataw';
import { ArrayType, CType, FuncType, NumberVarType } from '../../types/ctypes';
import { CElementAccess } from '../../nodes/elementaccess';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { CVariable } from '../../nodes/variable';
import { IScope, CProgram } from '../../program';
import { StandardCallResolver, ITypeExtensionResolver } from '../../standard';
import { TypeHelper } from '../../types/typehelper';
import { CExpression } from '../../nodes/expressions';

@StandardCallResolver('forEach')
class ArrayForEachResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType) {
        return memberType instanceof ArrayType;
    }
    public argumentTypes(typeHelper: TypeHelper, call: kataw.CallExpression): CType[] {
        let objType = typeHelper.getCType((<kataw.IndexExpression>call.expression).member);
        return [new FuncType({ parameterTypes: [NumberVarType, NumberVarType, objType] })];
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CArrayForEach(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return null;
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
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
class CArrayForEach extends CTemplateBase implements IScope {
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    public iteratorFnAccess: CElementAccess = null;
    public iteratorVarName: string;
    public arraySize: string = '';
    public topExpressionOfStatement: boolean;
    public varAccess: string;
    public paramName: string;

    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;

        let propAccess = <kataw.IndexExpression>call.expression;
        let objType = <ArrayType>scope.root.typeHelper.getCType(propAccess.member);

        this.varAccess = CodeTemplateFactory.templateToString(new CElementAccess(scope, propAccess.member));
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(call);
        this.arraySize = objType.isDynamicArray ? this.varAccess + "->size" : objType.capacity + "";
        const iteratorFunc = <kataw.FunctionExpression>call.argumentList.elements[0];
        scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));

        this.paramName = (<kataw.Identifier>iteratorFunc.formalParameterList.formalParameters[0]).text;
        iteratorFunc.contents.functionStatementList.statements.forEach(s => this.statements.push(CodeTemplateFactory.createForNode(this, s)));
        this.variables.push(new CVariable(scope, this.paramName, objType.elementType));

    }

}
