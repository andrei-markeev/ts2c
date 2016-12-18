import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../../template';
import {StandardCallResolver, IResolver} from '../../resolver';
import {ArrayType, StringVarType, NumberVarType, TypeHelper, CType} from '../../types';
import {IScope} from '../../program';
import {CVariable} from '../../nodes/variable';
import {CExpression} from '../../nodes/expressions';
import {CString} from '../../nodes/literals';
import {CElementAccess} from '../../nodes/elementaccess';

@StandardCallResolver
class ArrayConcatResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "join" && objType instanceof ArrayType && objType.isDynamicArray;
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return StringVarType;
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CArrayJoin(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        // if parent is expression statement, this means join is the top expression
        // and thus it's value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return "tmp_joined_string";
    }
}

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement && arrayOfStrings}
        {lengthVarName} = 0;
        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++)
            {lengthVarName} += strlen({varAccess}->data[{iteratorVarName}]);
        {tempVarName} = malloc({varAccess}->size == 0 ? 1 : {lengthVarName}+strlen({separator})*({varAccess}->size-1)+1);
        {tempVarName}[0] = '\\0';
        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++) {
            if ({iteratorVarName} > 0)
                strcat({tempVarName}, {separator});
            strcat({tempVarName}, {varAccess}->data[{iteratorVarName}]);
        }
    {#elseif !topExpressionOfStatement && arrayOfNumbers}
        {tempVarName} = malloc({varAccess}->size == 0 ? 1 : STR_INT16_T_BUFLEN*{varAccess}->size+strlen({separator})*({varAccess}->size-1)+1);
        {tempVarName}[0] = '\\0';
        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++) {
            if ({iteratorVarName} > 0)
                strcat({tempVarName}, {separator});
            str_int16_t_cat({tempVarName}, {varAccess}->data[{iteratorVarName}]);
        }
    {/if}
{/statements}
{#if !topExpressionOfStatement}
    {tempVarName}
{/if}
`)
class CArrayJoin {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public iteratorVarName: string;
    public lengthVarName: string;
    public arrayOfStrings: boolean;
    public arrayOfNumbers: boolean;
    public separator: CExpression;
    public varAccess: CElementAccess = null;
    constructor(scope: IScope, call: ts.CallExpression) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let type = <ArrayType>scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = new CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;

        this.arrayOfStrings = type.elementType == StringVarType;
        this.arrayOfNumbers = type.elementType == NumberVarType;

        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            scope.variables.push(new CVariable(scope, this.tempVarName, "char *"));
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(call);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
            if (this.arrayOfStrings) {
                this.lengthVarName = scope.root.typeHelper.addNewTemporaryVariable(call, "len");
                scope.variables.push(new CVariable(scope, this.lengthVarName, NumberVarType));
            }
            if (call.arguments.length > 0)
                this.separator = CodeTemplateFactory.createForNode(scope, call.arguments[0]);
            else
                this.separator = new CString(scope, ',');
            scope.root.headerFlags.array = true;
            scope.root.headerFlags.strings = true;
            if (this.arrayOfNumbers)
                scope.root.headerFlags.str_int16_t_cat = true;
        }
    }

}
