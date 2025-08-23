import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolverMatchOptions, ITypeExtensionResolver } from '../../standard';
import { ArrayType, CType, NumberVarType, PointerVarType, UniversalVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { CAsUniversalVar } from '../../nodes/typeconvert';
import { TypeHelper } from '../../types/typehelper';
import { MaybeStandardCall } from '../../types/utils';

@StandardCallResolver('push')
class ArrayPushResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType, options: IResolverMatchOptions) {
        return memberType === UniversalVarType || memberType instanceof ArrayType && memberType.isDynamicArray || options && options.determineObjectType;
    }
    public objectType(typeHelper: TypeHelper, call: MaybeStandardCall) {
        const elementType = call.argumentList.elements[0] && typeHelper.getCType(call.argumentList.elements[0]);
        return new ArrayType(elementType || PointerVarType, 0, true);
    }
    public argumentTypes(typeHelper: TypeHelper, call: MaybeStandardCall) {
        let objType = typeHelper.getCType(call.expression.member);
        return call.argumentList.elements.map(a => objType instanceof ArrayType ? objType.elementType : null);
    }
    public returnType(typeHelper: TypeHelper, call: MaybeStandardCall) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: MaybeStandardCall) {
        return new CArrayPush(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: MaybeStandardCall) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: MaybeStandardCall) {
        return null;
    }
    public getEscapeNode(typeHelper: TypeHelper, node: MaybeStandardCall) {
        return node.expression.member;
    }
}

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement && isUniversalVar}
        {pushValues}
        {tempVarName} = ((struct array_js_var_t *){varAccess}.data)->size;
    {#elseif !topExpressionOfStatement && !isUniversalVar}
        {pushValues}
        {tempVarName} = {varAccess}->size;
    {/if}
{/statements}
{#if topExpressionOfStatement}
    {pushValues}
{#else}
    {tempVarName}
{/if}`)
class CArrayPush extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public varAccess: CElementAccess = null;
    public pushValues: CPushValue[] = [];
    public isUniversalVar: boolean = false;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        const propAccess = <kataw.IndexExpression>call.expression;
        const type = scope.root.typeHelper.getCType(propAccess.member);
        this.isUniversalVar = type === UniversalVarType;
        const argIsUniversalVar = type === UniversalVarType || type instanceof ArrayType && type.elementType === UniversalVarType;
        this.varAccess = new CElementAccess(scope, propAccess.member);
        const args = call.argumentList.elements.map(a => argIsUniversalVar ? new CAsUniversalVar(scope, a) : CodeTemplateFactory.createForNode(scope, a));
        this.pushValues = args.map(a => new CPushValue(scope, this.varAccess, type === UniversalVarType, a));
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_size");
            scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
        }
        scope.root.headerFlags.array = true;
    }

}

@CodeTemplate(`
{#if isUniversalVar}
    ARRAY_PUSH(((struct array_js_var_t *){varAccess}.data), {value});
{#else}
    ARRAY_PUSH({varAccess}, {value});
{/if}
`)
class CPushValue {
    constructor(scope: IScope, public varAccess: CElementAccess, public isUniversalVar: boolean, public value: CExpression) {}
}
