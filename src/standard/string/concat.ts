import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory } from '../../template';
import { StandardCallResolver, IResolver } from '../../standard';
import { StringVarType, NumberVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver
class StringConcatResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "concat" && objType == StringVarType;
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return StringVarType;
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CStringConcat(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return "concatenated_str";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
}

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement}
        {tempVarName} = malloc({sizes{+}=>{this}} + 1);
        assert({tempVarName} != NULL);
        ((char *){tempVarName})[0] = '\\0';
        {concatValues}
    {/if}
{/statements}
{#if !topExpressionOfStatement}
    {tempVarName}
{/if}`)
class CStringConcat {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public indexVarName: string;
    public varAccess: CElementAccess = null;
    public concatValues: CConcatValue[] = [];
    public sizes: CGetSize[] = [];
    constructor(scope: IScope, call: ts.CallExpression) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        this.varAccess = new CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;

        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new CVariable(scope, this.tempVarName, "char *"));
            let args = call.arguments.map(a => ({ node: a, template: CodeTemplateFactory.createForNode(scope, a) }));
            let toConcatenate = [{node: <ts.Node>propAccess.expression, template: this.varAccess}].concat(args);
            this.sizes = toConcatenate.map(a => new CGetSize(scope, a.node, a.template))
            this.concatValues = toConcatenate.map(a => new CConcatValue(scope, this.tempVarName, a.node, a.template))
        }
        scope.root.headerFlags.strings = true;
        scope.root.headerFlags.malloc = true;
        scope.root.headerFlags.str_int16_t_cat = true;
    }

}

@CodeTemplate(`
{#if isNumber}
    STR_INT16_T_BUFLEN
{#else}
    strlen({value})
{/if}`)
class CGetSize {
    public isNumber: boolean; 
    constructor(scope: IScope, valueNode: ts.Node, public value: CExpression) {
        let type = scope.root.typeHelper.getCType(valueNode);
        this.isNumber = type == NumberVarType;
    }
}

@CodeTemplate(`
{#if isNumber}
    str_int16_t_cat((char *){tempVarName}, {value});
{#else}
    strcat((char *){tempVarName}, {value});
{/if}
`)
class CConcatValue {
    public isNumber: boolean; 
    constructor(scope: IScope, public tempVarName: string, valueNode: ts.Node, public value: CExpression) {
        let type = scope.root.typeHelper.getCType(valueNode);
        this.isNumber = type == NumberVarType;
    }
}
