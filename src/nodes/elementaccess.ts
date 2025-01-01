import * as kataw from 'kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../template';
import { IScope } from '../program';
import { CType, ArrayType, StructType, DictType, StringVarType, UniversalVarType, PointerVarType, FuncType } from '../types/ctypes';
import { CExpression } from './expressions';
import { CUndefined } from './literals';
import { CAsUniversalVar } from './typeconvert';
import { isInBoolContext, findParentFunction, isFieldPropertyAccess, isFieldElementAccess, isStringLiteral } from '../types/utils';


@CodeTemplate(`{simpleAccessor}`, [kataw.SyntaxKind.MemberAccessExpression, kataw.SyntaxKind.IndexExpression, kataw.SyntaxKind.Identifier])
export class CElementAccess extends CTemplateBase {
    public simpleAccessor: CSimpleElementAccess;
    constructor(scope: IScope, node: kataw.ExpressionNode) {
        super();
        let type: CType = null;
        let elementAccess: CExpression = null;
        let argumentExpression: CExpression = null;
        let isScopeVariable: boolean = false;

        if (kataw.isIdentifier(node)) {
            type = scope.root.typeHelper.getCType(node);
            isScopeVariable = scope.root.typeHelper.isScopeVariable(node);
            elementAccess = node.text;
            if (isInBoolContext(node) && type instanceof ArrayType && !type.isDynamicArray) {
                argumentExpression = "0";
            }
            else if (type instanceof FuncType && type.needsClosureStruct) {
                const decl = scope.root.typeHelper.getDeclaration(node);
                elementAccess = decl && scope.root.memoryManager.getReservedTemporaryVarName(decl.parent) || elementAccess;
            }
        } else if (isFieldPropertyAccess(node)) {
            type = scope.root.typeHelper.getCType(node.member);
            if (kataw.isIdentifier(node.member)) {
                elementAccess = node.member.text;
                isScopeVariable = scope.root.typeHelper.isScopeVariable(node.member);
            } else
                elementAccess = new CElementAccess(scope, node.member);

            if (type === UniversalVarType) {
                argumentExpression = 'js_var_from_str("' + node.expression.text + '")';
                scope.root.headerFlags.js_var_from_str = true;
            } else if (type instanceof DictType)
                argumentExpression = '"' + node.expression.text + '"';
            else
                argumentExpression = node.expression.text;

        } else if (isFieldElementAccess(node)) {
            type = scope.root.typeHelper.getCType(node.member);

            if (kataw.isIdentifier(node.member)) {
                elementAccess = node.member.text;
                isScopeVariable = scope.root.typeHelper.isScopeVariable(node.member);
            } else
                elementAccess = new CElementAccess(scope, node.member);

            if (type === UniversalVarType)
                argumentExpression = new CAsUniversalVar(scope, node.expression);
            else if (type instanceof StructType && isStringLiteral(node.expression)) {
                let ident = node.expression.text;
                if (ident.search(/^[_A-Za-z][_A-Za-z0-9]*$/) > -1)
                    argumentExpression = ident;
                else
                    argumentExpression = CodeTemplateFactory.createForNode(scope, node.expression);
            } else
                argumentExpression = CodeTemplateFactory.createForNode(scope, node.expression);
        } else {
            type = scope.root.typeHelper.getCType(node);
            elementAccess = CodeTemplateFactory.createForNode(scope, node);
        }

        const parentFunc = findParentFunction(node);
        const parentFuncType = scope.root.typeHelper.getCType(parentFunc) as FuncType;
        if (parentFuncType && parentFuncType.needsClosureStruct && parentFuncType.closureParams.some(p => p.refs.some(r => r.start === node.start)))
            elementAccess = scope.root.symbolsHelper.getClosureVarName(parentFunc) + "->scope->" + CodeTemplateFactory.templateToString(elementAccess);
        else if (parentFuncType && parentFuncType.closureParams.some(p => p.refs.some(r => r.start === node.start) && p.assigned))
            elementAccess = "*" + CodeTemplateFactory.templateToString(elementAccess);
        else if (isScopeVariable)
            elementAccess = scope.root.symbolsHelper.getScopeVarName(parentFunc) + "->" + CodeTemplateFactory.templateToString(elementAccess);

        this.simpleAccessor = new CSimpleElementAccess(scope, type, elementAccess, argumentExpression);
    }
}

@CodeTemplate(`
{#if isString && argumentExpression == 'length'}
    str_len({elementAccess})
{#elseif isSimpleVar || argumentExpression == null}
    {elementAccess}
{#elseif isDynamicArray && argumentExpression == 'length'}
    {elementAccess}->size
{#elseif isDynamicArray}
    {elementAccess}->data[{argumentExpression}]
{#elseif isStaticArray && argumentExpression == 'length'}
    {arrayCapacity}
{#elseif isStaticArray}
    {elementAccess}[{argumentExpression}]
{#elseif isStruct}
    {elementAccess}->{argumentExpression}
{#elseif isDict}
    DICT_GET({elementAccess}, {argumentExpression}, {nullValue})
{#elseif isUniversalAccess}
    js_var_get({elementAccess}, {argumentExpression})
{#else}
    /* Unsupported element access scenario: {elementAccess} {argumentExpression} */
{/if}`)
export class CSimpleElementAccess extends CTemplateBase {
    public isSimpleVar: boolean;
    public isDynamicArray: boolean = false;
    public isStaticArray: boolean = false;
    public isStruct: boolean = false;
    public isDict: boolean = false;
    public isString: boolean = false;
    public arrayCapacity: string;
    public nullValue: CExpression = "0";
    public isUniversalAccess: boolean = false;
    constructor(scope: IScope, type: CType, public elementAccess: CElementAccess | CSimpleElementAccess | CExpression | string, public argumentExpression: CExpression) {
        super();
        this.isSimpleVar = typeof type === 'string' && type != UniversalVarType && type != PointerVarType;
        this.isDynamicArray = type instanceof ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof ArrayType && !type.isDynamicArray;
        this.arrayCapacity = type instanceof ArrayType && !type.isDynamicArray && type.capacity + "";
        this.isDict = type instanceof DictType;
        this.isStruct = type instanceof StructType;
        if (type === UniversalVarType && argumentExpression != null) {
            this.isUniversalAccess = true;
            scope.root.headerFlags.js_var_get = true;
        }
        this.isString = type === StringVarType;
        if (argumentExpression != null && type instanceof DictType && type.elementType === UniversalVarType)
            this.nullValue = new CUndefined(scope);
        if (this.isString && this.argumentExpression == "length")
            scope.root.headerFlags.str_len = true;
    }
    
}

@CodeTemplate(`
{#if type.isDynamicArray}
    {varAccess}->size
{#else}
    {arrayCapacity}
{/if}`)
export class CArraySize extends CTemplateBase {
    public arrayCapacity: string;
    constructor(scope: IScope, public varAccess: CExpression, public type: ArrayType) {
        super();
        this.arrayCapacity = type.capacity+"";
    }
}
