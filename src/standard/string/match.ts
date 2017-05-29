import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory } from '../../template';
import { StandardCallResolver, IResolver } from '../../resolver';
import { ArrayType, NumberVarType, RegexMatchVarType, RegexVarType, StringVarType, TypeHelper } from '../../types';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { RegexBuilder, RegexMachine, RegexState } from '../../regex';

@StandardCallResolver
class StringMatchResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "match" && objType == StringVarType;
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return new ArrayType(StringVarType, 1, false);
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CStringMatch(scope, node);
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

@CodeTemplate(`
{#statements}
    {matchVarName} = {regexVar}.func({argAccess});
{/statements}
{#if !topExpressionOfStatement}
    str_substring({argAccess}, {matchVarName}.index, {matchVarName}.end)
{/if}`)
class CStringMatch
{
    public topExpressionOfStatement: boolean;
    public regexVar: CExpression;
    public argAccess: CElementAccess;
    public matchVarName: string;
    constructor(scope: IScope, call: ts.CallExpression) {
        scope.root.headerFlags.str_substring = true;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                this.argAccess = new CElementAccess(scope, propAccess.expression);
                this.regexVar = CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                this.matchVarName = scope.root.typeHelper.addNewTemporaryVariable(call, "match_info");
                scope.variables.push(new CVariable(scope, this.matchVarName, RegexMatchVarType));
            } else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
    }
}
