import * as ts from 'typescript';
import {CodeTemplate} from '../template';
import {IScope} from '../program';
import {VariableInfo, CType, ArrayType, StructType} from '../types';
import {AssignmentHelper} from './assignment';
import {PrintfHelper} from './printf';

export class ExpressionHelper {
    public static create(scope: IScope, node: ts.Expression): CExpression {
        if (typeof node === 'string')
            return node;
        switch (node.kind) {
            case ts.SyntaxKind.ElementAccessExpression:
            case ts.SyntaxKind.PropertyAccessExpression:
                return new CElementAccess(scope, node);
            case ts.SyntaxKind.CallExpression:
                return new CCallExpression(scope, <any>node);
            case ts.SyntaxKind.BinaryExpression:
                let binaryExpr = <ts.BinaryExpression>node;
                if (binaryExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken)
                    return AssignmentHelper.create(scope, binaryExpr.left, binaryExpr.right);
                else
                    return new CBinaryExpression(scope, binaryExpr);
            case ts.SyntaxKind.StringLiteral:
                return new CString(node.getText());
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.Identifier:
                return node.getText();
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
                return new CUnaryExpression(scope, <any>node);
            case ts.SyntaxKind.ConditionalExpression:

            default:
                return "/* unsupported expression " + node.getText() + " */";
        }
    }
}

export interface CExpression { }

@CodeTemplate(`
{#if type == "call"}
    {funcName}({arguments {, }=> {this}})
{/if}
{#if type == "array"}
    {funcName}({arrayVarName}{arguments => , {this}})
{/if}
{#if type == "printf"}
    {printfCalls}
{/if}`
)
export class CCallExpression {
    public type: string;
    public funcName: string;
    public arrayVarName: string;
    public arrayVarInfo: VariableInfo;
    public arguments: CExpression[];
    public printfCalls: any[];
    constructor(scope: IScope, call: ts.CallExpression) {
        this.type = "call";
        this.funcName = call.expression.getText();
        this.arguments = call.arguments.map(a => ExpressionHelper.create(scope, a));
        this.arrayVarName = null;
        if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
            let propAccess = <ts.PropertyAccessExpression>call.expression;
            if (this.funcName == "console.log") {
                this.type = "printf";
                this.printfCalls = call.arguments.map(a => PrintfHelper.create(scope, a));
                scope.root.headerFlags.printf = true;
            }
            if (propAccess.name.getText() == 'push' && this.arguments.length == 1) {
                this.type = "array";
                this.funcName = "ARRAY_PUSH";
                this.arrayVarInfo = scope.root.typeHelper.getVariableInfo(propAccess.expression);
                this.arrayVarName = this.arrayVarInfo.name;
                scope.root.headerFlags.array = true;
            }
            if (propAccess.name.getText() == 'pop' && this.arguments.length == 0) {
                this.type = "array";
                this.funcName = "ARRAY_POP";
                this.arrayVarInfo = scope.root.typeHelper.getVariableInfo(propAccess.expression);
                this.arrayVarName = this.arrayVarInfo.name;
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.array_pop = true;
            }
        }
    }
}

@CodeTemplate(`
{#if operator}
    {left} {operator} {right}
{#else}
    /* unsupported expression {nodeText} */
{/if}`
)
class CBinaryExpression {
    public nodeText: string;
    public operator: ts.SyntaxKind;
    public left: CExpression;
    public right: CExpression;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        let operatorMap = {};
        operatorMap[ts.SyntaxKind.GreaterThanToken] = '>';
        operatorMap[ts.SyntaxKind.GreaterThanEqualsToken] = '>=';
        operatorMap[ts.SyntaxKind.LessThanToken] = '<';
        operatorMap[ts.SyntaxKind.LessThanEqualsToken] = '<=';
        operatorMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = '!=';
        operatorMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = '==';
        operatorMap[ts.SyntaxKind.AsteriskToken] = '*';
        operatorMap[ts.SyntaxKind.SlashToken] = '/';
        operatorMap[ts.SyntaxKind.PlusToken] = '+';
        operatorMap[ts.SyntaxKind.MinusToken] = '-';
        this.left = ExpressionHelper.create(scope, node.left);
        this.right = ExpressionHelper.create(scope, node.right);
        this.operator = operatorMap[node.operatorToken.kind];
        this.nodeText = node.getText();
    }
}


@CodeTemplate(`
{#if isPostfix && operator}
    {operand}{operator}
{#elseif !isPostfix && operator}
    {operator}{operand}
{#else}
    /* unsupported expression {nodeText} */
{/if}`
)
class CUnaryExpression {
    public nodeText: string;
    public operator: ts.SyntaxKind;
    public operand: CExpression;
    public isPostfix: boolean;
    constructor(scope: IScope, node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression) {
        let operatorMap = {};
        operatorMap[ts.SyntaxKind.PlusPlusToken] = '++';
        operatorMap[ts.SyntaxKind.MinusMinusToken] = '--';
        operatorMap[ts.SyntaxKind.ExclamationToken] = '!';
        this.operand = ExpressionHelper.create(scope, node.operand);
        this.operator = operatorMap[node.operator];
        this.isPostfix = node.kind == ts.SyntaxKind.PostfixUnaryExpression;
        this.nodeText = node.getText();
    }
}

@CodeTemplate(`
{#if isSimpleVar || argumentExpression == null}
    {elementAccess}
{#elseif isDynamicArray && argumentExpression == 'length'}
    {elementAccess}.size
{#elseif isDynamicArray}
    {elementAccess}.data[{argumentExpression}]
{#elseif isStaticArray}
    {elementAccess}[{argumentExpression}]
{#elseif isStruct}
    {elementAccess}->{argumentExpression}
{#elseif isDict}
    DICT_GET({elementAccess}, {argumentExpression})
{#else}
    /* Unsupported left hand side expression {nodeText} */
{/if}`)
export class CElementAccess {
    public isSimpleVar: boolean;
    public isDynamicArray: boolean = false;
    public isStaticArray: boolean = false;
    public isStruct: boolean = false;
    public isDict: boolean = false;
    public elementAccess: CElementAccess | string;
    public argumentExpression: CExpression = null;
    public nodeText: string;
    constructor(scope: IScope, node: ts.Node) {
        let varInfo: VariableInfo = null;

        if (node.kind == ts.SyntaxKind.Identifier) {
            varInfo = scope.root.typeHelper.getVariableInfo(node);
            this.elementAccess = node.getText();
        } else if (node.kind == ts.SyntaxKind.PropertyAccessExpression) {
            let propAccess = <ts.PropertyAccessExpression>node;
            varInfo = scope.root.typeHelper.getVariableInfo(propAccess.expression);
            if (propAccess.expression.kind == ts.SyntaxKind.Identifier)
                this.elementAccess = propAccess.expression.getText();
            else
                this.elementAccess = new CElementAccess(scope, propAccess.expression);
            this.argumentExpression = propAccess.name.getText();
        } else if (node.kind == ts.SyntaxKind.ElementAccessExpression) {
            let elemAccess = <ts.ElementAccessExpression>node;
            varInfo = scope.root.typeHelper.getVariableInfo(elemAccess.expression);
            if (elemAccess.expression.kind == ts.SyntaxKind.Identifier)
                this.elementAccess = elemAccess.expression.getText();
            else
                this.elementAccess = new CElementAccess(scope, elemAccess.expression);
            if (elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                let ident = elemAccess.argumentExpression.getText().slice(1, -1);
                if (ident.search(/^[_A-Za-z][_A-Za-z0-9]*$/) > -1)
                    this.argumentExpression = ident;
                else
                    this.argumentExpression = ExpressionHelper.create(scope, elemAccess.argumentExpression);
            } else
                this.argumentExpression = ExpressionHelper.create(scope, elemAccess.argumentExpression);
        }

        let type = varInfo && varInfo.type;
        this.isSimpleVar = typeof type === 'string';
        this.isDynamicArray = type instanceof ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof ArrayType && !type.isDynamicArray;
        this.isDict = type instanceof StructType && type.isDict;
        this.isStruct = type instanceof StructType && !type.isDict;
        this.nodeText = node.getText();

    }
}

export class CString {
    private value: string;
    constructor(value: string) {
        if (value.indexOf("'") == 0)
            this.value = '"' + value.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            this.value = value;
    }
    resolve() {
        return this.value;
    }
}
