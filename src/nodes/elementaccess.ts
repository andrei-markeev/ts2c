import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory } from '../template';
import { IScope } from '../program';
import { CType, ArrayType, StructType, DictType, StringVarType, UniversalVarType, PointerVarType, FuncType } from '../types/ctypes';
import { CExpression } from './expressions';
import { CUndefined } from './literals';
import { CAsUniversalVar } from './typeconvert';
import { isInBoolContext, findParentFunction } from '../types/utils';


@CodeTemplate(`{simpleAccessor}`, [ts.SyntaxKind.ElementAccessExpression, ts.SyntaxKind.PropertyAccessExpression, ts.SyntaxKind.Identifier])
export class CElementAccess {
    public simpleAccessor: CSimpleElementAccess;
    constructor(scope: IScope, node: ts.Node) {
        let type: CType = null;
        let elementAccess: CElementAccess | string = null;
        let argumentExpression: CExpression = null

        if (ts.isIdentifier(node)) {
            type = scope.root.typeHelper.getCType(node);
            elementAccess = node.text;
            if (isInBoolContext(node) && type instanceof ArrayType && !type.isDynamicArray) {
                argumentExpression = "0";
            }
            else if (type instanceof FuncType && type.needsClosureStruct) {
                const decl = scope.root.typeHelper.getDeclaration(node);
                elementAccess = scope.root.memoryManager.getReservedTemporaryVarName(decl) || elementAccess;
            }
        } else if (node.kind == ts.SyntaxKind.PropertyAccessExpression) {
            let propAccess = <ts.PropertyAccessExpression>node;
            type = scope.root.typeHelper.getCType(propAccess.expression);
            if (ts.isIdentifier(propAccess.expression))
                elementAccess = propAccess.expression.text;
            else
                elementAccess = new CElementAccess(scope, propAccess.expression);

            if (type === UniversalVarType) {
                argumentExpression = 'js_var_from_str("' + propAccess.name.text + '")';
                scope.root.headerFlags.js_var_from_str = true;
            } else if (type instanceof DictType)
                argumentExpression = '"' + propAccess.name.text + '"';
            else
                argumentExpression = propAccess.name.text;

        } else if (node.kind == ts.SyntaxKind.ElementAccessExpression) {
            let elemAccess = <ts.ElementAccessExpression>node;
            type = scope.root.typeHelper.getCType(elemAccess.expression);

            if (ts.isIdentifier(elemAccess.expression))
                elementAccess = elemAccess.expression.text;
            else
                elementAccess = new CElementAccess(scope, elemAccess.expression);

            if (type === UniversalVarType)
                argumentExpression = new CAsUniversalVar(scope, elemAccess.argumentExpression);
            else if (type instanceof StructType && elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                let ident = elemAccess.argumentExpression.getText().slice(1, -1);
                if (ident.search(/^[_A-Za-z][_A-Za-z0-9]*$/) > -1)
                    argumentExpression = ident;
                else
                    argumentExpression = CodeTemplateFactory.createForNode(scope, elemAccess.argumentExpression);
            } else
                argumentExpression = CodeTemplateFactory.createForNode(scope, elemAccess.argumentExpression);
        } else {
            type = scope.root.typeHelper.getCType(node);
            elementAccess = CodeTemplateFactory.createForNode(scope, node);
        }

        const parentFunc = findParentFunction(node);
        const parentFuncType = scope.root.typeHelper.getCType(parentFunc) as FuncType;
        if (parentFuncType && parentFuncType.needsClosureStruct && parentFuncType.closureParams.some(p => p.refs.some(r => r.pos === node.pos)))
            elementAccess = scope.root.symbolsHelper.getClosureVarName(parentFunc) + "->" + CodeTemplateFactory.templateToString(<any>elementAccess);
        else if (parentFuncType && parentFuncType.closureParams.some(p => p.refs.some(r => r.pos === node.pos) && p.assigned))
            elementAccess = "*" + CodeTemplateFactory.templateToString(<any>elementAccess);
        
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
export class CSimpleElementAccess {
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
export class CArraySize {
    public arrayCapacity: string;
    constructor(scope: IScope, public varAccess: CExpression, public type: ArrayType) {
        this.arrayCapacity = type.capacity+"";
    }
}
