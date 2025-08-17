import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolverMatchOptions, ITypeExtensionResolver } from '../../standard';
import { ArrayType, CType, PointerVarType, UniversalVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { MaybeStandardCall } from '../../types/utils';

@StandardCallResolver('pop')
class ArrayPopResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType, options: IResolverMatchOptions) {
        return memberType === UniversalVarType || memberType instanceof ArrayType && memberType.isDynamicArray || options && options.determineObjectType;
    }
    public objectType(typeHelper: TypeHelper, call: MaybeStandardCall) {
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
        return new CArrayPop(scope, node);
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
{#if isUniversalVar}
    JS_VAR_ARRAY_POP({varAccess})
{#else}
    ARRAY_POP({varAccess})
{/if}`)
class CArrayPop extends CTemplateBase {
    public varAccess: CElementAccess = null;
    public isUniversalVar = false;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        this.varAccess = new CElementAccess(scope, propAccess.member);
        this.isUniversalVar = scope.root.typeHelper.getCType(propAccess.member) === UniversalVarType;
        if (this.isUniversalVar) {
            scope.root.headerFlags.array = true;
            scope.root.headerFlags.js_var_pop = true;
        } else {
            scope.root.headerFlags.array = true;
            scope.root.headerFlags.array_pop = true;
        }
    }

}
