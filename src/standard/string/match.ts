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
export class StringMatchResolver implements IResolver {
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
        {matchInfoVarName} = {regexVar}.func({argAccess});
        {matchArrayVarName}[0] = {matchInfoVarName}.index == -1 ? NULL : str_substring({argAccess}, {matchInfoVarName}.index, {matchInfoVarName}.end);
    {/if}
    {#if !topExpressionOfStatement && gcVarName}
        ARRAY_PUSH({gcVarName}, (void *){matchArrayVarName}[0]);
    {/if}
{/statements}
{#if !topExpressionOfStatement && !isAssignmentRightPart}
    {matchArrayVarName}
{/if}`)
class CStringMatch
{
    public topExpressionOfStatement: boolean = false;
    public isAssignmentRightPart: boolean = false;
    public regexVar: CExpression;
    public argAccess: CElementAccess;
    public matchInfoVarName: string;
    public matchArrayVarName: string;
    public gcVarName: string = null;
    constructor(scope: IScope, call: ts.CallExpression) {
        scope.root.headerFlags.str_substring = true;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (call.parent.kind == ts.SyntaxKind.BinaryExpression) {
            let assignment = <ts.BinaryExpression>call.parent;
            if (assignment.left.kind == ts.SyntaxKind.Identifier) {
                this.matchArrayVarName = (<ts.Identifier>assignment.left).text;
                this.isAssignmentRightPart = true;
            }
        }
        if (call.parent.kind == ts.SyntaxKind.VariableDeclaration) {
            let assignment = <ts.VariableDeclaration>call.parent;
            if (assignment.name.kind == ts.SyntaxKind.Identifier) {
                this.matchArrayVarName = (<ts.Identifier>assignment.name).text;
                this.isAssignmentRightPart = true;
            }
        }
                                    
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                this.argAccess = new CElementAccess(scope, propAccess.expression);
                this.regexVar = CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                this.matchInfoVarName = scope.root.typeHelper.addNewTemporaryVariable(call, "match_info");
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(call);
                if (!this.isAssignmentRightPart) {
                    this.matchArrayVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                    scope.variables.push(new CVariable(scope, this.matchArrayVarName, new ArrayType(StringVarType, 1, false)));
                }
                scope.variables.push(new CVariable(scope, this.matchInfoVarName, RegexMatchVarType));
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.gc_iterator = true;
            } else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
    }
}
