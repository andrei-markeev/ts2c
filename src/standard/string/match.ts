import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory } from '../../template';
import { StandardCallResolver, IResolver } from '../../standard';
import { ArrayType, NumberVarType, RegexMatchVarType, RegexVarType, StringVarType, TypeHelper } from '../../types';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { RegexBuilder, RegexMachine, RegexState } from '../../regex';

@StandardCallResolver
export class StringMatchResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "match" && objType == StringVarType;
    }
    public objectType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return StringVarType;
    }
    public argumentTypes(typeHelper: TypeHelper, call: ts.CallExpression) {
        return call.arguments.map((a, i) => i == 0 ? RegexVarType : null);
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return new ArrayType(StringVarType, 1, true);
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CStringMatch(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return "match_array";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
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
class CStringMatch
{
    public topExpressionOfStatement: boolean = false;
    public regexVar: CExpression;
    public argAccess: CElementAccess;
    public matchArrayVarName: string;
    public gcVarName: string = null;
    constructor(scope: IScope, call: ts.CallExpression) {
        scope.root.headerFlags.str_substring = true;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;

        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                this.argAccess = new CElementAccess(scope, propAccess.expression);
                this.regexVar = CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(call);
                this.matchArrayVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new CVariable(scope, this.matchArrayVarName, new ArrayType(StringVarType, 0, true)));
                scope.root.headerFlags.regex_match = true;
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.gc_iterator = true;
            } else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
    }
}
