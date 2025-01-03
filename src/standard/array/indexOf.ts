import * as kataw from 'kataw';
import { CodeTemplate, CTemplateBase } from '../../template';
import { StandardCallResolver, ITypeExtensionResolver } from '../../standard';
import { ArrayType, NumberVarType, BooleanVarType, CType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CElementAccess } from '../../nodes/elementaccess';
import { CBinaryExpression } from '../../nodes/expressions';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver('indexOf')
class ArrayIndexOfResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType) {
        return memberType instanceof ArrayType;
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CArrayIndexOf(scope, node);
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
{#statements}
    {#if !topExpressionOfStatement && staticArraySize}
        {tempVarName} = -1;
        for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++) {
            if ({comparison}) {
                {tempVarName} = {iteratorVarName};
                break;
            }
        }
    {#elseif !topExpressionOfStatement}
        {tempVarName} = -1;
        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++) {
            if ({comparison}) {
                {tempVarName} = {iteratorVarName};
                break;
            }
        }
    {/if}
{/statements}
{#if !topExpressionOfStatement}
    {tempVarName}
{/if}`)
class CArrayIndexOf extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public iteratorVarName: string;
    public comparison: CBinaryExpression;
    public staticArraySize: string = '';
    public varAccess: CElementAccess = null;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        let objType = <ArrayType>scope.root.typeHelper.getCType(propAccess.member);
        this.varAccess = new CElementAccess(scope, propAccess.member);
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;

        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_pos");
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
            this.staticArraySize = objType.isDynamicArray ? "" : objType.capacity + "";
            scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));

            // Synthesize binary node that represents comparison expression
            const iteratorIdent = kataw.createIdentifier(this.iteratorVarName, this.iteratorVarName, kataw.NodeFlags.NoChildren, -1, -1);
            const arrayElement = kataw.createMemberAccessExpression(propAccess.member, iteratorIdent, -1, -1);
            const equalsToken = kataw.createToken(kataw.SyntaxKind.LooseEqual, kataw.NodeFlags.NoChildren, -1, -1);
            const comparison = kataw.createBinaryExpression(arrayElement, equalsToken, call.argumentList.elements[0], kataw.NodeFlags.None, -1, -1);
            iteratorIdent.parent = arrayElement;
            equalsToken.parent = comparison;
            arrayElement.parent = comparison;
            scope.root.typeHelper.registerSyntheticNode(iteratorIdent, NumberVarType);
            scope.root.typeHelper.registerSyntheticNode(arrayElement, objType.elementType);
            scope.root.typeHelper.registerSyntheticNode(comparison, BooleanVarType);
            this.comparison = new CBinaryExpression(scope, comparison);

            scope.root.headerFlags.array = true;
        }
    }

}
