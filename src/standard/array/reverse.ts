import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolverMatchOptions, ITypeExtensionResolver } from '../../standard';
import { ArrayType, CType, NumberVarType, PointerVarType, UniversalVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CArrayAccess, CArraySize, CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver('reverse')
class ArrayReverseResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType, options: IResolverMatchOptions) {
        return memberType === UniversalVarType || memberType instanceof ArrayType && memberType.isDynamicArray || options && options.determineObjectType;
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
    {iteratorVar2} = {arraySize} - 1;
    while ({iteratorVar1} < {iteratorVar2}) {
        {tempVarName} = {arrayAccess}->data[{iteratorVar1}];
        {arrayAccess}->data[{iteratorVar1}] = {arrayAccess}->data[{iteratorVar2}];
        {arrayAccess}->data[{iteratorVar2}] = {tempVarName};
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
    public arrayAccess: CArrayAccess = null;
    public arraySize: CArraySize = null;
    public iteratorVar1: string;
    public iteratorVar2: string;
    public tempVarName: string;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        const propAccess = <kataw.IndexExpression>call.expression;
        const type = scope.root.typeHelper.getCType(propAccess.member);
        const elementType = type instanceof ArrayType ? type.elementType : UniversalVarType;
        this.arrayAccess = new CArrayAccess(scope, propAccess.member);
        this.arraySize = new CArraySize(scope, this.arrayAccess, type);
        this.varAccess = this.arrayAccess.varAccess;
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;
        this.iteratorVar1 = scope.root.symbolsHelper.addIterator(call);
        this.iteratorVar2 = scope.root.symbolsHelper.addIterator(call);
        this.tempVarName = scope.root.symbolsHelper.addTemp(call, "temp");
        scope.variables.push(new CVariable(scope, this.iteratorVar1, NumberVarType));
        scope.variables.push(new CVariable(scope, this.iteratorVar2, NumberVarType));
        scope.variables.push(new CVariable(scope, this.tempVarName, elementType))
    }

}
