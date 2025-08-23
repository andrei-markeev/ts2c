import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolverMatchOptions, ITypeExtensionResolver } from '../../standard';
import { ArrayType, CType, NumberVarType, PointerVarType, UniversalVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { CAsUniversalVar } from '../../nodes/typeconvert';

@StandardCallResolver('unshift')
class ArrayUnshiftResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType, options: IResolverMatchOptions) {
        return memberType === UniversalVarType || memberType instanceof ArrayType && memberType.isDynamicArray || options && options.determineObjectType;
    }
    public objectType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        let elementType = call.argumentList.elements[0] && typeHelper.getCType(call.argumentList.elements[0]);
        return new ArrayType(elementType || PointerVarType, 0, true);
    }
    public argumentTypes(typeHelper: TypeHelper, call: kataw.CallExpression) {
        let propAccess = <kataw.IndexExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.member);
        return call.argumentList.elements.map(a => objType instanceof ArrayType ? objType.elementType : null);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CArrayUnshift(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return null;
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return (<kataw.IndexExpression>node.expression).member;
    }
}

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement && isUniversalVar}
        {unshiftValues}
        {tempVarName} = ((struct array_js_var_t *){varAccess}.data)->size;
    {#elseif !topExpressionOfStatement && !isUniversalVar}
        {unshiftValues}
        {tempVarName} = {varAccess}->size;
    {/if}
{/statements}
{#if topExpressionOfStatement}
    {unshiftValues}
{#else}
    {tempVarName}
{/if}`)
class CArrayUnshift extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public varAccess: CElementAccess = null;
    public unshiftValues: CUnshiftValue[] = [];
    public isUniversalVar: boolean = false;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        this.varAccess = new CElementAccess(scope, propAccess.member);
        const type = scope.root.typeHelper.getCType(propAccess.member);
        this.isUniversalVar = type === UniversalVarType;
        const argIsUniversalVar = type === UniversalVarType || type instanceof ArrayType && type.elementType === UniversalVarType;
        let args = call.argumentList.elements.map(a => argIsUniversalVar ? new CAsUniversalVar(scope, a) : CodeTemplateFactory.createForNode(scope, a));
        this.unshiftValues = args.reverse().map(a => new CUnshiftValue(scope, this.varAccess, type === UniversalVarType, a));
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_size");
            scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
        }
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_insert = true;
    }

}

@CodeTemplate(`
{#if isUniversalVar}
    ARRAY_INSERT(((struct array_js_var_t *){varAccess}.data), 0, {value});\n
{#else}
    ARRAY_INSERT({varAccess}, 0, {value});\n
{/if}
`)
class CUnshiftValue extends CTemplateBase {
    constructor(scope: IScope, public varAccess: CElementAccess, public isUniversalVar: boolean, public value: CExpression) { super() }
}
