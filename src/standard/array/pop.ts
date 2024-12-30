import * as kataw from 'kataw';
import { CodeTemplate, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver, IResolverMatchOptions } from '../../standard';
import { ArrayType, PointerVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { isFieldPropertyAccess } from '../../types/utils';

@StandardCallResolver
class ArrayPopResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: kataw.CallExpression, options: IResolverMatchOptions) {
        if (!isFieldPropertyAccess(call.expression) || !kataw.isIdentifier(call.expression.expression))
            return false;
        let objType = typeHelper.getCType(call.expression.member);
        return call.expression.expression.text === "pop" && (objType instanceof ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    }
    public objectType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return new ArrayType(PointerVarType, 0, true);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        let propAccess = <kataw.IndexExpression>call.expression;
        let objType = <ArrayType>typeHelper.getCType(propAccess.member);
        return objType.elementType;
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

@CodeTemplate(`ARRAY_POP({varAccess})`)
class CArrayPop extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public varAccess: CElementAccess = null;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        this.varAccess = new CElementAccess(scope, propAccess.member);
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_pop = true;
    }

}
