import * as kataw from 'kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver } from '../../standard';
import { StringVarType, NumberVarType, RegexVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { getNodeText, isFieldPropertyAccess } from '../../types/utils';

@StandardCallResolver
class StringSearchResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: kataw.CallExpression) {
        if (!isFieldPropertyAccess(call.expression) || !kataw.isIdentifier(call.expression.member))
            return false;
        let objType = typeHelper.getCType(call.expression.member);
        return call.expression.expression.text == "search" && objType == StringVarType;
    }
    public objectType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return StringVarType;
    }
    public argumentTypes(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return call.argumentList.elements.map((a, i) => i == 0 ? RegexVarType : null);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CStringSearch(scope, node);
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
    {regexVar}.func({argAccess}, FALSE).index
{/if}`)
class CStringSearch extends CTemplateBase
{
    public topExpressionOfStatement: boolean;
    public regexVar: CExpression;
    public argAccess: CElementAccess;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.argumentList.elements.length == 1) {
                this.argAccess = new CElementAccess(scope, propAccess.member);
                this.regexVar = CodeTemplateFactory.createForNode(scope, call.argumentList.elements[0]);
            } else
                console.log("Unsupported number of parameters in " + getNodeText(call) + ". Expected one parameter.");
        }
    }
}
