import * as kataw from 'kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, ITypeExtensionResolver } from '../../standard';
import { StringVarType, NumberVarType, CType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver('concat')
class StringConcatResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType) {
        return memberType === StringVarType;
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return StringVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CStringConcat(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind !== kataw.SyntaxKind.ExpressionStatement;
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return "concatenated_str";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
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
class CStringConcat extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public indexVarName: string;
    public varAccess: CElementAccess = null;
    public concatValues: CConcatValue[] = [];
    public sizes: CGetSize[] = [];
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();

        let propAccess = <kataw.IndexExpression>call.expression;
        this.varAccess = new CElementAccess(scope, propAccess.member);
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;

        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new CVariable(scope, this.tempVarName, "char *"));
            let args = call.argumentList.elements.map(a => ({ node: a, template: CodeTemplateFactory.createForNode(scope, a) }));
            let toConcatenate = [{node: propAccess.member, template: this.varAccess as CExpression}].concat(args);
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
    constructor(scope: IScope, valueNode: kataw.ExpressionNode, public value: CExpression) {
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
    constructor(scope: IScope, public tempVarName: string, valueNode: kataw.ExpressionNode, public value: CExpression) {
        let type = scope.root.typeHelper.getCType(valueNode);
        this.isNumber = type == NumberVarType;
    }
}
