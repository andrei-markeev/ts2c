import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../../template';
import {StandardCallResolver, IResolver} from '../../standard';
import {ArrayType, StringVarType, NumberVarType, TypeHelper} from '../../types';
import {IScope} from '../../program';
import {CVariable} from '../../nodes/variable';
import {CExpression} from '../../nodes/expressions';
import {CElementAccess, CSimpleElementAccess} from '../../nodes/elementaccess';

@StandardCallResolver
class ArraySliceResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "slice" && objType instanceof ArrayType;
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        let objType = <ArrayType>typeHelper.getCType((<ts.PropertyAccessExpression>call.expression).expression);
        let simpleSlice = !objType.isDynamicArray && call.arguments.every(a => ts.isNumericLiteral(a));
        let sliceSize: number;
        if (simpleSlice) {
            let arraySize = objType.capacity;
            let startIndexArg = +call.arguments[0].getText();
            if (call.arguments.length == 1) {
                //start = startIndexArg < 0 ? arraySize + startIndexArg : startIndexArg;
                sliceSize = startIndexArg < 0 ? -startIndexArg : arraySize - startIndexArg;
            } else {
                let endIndexArg = +call.arguments[1].getText();
                let start = startIndexArg < 0 ? arraySize + startIndexArg : startIndexArg;
                sliceSize = (endIndexArg < 0 ? arraySize + endIndexArg : endIndexArg) - start;
            }
        }
        return new ArrayType(objType.elementType, simpleSlice ? sliceSize : 0, !simpleSlice);
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CArraySlice(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, call: ts.CallExpression) {
        let objType = <ArrayType>typeHelper.getCType((<ts.PropertyAccessExpression>call.expression).expression);
        let simpleSlice = !objType.isDynamicArray && call.arguments.every(a => ts.isNumericLiteral(a));
        return call.parent.kind != ts.SyntaxKind.ExpressionStatement && !simpleSlice;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return "tmp_slice";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
}

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement && simpleSlice}
        for ({iteratorVarName} = 0; {iteratorVarName} < {simpleSliceSize}; {iteratorVarName}++)
            {tempVarName}[{iteratorVarName}] = {arrayDataAccess}[{iteratorVarName} + {simpleSliceStart}];
    {#elseif !topExpressionOfStatement && !endIndexArg}
        {sizeVarName} = ({startIndexArg}) < 0 ? -({startIndexArg}) : {arraySize} - ({startIndexArg});
        {startVarName} = ({startIndexArg}) < 0 ? {arraySize} + ({startIndexArg}) : ({startIndexArg});
        ARRAY_CREATE({tempVarName}, {sizeVarName}, {sizeVarName});
        for ({iteratorVarName} = 0; {iteratorVarName} < {sizeVarName}; {iteratorVarName}++)
            {tempVarName}->data[{iteratorVarName}] = {arrayDataAccess}[{iteratorVarName} + {startVarName}];
    {#elseif !topExpressionOfStatement && endIndexArg}
        {startVarName} = ({startIndexArg}) < 0 ? {arraySize} + ({startIndexArg}) : ({startIndexArg});
        {endVarName} = ({endIndexArg}) < 0 ? {arraySize} + ({endIndexArg}) : ({endIndexArg});
        {sizeVarName} = {endVarName} - {startVarName};
        ARRAY_CREATE({tempVarName}, {sizeVarName}, {sizeVarName});
        for ({iteratorVarName} = 0; {iteratorVarName} < {sizeVarName}; {iteratorVarName}++)
            {tempVarName}->data[{iteratorVarName}] = {arrayDataAccess}[{iteratorVarName} + {startVarName}];
    {/if}
{/statements}
{#if topExpressionOfStatement}
    /* slice doesn't have side effects, skipping */
{#else}
    {tempVarName}
{/if}`)
class CArraySlice {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public iteratorVarName: string = '';
    public sizeVarName: string = '';
    public startVarName: string = '';
    public endVarName: string = '';
    public arraySize: CSimpleElementAccess;
    public arrayDataAccess: CArrayDataAccess;
    public startIndexArg: CExpression;
    public endIndexArg: CExpression;
    public simpleSlice: boolean = false;
    public simpleSliceSize: number = 0;
    public simpleSliceStart: number = 0;
    constructor(scope: IScope, call: ts.CallExpression) {
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (this.topExpressionOfStatement)
            return;

        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let varType = <ArrayType>scope.root.typeHelper.getCType(propAccess.expression);
        let varAccess = new CElementAccess(scope, propAccess.expression);
        this.arraySize = new CSimpleElementAccess(scope, varType, varAccess, "length");
        this.arrayDataAccess = new CArrayDataAccess(scope, varAccess, varType.isDynamicArray);

        this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
        scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));

        this.simpleSlice = !varType.isDynamicArray && call.arguments.every(a => ts.isNumericLiteral(a));
        if (this.simpleSlice) {
            let arraySize = varType.capacity;
            let startIndexArg = +call.arguments[0].getText();
            if (call.arguments.length == 1) {
                this.simpleSliceStart = startIndexArg < 0 ? arraySize + startIndexArg : startIndexArg;
                this.simpleSliceSize = startIndexArg < 0 ? -startIndexArg : arraySize - startIndexArg;
            } else {
                let endIndexArg = +call.arguments[1].getText();
                this.simpleSliceStart = startIndexArg < 0 ? arraySize + startIndexArg : startIndexArg;
                this.simpleSliceSize = (endIndexArg < 0 ? arraySize + endIndexArg : endIndexArg) - this.simpleSliceStart;
            }
            const assignmentToVariable = ts.isBinaryExpression(call.parent) && call.parent.operatorToken.kind == ts.SyntaxKind.EqualsToken && call.parent.left
                || ts.isVariableDeclaration(call.parent) && call.parent.name;
            if (assignmentToVariable)
                this.tempVarName = assignmentToVariable.getText();
            else {
                this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "tmp_slice");
                scope.variables.push(new CVariable(scope, this.tempVarName, new ArrayType(varType.elementType, this.simpleSliceSize, false)));
            }
            return;
        }        
       
        let args = call.arguments.map(a => CodeTemplateFactory.createForNode(scope, a));
        this.startIndexArg = args[0];
        this.endIndexArg = args.length == 2 ? args[1] : null;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            let arrayType = <ArrayType>scope.root.typeHelper.getCType(propAccess.expression);
            let tempVarType = new ArrayType(arrayType.elementType, 0, true);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new CVariable(scope, this.tempVarName, tempVarType));
            this.sizeVarName = scope.root.symbolsHelper.addTemp(propAccess, "slice_size");
            scope.variables.push(new CVariable(scope, this.sizeVarName, NumberVarType));
            this.startVarName = scope.root.symbolsHelper.addTemp(propAccess, "slice_start");
            scope.variables.push(new CVariable(scope, this.startVarName, NumberVarType));
            if (args.length == 2) {
                this.endVarName = scope.root.symbolsHelper.addTemp(propAccess, "slice_end");
                scope.variables.push(new CVariable(scope, this.endVarName, NumberVarType));
            }
        }
        scope.root.headerFlags.array = true;
    }

}

@CodeTemplate(`
{#if isDynamicArray}
    {elementAccess}->data
{#else}
    {elementAccess}
{/if}`)
class CArrayDataAccess {
    constructor(scope: IScope, public elementAccess: CElementAccess, public isDynamicArray: boolean) {}
}