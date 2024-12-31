import * as kataw from 'kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver, IResolverMatchOptions } from '../../standard';
import { ArrayType, NumberVarType, PointerVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { isFieldPropertyAccess, isNumericLiteral } from '../../types/utils';

@StandardCallResolver
class ArraySpliceResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: kataw.CallExpression, options: IResolverMatchOptions) {
        if (!isFieldPropertyAccess(call.expression) || !kataw.isIdentifier(call.expression.expression))
            return false;
        let objType = typeHelper.getCType(call.expression.member);
        return call.expression.expression.text === "splice" && (objType instanceof ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    }
    public objectType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return new ArrayType(PointerVarType, 0, true);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        let propAccess = <kataw.IndexExpression>call.expression;
        return typeHelper.getCType(propAccess.member);
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CArraySplice(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind !== kataw.SyntaxKind.ExpressionStatement;
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return "tmp_removed_values";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return (<kataw.IndexExpression>node.expression).member;
    }
}

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement}
        ARRAY_CREATE({tempVarName}, {deleteCountArg}, {deleteCountArg});
        for ({iteratorVarName} = 0; {iteratorVarName} < {deleteCountArg}; {iteratorVarName}++)
            {tempVarName}->data[{iteratorVarName}] = {varAccess}->data[{iteratorVarName}+(({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}))];
        ARRAY_REMOVE({varAccess}, ({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}), {deleteCountArg});
        {insertValues}
    {/if}
{/statements}
{#if topExpressionOfStatement && needsRemove}
    ARRAY_REMOVE({varAccess}, ({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}), {deleteCountArg});
    {insertValues}
{#elseif topExpressionOfStatement && !needsRemove}
    {insertValues}
{#else}
    {tempVarName}
{/if}`)
class CArraySplice extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public iteratorVarName: string;
    public varAccess: CElementAccess = null;
    public startPosArg: CExpression;
    public deleteCountArg: CExpression;
    public insertValues: CInsertValue[] = [];
    public needsRemove: boolean = false;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        let propAccess = <kataw.IndexExpression>call.expression;
        this.varAccess = new CElementAccess(scope, propAccess.member);
        let args = call.argumentList.elements.map(a => CodeTemplateFactory.createForNode(scope, a));
        this.startPosArg = args[0];
        this.deleteCountArg = args[1];
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;

        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            let type = scope.root.typeHelper.getCType(propAccess.member);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new CVariable(scope, this.tempVarName, type));
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
        }
        if (call.argumentList.elements.length > 2) {
            this.insertValues = args.slice(2).reverse().map(a => new CInsertValue(scope, this.varAccess, this.startPosArg, a));
            scope.root.headerFlags.array_insert = true;
        }
        if (isNumericLiteral(call.argumentList.elements[1])) {
            this.needsRemove = call.argumentList.elements[1].text !== 0;
        }
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_insert = true;
        scope.root.headerFlags.array_remove = true;
    }

}

@CodeTemplate(`ARRAY_INSERT({varAccess}, {startIndex}, {value});\n`)
class CInsertValue {
    constructor(scope: IScope, public varAccess: CElementAccess, public startIndex: CExpression, public value: CExpression) { }
}
