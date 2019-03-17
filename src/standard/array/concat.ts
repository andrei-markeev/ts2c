import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../../template';
import {StandardCallResolver, IResolver} from '../../standard';
import {ArrayType, StringVarType, NumberVarType, TypeHelper} from '../../types';
import {IScope} from '../../program';
import {CVariable} from '../../nodes/variable';
import {CExpression} from '../../nodes/expressions';
import {CElementAccess} from '../../nodes/elementaccess';

@StandardCallResolver
class ArrayConcatResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "concat" && objType instanceof ArrayType;
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let type = <ArrayType>typeHelper.getCType(propAccess.expression);
        return new ArrayType(type.elementType, 0, true);
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CArrayConcat(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return "tmp_array";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
        return node;
    }
}

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement}
        ARRAY_CREATE({tempVarName}, {sizes{+}=>{this}}, 0);
        {tempVarName}->size = {tempVarName}->capacity;
        {indexVarName} = 0;
        {concatValues}
    {/if}
{/statements}
{#if !topExpressionOfStatement}
    {tempVarName}
{/if}`)
class CArrayConcat {
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
            let type = <ArrayType>scope.root.typeHelper.getCType(propAccess.expression);
            if (!scope.root.memoryManager.variableWasReused(call)) {
                scope.variables.push(new CVariable(scope, this.tempVarName, new ArrayType(type.elementType, 0, true)));
                scope.root.symbolsHelper.ensureArrayStruct(type.elementType)
            }
            this.indexVarName = scope.root.symbolsHelper.addIterator(call);
            scope.variables.push(new CVariable(scope, this.indexVarName, NumberVarType));
            let args = call.arguments.map(a => ({ node: a, template: CodeTemplateFactory.createForNode(scope, a) }));
            let toConcatenate = [{node: <ts.Node>propAccess.expression, template: this.varAccess}].concat(args);
            this.sizes = toConcatenate.map(a => new CGetSize(scope, a.node, a.template))
            this.concatValues = toConcatenate.map(a => new CConcatValue(scope, this.tempVarName, a.node, a.template, this.indexVarName))
        }
        scope.root.headerFlags.array = true;
    }

}

@CodeTemplate(`
{#if staticArraySize}
    {staticArraySize}
{#elseif isArray}
    {value}->size
{#else}
    1
{/if}`)
class CGetSize {
    public staticArraySize: number;
    public isArray: boolean; 
    constructor(scope: IScope, valueNode: ts.Node, public value: CExpression) {
        let type = scope.root.typeHelper.getCType(valueNode);
        this.isArray = type instanceof ArrayType;
        this.staticArraySize = type instanceof ArrayType && type.capacity;
    }
}

@CodeTemplate(`
{#if staticArraySize}
    for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++)
        {varAccess}->data[{indexVarName}++] = {value}[{iteratorVarName}];
{#elseif isArray}
    for ({iteratorVarName} = 0; {iteratorVarName} < {value}->size; {iteratorVarName}++)
        {varAccess}->data[{indexVarName}++] = {value}->data[{iteratorVarName}];
{#else}
    {varAccess}->data[{indexVarName}++] = {value};
{/if}
`)
class CConcatValue {
    public staticArraySize: number;
    public isArray: boolean; 
    public iteratorVarName: string;
    constructor(scope: IScope, public varAccess: string, valueNode: ts.Node, public value: CExpression, public indexVarName: string) {
        let type = scope.root.typeHelper.getCType(valueNode);
        this.isArray = type instanceof ArrayType;
        this.staticArraySize = type instanceof ArrayType && !type.isDynamicArray && type.capacity;
        if (this.isArray) {
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(valueNode);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
        }
    }
}
