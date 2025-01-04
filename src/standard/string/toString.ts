import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplateFactory } from '../../template';
import { StandardCallResolver, ITypeExtensionResolver } from '../../standard';
import { CType, StringVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { TypeHelper } from '../../types/typehelper';
import { CElementAccess } from '../../nodes/elementaccess';

@StandardCallResolver('toString', 'valueOf')
class StringToStringResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType) {
        return memberType === StringVarType;
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return StringVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return CodeTemplateFactory.createForNode(scope, <kataw.IndexExpression>node.expression) as CElementAccess;
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
