import * as ts from 'typescript';
import { CodeTemplate, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver, IResolverMatchOptions } from '../../standard';
import { ArrayType, NumberVarType, PointerVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver
class ArraySortResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression, options: IResolverMatchOptions) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "reverse" && (objType && objType instanceof ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    }
    public objectType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return new ArrayType(PointerVarType, 0, true);
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        return typeHelper.getCType(propAccess.expression);
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CArrayReverse(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return "";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
}

@CodeTemplate(`
{#statements}
    {iteratorVar1} = 0;
    {iteratorVar2} = {varAccess}->size - 1;
    while ({iteratorVar1} < {iteratorVar2}) {
        {tempVarName} = {varAccess}->data[{iteratorVar1}];
        {varAccess}->data[{iteratorVar1}] = {varAccess}->data[{iteratorVar2}];
        {varAccess}->data[{iteratorVar2}] = {tempVarName};
        {iteratorVar1}++;
        {iteratorVar2}--;
    }
{/statements}
{#if !topExpressionOfStatement}
    {varAccess}
{/if}`)
class CArrayReverse extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public varAccess: CElementAccess = null;
    public iteratorVar1: string;
    public iteratorVar2: string;
    public tempVarName: string;
    constructor(scope: IScope, call: ts.CallExpression) {
        super();
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let type = <ArrayType>scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = new CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.iteratorVar1 = scope.root.symbolsHelper.addIterator(call);
        this.iteratorVar2 = scope.root.symbolsHelper.addIterator(call);
        this.tempVarName = scope.root.symbolsHelper.addTemp(call, "temp");
        scope.variables.push(new CVariable(scope, this.iteratorVar1, NumberVarType));
        scope.variables.push(new CVariable(scope, this.iteratorVar2, NumberVarType));
        scope.variables.push(new CVariable(scope, this.tempVarName, type.elementType))
    }

}
