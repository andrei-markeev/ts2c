import * as kataw from 'kataw';
import { CodeTemplate, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver, IResolverMatchOptions } from '../../standard';
import { ArrayType, NumberVarType, PointerVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { isFieldPropertyAccess } from '../../types/utils';

@StandardCallResolver
class ArrayReverseResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: kataw.CallExpression, options: IResolverMatchOptions) {
        if (!isFieldPropertyAccess(call.expression) || !kataw.isIdentifier(call.expression.expression))
            return false;
        let objType = typeHelper.getCType(call.expression.member);
        return call.expression.expression.text === "reverse" && (objType instanceof ArrayType && objType.isDynamicArray || options && options.determineObjectType);
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
        this.topExpressionOfStatement = kataw.isStatementNode(call.parent);
        this.iteratorVar1 = scope.root.symbolsHelper.addIterator(call);
        this.iteratorVar2 = scope.root.symbolsHelper.addIterator(call);
        this.tempVarName = scope.root.symbolsHelper.addTemp(call, "temp");
        scope.variables.push(new CVariable(scope, this.iteratorVar1, NumberVarType));
        scope.variables.push(new CVariable(scope, this.iteratorVar2, NumberVarType));
        scope.variables.push(new CVariable(scope, this.tempVarName, type.elementType))
    }

}
