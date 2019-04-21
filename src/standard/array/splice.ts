import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory } from '../../template';
import { StandardCallResolver, IResolver, IResolverMatchOptions } from '../../standard';
import { ArrayType, NumberVarType, PointerVarType } from '../../ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../typehelper';

@StandardCallResolver
class ArraySpliceResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression, options: IResolverMatchOptions) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "splice" && (objType && objType instanceof ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    }
    public objectType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return new ArrayType(PointerVarType, 0, true);
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        return typeHelper.getCType(propAccess.expression);
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CArraySplice(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return "tmp_removed_values";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
        return (<ts.PropertyAccessExpression>node.expression).expression;
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
class CArraySplice {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public iteratorVarName: string;
    public varAccess: CElementAccess = null;
    public startPosArg: CExpression;
    public deleteCountArg: CExpression;
    public insertValues: CInsertValue[] = [];
    public needsRemove: boolean = false;
    constructor(scope: IScope, call: ts.CallExpression) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        this.varAccess = new CElementAccess(scope, propAccess.expression);
        let args = call.arguments.map(a => CodeTemplateFactory.createForNode(scope, a));
        this.startPosArg = args[0];
        this.deleteCountArg = args[1];
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;

        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            let type = scope.root.typeHelper.getCType(propAccess.expression);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new CVariable(scope, this.tempVarName, type));
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
        }
        if (call.arguments.length > 2) {
            this.insertValues = args.slice(2).reverse().map(a => new CInsertValue(scope, this.varAccess, this.startPosArg, a));
            scope.root.headerFlags.array_insert = true;
        }
        if (call.arguments[1].kind == ts.SyntaxKind.NumericLiteral) {
            this.needsRemove = call.arguments[1].getText() != "0";
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
