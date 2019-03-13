import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../../template';
import {StandardCallResolver, IResolver, IResolverMatchOptions} from '../../standard';
import {ArrayType, StringVarType, NumberVarType, TypeHelper, PointerVarType} from '../../types';
import {IScope} from '../../program';
import {CVariable} from '../../nodes/variable';
import {CExpression} from '../../nodes/expressions';
import {CElementAccess} from '../../nodes/elementaccess';

@StandardCallResolver
class ArraySortResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression, options: IResolverMatchOptions) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "sort" && (objType && objType instanceof ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    }
    public objectType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return new ArrayType(PointerVarType, 0, true);
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        return typeHelper.getCType(propAccess.expression);
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CArraySort(scope, node);
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
class CArraySort {
    public topExpressionOfStatement: boolean;
    public varAccess: CElementAccess = null;
    public arrayOfInts: boolean = false;
    public arrayOfStrings: boolean = false;
    constructor(scope: IScope, call: ts.CallExpression) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let type = <ArrayType>scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = new CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.arrayOfInts = type.elementType == NumberVarType;
        this.arrayOfStrings = type.elementType == StringVarType;

        if (this.arrayOfInts)
            scope.root.headerFlags.array_int16_t_cmp = true;
        else if (this.arrayOfStrings)
            scope.root.headerFlags.array_str_cmp = true;
    }

}
