import * as kataw from 'kataw';
import { CodeTemplateFactory } from '../../template';
import { StandardCallResolver, IResolver } from '../../standard';
import { StringVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { TypeHelper } from '../../types/typehelper';
import { CElementAccess } from '../../nodes/elementaccess';
import { isFieldPropertyAccess } from '../../types/utils';

@StandardCallResolver
class StringToStringResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: kataw.CallExpression) {
        if (!isFieldPropertyAccess(call.expression) || !kataw.isIdentifier(call.expression.expression))
            return false;
        let objType = typeHelper.getCType(call.expression.member);
        return objType == StringVarType &&
            (call.expression.expression.text == "toString" || call.expression.expression.text == "valueOf");
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
