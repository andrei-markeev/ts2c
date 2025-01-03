import * as kataw from 'kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, ITypeExtensionResolver } from '../../standard';
import { CType, StringVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { getNodeText } from '../../types/utils';

@StandardCallResolver('slice')
class StringSliceResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType) {
        return memberType === StringVarType;
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return StringVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CStringSlice(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind !== kataw.SyntaxKind.ExpressionStatement;
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return "substr";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return null;
    }
}

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement && start && end}
        {tempVarName} = str_slice({varAccess}, {start}, {end});
    {#elseif !topExpressionOfStatement && start && !end}
        {tempVarName} = str_slice({varAccess}, {start}, str_len({varAccess}));
    {/if}
{/statements}
{#if !topExpressionOfStatement && start}
    {tempVarName}
{#elseif !topExpressionOfStatement && !start}
    /* Error: String.slice requires at least one parameter! */
{/if}`)
class CStringSlice extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public varAccess: CElementAccess = null;
    public start: CExpression = null;
    public end: CExpression = null;
    public tempVarName: string;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        this.varAccess = new CElementAccess(scope, propAccess.member);
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;

        if (!this.topExpressionOfStatement) {
            if (call.argumentList.elements.length == 0) {
                console.log("Error in " + getNodeText(call) + ". At least one parameter expected!");
            } else {
                this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new CVariable(scope, this.tempVarName, StringVarType));
                this.start = CodeTemplateFactory.createForNode(scope, call.argumentList.elements[0]);
                if (call.argumentList.elements.length >= 2)
                    this.end = CodeTemplateFactory.createForNode(scope, call.argumentList.elements[1]);
            }
        }
        scope.root.headerFlags.str_slice = true;
    }

}

