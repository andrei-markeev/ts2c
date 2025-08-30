import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, ITypeExtensionResolver } from '../../standard';
import { ArrayType, StringVarType, NumberVarType, CType, UniversalVarType, PointerVarType, BooleanVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CString } from '../../nodes/literals';
import { CArraySize, CSimpleElementAccess, CArrayAccess } from '../../nodes/elementaccess';
import { TypeHelper } from '../../types/typehelper';
import { CAsUniversalVar } from '../../nodes/typeconvert';

@StandardCallResolver('join', 'toString')
class ArrayJoinResolver implements ITypeExtensionResolver {
    public matchesNode(memberType: CType) {
        return memberType === UniversalVarType || memberType instanceof ArrayType;
    }
    public objectType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return new ArrayType(PointerVarType, 0, false);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return StringVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CArrayJoin(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind !== kataw.SyntaxKind.ExpressionStatement;
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return "tmp_joined_string";
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return null;
    }
}

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement}
        {tempVarName} = malloc({calculatedStringLength});
        assert({tempVarName} != NULL);
        ((char *){tempVarName})[0] = '\\0';
        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {
            if ({iteratorVarName} > 0)
                strcat((char *){tempVarName}, {separator});
            {strcatElement}
        }
    {/if}
{/statements}
{#if !topExpressionOfStatement}
    {tempVarName}
{/if}`)
class CArrayJoin extends CTemplateBase {
    public topExpressionOfStatement: boolean;
    public tempVarName: string = '';
    public iteratorVarName: string;
    public separator: CExpression;
    public arrayAccess: CArrayAccess = null;
    public arraySize: CArraySize;
    public arrayElement: CSimpleElementAccess;
    public calculatedStringLength: CCalculateStringSize;
    public strcatElement: CStrCatElement;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;

        if (!this.topExpressionOfStatement) {
            let propAccess = <kataw.IndexExpression>call.expression;

            const memberType = scope.root.typeHelper.getCType(propAccess.member);
            const type = memberType === UniversalVarType ? new ArrayType(UniversalVarType, 0, true) : <ArrayType>memberType;

            this.arrayAccess = new CArrayAccess(scope, propAccess.member);
            this.arraySize = new CArraySize(scope, this.arrayAccess, type);
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(call);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));

            this.arrayElement = new CSimpleElementAccess(scope, type, this.arrayAccess, this.iteratorVarName);

            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new CVariable(scope, this.tempVarName, "char *"));
            this.strcatElement = new CStrCatElement(scope, type.elementType, this.arrayElement, this.tempVarName, call);

            this.calculatedStringLength = new CCalculateStringSize(scope, this.arrayAccess, this.iteratorVarName, type, call);
            if (call.argumentList.elements.length > 0 && propAccess.expression.text == "join")
                this.separator = CodeTemplateFactory.createForNode(scope, call.argumentList.elements[0]);
            else
                this.separator = new CString(scope, ',');
            scope.root.headerFlags.malloc = true;
            scope.root.headerFlags.strings = true;
            if (type.isDynamicArray)
                scope.root.headerFlags.array = true;
            if (type.elementType == NumberVarType)
                scope.root.headerFlags.str_int16_t_cat = true;
        }
    }

}

@CodeTemplate(`
{#if isNumber}
    str_int16_t_cat((char *){accumulatorVarName}, {arrayElement});
{#elseif isString}
    strcat((char *){accumulatorVarName}, {arrayElement});
{#elseif isUniversalVar}
    strcat((char *){accumulatorVarName}, {tmpStringVarName} = js_var_to_str({arrayElement}, &{needDisposeVarName}));
    if ({needDisposeVarName})
        free((void *){tmpStringVarName});
{#else}
    /* Unsupported strcat expression */
{/if}`)
class CStrCatElement {
    public isNumber: boolean = false;
    public isString: boolean = false;
    public isUniversalVar: boolean = false;
    public tmpStringVarName: string = '';
    public needDisposeVarName: string = '';
    constructor(scope: IScope, elementType: CType, public arrayElement: CSimpleElementAccess, public accumulatorVarName: string, call: kataw.CallExpression) {
        this.isNumber = elementType === NumberVarType;
        this.isString = elementType === StringVarType;
        this.isUniversalVar = elementType === UniversalVarType;

        if (this.isUniversalVar) {
            this.tmpStringVarName = scope.root.symbolsHelper.addTemp(call, "tmp_str", false);
            this.needDisposeVarName = scope.root.symbolsHelper.addTemp(call, "need_dispose", false);
            scope.variables.push(new CVariable(scope, this.tmpStringVarName, StringVarType));
            scope.variables.push(new CVariable(scope, this.needDisposeVarName, BooleanVarType));
            scope.root.headerFlags.js_var_to_str = true;
        }
    }
}

@CodeTemplate(`
{#statements}
    {#if arrayOfStrings}
        {lengthVarName} = 0;
        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)
            {lengthVarName} += {arrayElementStrLen};
    {/if}
{/statements}
{#if type.isDynamicArray && arrayOfStrings}
    {arraySize} == 0 ? 1 : {lengthVarName} + strlen({separator})*({arraySize}-1) + 1
{#elseif arrayCapacity > 0 && arrayOfStrings}
    {lengthVarName} + strlen({separator})*({arraySize}-1) + 1
{#elseif type.isDynamicArray && arrayOfNumbers}
    {arraySize} == 0 ? 1 : STR_INT16_T_BUFLEN*{arraySize} + strlen({separator})*({arraySize}-1) + 1
{#elseif arrayCapacity > 0 && arrayOfNumbers}
    STR_INT16_T_BUFLEN*{arraySize}+strlen({separator})*({arraySize}-1)+1
{#else}
    1
{/if}`)
class CCalculateStringSize {
    public lengthVarName: string;
    public arrayOfStrings: boolean;
    public arrayOfNumbers: boolean;
    public arrayCapacity: string;
    public arraySize: CArraySize;
    public arrayElementStrLen: CArrayElementStrLen;
    constructor(scope: IScope, public arrayAccess: CArrayAccess, public iteratorVarName: string, public type: ArrayType, node: kataw.CallExpression) {
        this.arrayOfStrings = type.elementType === StringVarType || type.elementType === UniversalVarType;
        this.arrayOfNumbers = type.elementType === NumberVarType;
        this.arrayCapacity = type.capacity+"";
        this.arraySize = new CArraySize(scope, this.arrayAccess, type);
        this.arrayElementStrLen = new CArrayElementStrLen(scope, type, arrayAccess, iteratorVarName);
        
        if (this.arrayOfStrings) {
            this.lengthVarName = scope.root.symbolsHelper.addTemp(node, "len");
            scope.variables.push(new CVariable(scope, this.lengthVarName, NumberVarType));
        }
    }
}

@CodeTemplate(`
{#if isUniversalVar}
    js_var_as_str_len({elementAccess})
{#else}
    strlen({elementAccess})
{/if}`)
class CArrayElementStrLen {
    public elementAccess: CSimpleElementAccess;
    public isUniversalVar: boolean;
    constructor(scope: IScope, type: ArrayType, arrayAccess: CArrayAccess, iteratorVarName: string) {
        this.elementAccess = new CSimpleElementAccess(scope, type, arrayAccess, iteratorVarName);
        this.isUniversalVar = type.elementType === UniversalVarType;
        if (this.isUniversalVar)
            scope.root.headerFlags.js_var_as_str_len = true;
    }
}