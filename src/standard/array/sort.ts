import * as kataw from 'kataw';
import { CodeTemplate, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver, IResolverMatchOptions } from '../../standard';
import { ArrayType, StringVarType, NumberVarType, PointerVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { isFieldPropertyAccess } from '../../types/utils';

@StandardCallResolver
class ArraySortResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: kataw.CallExpression, options: IResolverMatchOptions) {
        if (!isFieldPropertyAccess(call.expression) || !kataw.isIdentifier(call.expression.expression))
            return false;
        let objType = typeHelper.getCType(call.expression.member);
        return call.expression.expression.text === "sort" && (objType instanceof ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    }
    public objectType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return new ArrayType(PointerVarType, 0, true);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        let propAccess = <kataw.IndexExpression>call.expression;
        return typeHelper.getCType(propAccess.member);
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CArraySort(scope, node);
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
    {#if !topExpressionOfStatement && arrayOfInts}
        qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_int16_t_cmp);
    {#elseif !topExpressionOfStatement && arrayOfStrings}
        qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_str_cmp);
    {/if}
{/statements}
{#if !topExpressionOfStatement}
    {varAccess}
{#elseif arrayOfInts}
    qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_int16_t_cmp);
{#elseif arrayOfStrings}
    qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_str_cmp);
{/if}`)
class CArraySort extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public varAccess: CElementAccess = null;
    public arrayOfInts: boolean = false;
    public arrayOfStrings: boolean = false;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        let type = <ArrayType>scope.root.typeHelper.getCType(propAccess.member);
        this.varAccess = new CElementAccess(scope, propAccess.member);
        this.topExpressionOfStatement = kataw.isStatementNode(call.parent);
        this.arrayOfInts = type.elementType == NumberVarType;
        this.arrayOfStrings = type.elementType == StringVarType;

        if (this.arrayOfInts)
            scope.root.headerFlags.array_int16_t_cmp = true;
        else if (this.arrayOfStrings)
            scope.root.headerFlags.array_str_cmp = true;
    }

}
