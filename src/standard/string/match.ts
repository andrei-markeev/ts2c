import * as kataw from 'kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver } from '../../standard';
import { ArrayType, RegexVarType, StringVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { getNodeText } from '../../types/utils';

@StandardCallResolver
export class StringMatchResolver implements IResolver {
    name: 'StringMatchResolver';
    public matchesNode(typeHelper: TypeHelper, call: kataw.CallExpression) {
        if (call.expression.kind != kataw.SyntaxKind.IndexExpression)
            return false;
        let propAccess = <kataw.IndexExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.member);
        return objType == StringVarType && getNodeText(propAccess.expression) == "match";
    }
    public objectType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return StringVarType;
    }
    public argumentTypes(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return call.argumentList.elements.map((a, i) => i == 0 ? RegexVarType : null);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return new ArrayType(StringVarType, 1, true);
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CStringMatch(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return node.parent.kind !== kataw.SyntaxKind.ExpressionStatement;
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return "match_array";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return null;
    }
}

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement}
        {matchArrayVarName} = regex_match({regexVar}, {argAccess});
    {/if}
    {#if !topExpressionOfStatement && gcVarName}
        ARRAY_PUSH({gcVarName}, (void *){matchArrayVarName});
    {/if}
{/statements}
{#if !topExpressionOfStatement}
    {matchArrayVarName}
{/if}`)
class CStringMatch extends CTemplateBase
{
    public topExpressionOfStatement: boolean = false;
    public regexVar: CExpression;
    public argAccess: CElementAccess;
    public matchArrayVarName: string;
    public gcVarName: string = null;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        scope.root.headerFlags.str_substring = true;
        let propAccess = <kataw.IndexExpression>call.expression;
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;

        if (!this.topExpressionOfStatement) {
            if (call.argumentList.elements.length == 1) {
                this.argAccess = new CElementAccess(scope, propAccess.member);
                this.regexVar = CodeTemplateFactory.createForNode(scope, call.argumentList.elements[0]);
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(call);
                this.matchArrayVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new CVariable(scope, this.matchArrayVarName, new ArrayType(StringVarType, 0, true)));
                scope.root.headerFlags.regex_match = true;
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.gc_iterator = true;
            } else
                console.log("Unsupported number of parameters in " + getNodeText(call) + ". Expected one parameter.");
        }
    }
}
