import * as kataw from 'kataw';
import { CodeTemplate, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolverMatchOptions, ITypeExtensionResolver } from '../../standard';
import { ArrayType, CType, NumberVarType, PointerVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver('reverse')
class ArrayReverseResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType, options: IResolverMatchOptions) {
        return memberType instanceof ArrayType && memberType.isDynamicArray || options && options.determineObjectType;
    }
    public objectType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return new ArrayType(PointerVarType, 0, true);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        let propAccess = <kataw.IndexExpression>call.expression;
        return typeHelper.getCType(propAccess.member);
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CArrayReverse(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return "";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
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
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        let type = <ArrayType>scope.root.typeHelper.getCType(propAccess.member);
        this.varAccess = new CElementAccess(scope, propAccess.member);
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;
        this.iteratorVar1 = scope.root.symbolsHelper.addIterator(call);
        this.iteratorVar2 = scope.root.symbolsHelper.addIterator(call);
        this.tempVarName = scope.root.symbolsHelper.addTemp(call, "temp");
        scope.variables.push(new CVariable(scope, this.iteratorVar1, NumberVarType));
        scope.variables.push(new CVariable(scope, this.iteratorVar2, NumberVarType));
        scope.variables.push(new CVariable(scope, this.tempVarName, type.elementType))
    }

}
