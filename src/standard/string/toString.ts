import * as ts from 'typescript';
import { CodeTemplateFactory } from '../../template';
import { StandardCallResolver, IResolver } from '../../standard';
import { StringVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver
class StringToStringResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return ["toString", "valueOf"].indexOf(propAccess.name.getText()) > -1 && objType == StringVarType;
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return StringVarType;
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return CodeTemplateFactory.createForNode(scope, <ts.PropertyAccessExpression>node.expression);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
    public getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
}
