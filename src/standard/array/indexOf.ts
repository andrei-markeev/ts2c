import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver } from '../../standard';
import { ArrayType, NumberVarType, BooleanVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CElementAccess } from '../../nodes/elementaccess';
import { CBinaryExpression } from '../../nodes/expressions';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver
class ArrayIndexOfResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "indexOf" && objType instanceof ArrayType;
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CArrayIndexOf(scope, node);
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
    constructor(scope: IScope, call: ts.CallExpression) {
        super();
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = <ArrayType>scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = new CElementAccess(scope, propAccess.expression);
        let args = call.arguments.map(a => CodeTemplateFactory.createForNode(scope, a));
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;

        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_pos");
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
            this.staticArraySize = objType.isDynamicArray ? "" : objType.capacity + "";
            scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));

            // Synthesize binary node that represents comparison expression
            const iteratorIdent = ts.factory.createIdentifier(this.iteratorVarName);
            const arrayElement = ts.factory.createElementAccessExpression(propAccess.expression, iteratorIdent);
            const comparison = ts.factory.createBinaryExpression(arrayElement, ts.SyntaxKind.EqualsEqualsToken, call.arguments[0]);
            (iteratorIdent as any).parent = arrayElement;
            (arrayElement as any).parent = comparison;
            scope.root.typeHelper.registerSyntheticNode(iteratorIdent, NumberVarType);
            scope.root.typeHelper.registerSyntheticNode(arrayElement, objType.elementType);
            scope.root.typeHelper.registerSyntheticNode(comparison, BooleanVarType);
            this.comparison = new CBinaryExpression(scope, comparison);

            scope.root.headerFlags.array = true;
        }
    }

}
