import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolverMatchOptions, ITypeExtensionResolver } from '../../standard';
import { ArrayType, CType, PointerVarType, UniversalVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CArrayAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver('shift')
class ArrayShiftResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType, options: IResolverMatchOptions) {
        return memberType === UniversalVarType || memberType instanceof ArrayType && memberType.isDynamicArray || options && options.determineObjectType;
    }
    public objectType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return new ArrayType(PointerVarType, 0, true);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        let propAccess = <kataw.IndexExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.member);
        if (objType instanceof ArrayType)    
            return objType.elementType;
        else if (objType === UniversalVarType)
            return UniversalVarType;
        else
            return null;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CArrayShift(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return null;
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return null;
    }
}

@CodeTemplate(`
{#statements}
    {tempVarName} = {arrayAccess}->data[0];
    ARRAY_REMOVE({arrayAccess}, 0, 1);
{/statements}
{#if !topExpressionOfStatement}
    {tempVarName}
{/if}`)
class CArrayShift extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public arrayAccess: CArrayAccess = null;
    public isUniversalVar: boolean = false;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        this.arrayAccess = new CArrayAccess(scope, propAccess.member);
        this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "value");
        let type = scope.root.typeHelper.getCType(propAccess.member);
        this.isUniversalVar = type === UniversalVarType;
        scope.variables.push(new CVariable(scope, this.tempVarName, type instanceof ArrayType ? type.elementType : UniversalVarType));
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_remove = true;
    }
}
