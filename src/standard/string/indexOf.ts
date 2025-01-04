import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, ITypeExtensionResolver } from '../../standard';
import { StringVarType, NumberVarType, CType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { getNodeText } from '../../types/utils';

@StandardCallResolver('indexOf')
class StringIndexOfResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType) {
        return memberType === StringVarType;
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CStringIndexOf(scope, node);
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
{#if !topExpressionOfStatement}
    str_pos({stringAccess}, {arg1})
{/if}`)
class CStringIndexOf extends CTemplateBase
{
    public topExpressionOfStatement: boolean;
    public arg1: CExpression;
    public stringAccess: CElementAccess;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.argumentList.elements.length == 1) {
                this.stringAccess = new CElementAccess(scope, propAccess.member);
                this.arg1 = CodeTemplateFactory.createForNode(scope, call.argumentList.elements[0]);
                scope.root.headerFlags.str_pos = true;
            } else
                console.log("Unsupported number of parameters in " + getNodeText(call) + ". Expected one parameter.");
        }
    }
}
