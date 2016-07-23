import * as ts from 'typescript';
import {CodeTemplate} from '../template';
import {IScope} from '../program';
import {ArrayType, StructType} from '../types';
import {CAssignment} from './assignment';
import {PrintfHelper} from './printf';

export class ExpressionProcessor {
    public static get(scope: IScope, node: ts.Expression): CExpression {
        switch (node.kind) {
            case ts.SyntaxKind.CallExpression:
                return new CCallExpression(scope, <ts.CallExpression>node);
            case ts.SyntaxKind.BinaryExpression:
                let binaryExpr = <ts.BinaryExpression>node;
                if (binaryExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken)
                    return new CAssignment(scope, binaryExpr.left, binaryExpr.right);
                else
                    return "/* unsupported binary expression " + node.getText() + " */";
            case ts.SyntaxKind.StringLiteral:
                return new CString(node.getText());
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.Identifier:
                return node.getText();
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
            case ts.SyntaxKind.ConditionalExpression:
            
        	default:
                return "/* unsupported expression " + node.getText() + " */";
        }
    }
}

export interface CExpression {}

@CodeTemplate(`
{#if type == "call"}
    {funcName}({arguments {, }=> {this}});
{/if}
{#if type == "array"}
    {funcName}({arrayVarName}{arguments => , {this}});
{/if}
{#if type == "printf"}
    {printfCalls}
{/if}`
)
class CCallExpression {
    public type: string;
    public funcName: string;
    public arrayVarName: string;
    public arguments: CExpression[];
    public printfCalls: any[];
    constructor(scope: IScope, call: ts.CallExpression) {
        this.type = "call";
        this.funcName = call.expression.getText();
        this.arguments = call.arguments.map(a => ExpressionProcessor.get(scope, a));
        this.arrayVarName = null;
        if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
            let propAccess = <ts.PropertyAccessExpression>call.expression;
            if (this.funcName == "console.log") {
                this.type = "printf";
                this.printfCalls = call.arguments.map(a => PrintfHelper.createPrintf(scope, a)); 
                scope.root.headerFlags.printf = true;
            }
            if (propAccess.name.getText() == 'push' && this.arguments.length == 1) {
                this.type = "array";
                this.funcName = "ARRAY_PUSH";
                let arrayVarInfo = scope.root.typeHelper.getVariableInfo(propAccess.expression);
                this.arrayVarName = arrayVarInfo.name;
                scope.root.headerFlags.array = true;
            }
            if (propAccess.name.getText() == 'pop' && this.arguments.length == 0) {
                this.type = "array";
                this.funcName = "ARRAY_POP";
                let arrayVarInfo = scope.root.typeHelper.getVariableInfo(propAccess.expression);
                this.arrayVarName = arrayVarInfo.name;
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.array_pop = true;
            }
        }
    }
}

@CodeTemplate(`
{#if isSimpleVar || argumentExpression == null}
    {elementAccess}
{/if}
{#if isDynamicArray}
    {elementAccess}.data[{argumentExpression}]
{/if}
{#if isStaticArray}
    {elementAccess}[{argumentExpression}]
{/if}
{#if isStruct}
    {elementAccess}->{argumentExpression}
{/if}
{#if isDict}
    DICT_GET({elementAccess}, {argumentExpression});
{/if}
{#if unsupportedNode}
    /* Unsupported left hand side expression {unsupportedNode} */
{/if}`)
export class CElementAccess {
    public unsupportedNode: string = null;
    public isSimpleVar: boolean;
    public isDynamicArray: boolean = false;
    public isStaticArray: boolean = false;
    public isStruct: boolean = false;
    public isDict: boolean = false;
    public elementAccess: CElementAccess | string;
    public argumentExpression: CExpression;
    constructor(scope: IScope, node: ts.Node) {
        let varInfo = null;

        if (node.kind == ts.SyntaxKind.Identifier) {
            varInfo = scope.root.typeHelper.getVariableInfo(node);
            this.elementAccess = node.getText();
        } else if (node.kind == ts.SyntaxKind.PropertyAccessExpression) {
            let propAccess = <ts.PropertyAccessExpression>node;
            varInfo = scope.root.typeHelper.getVariableInfo(propAccess.expression);
            if (propAccess.expression.kind==ts.SyntaxKind.Identifier)
                this.elementAccess = propAccess.expression.getText();
            else
                this.elementAccess = new CElementAccess(scope, propAccess.expression);
            this.argumentExpression = propAccess.name.getText();
        } else if (node.kind == ts.SyntaxKind.ElementAccessExpression) {
            let elemAccess = <ts.ElementAccessExpression>node;
            varInfo = scope.root.typeHelper.getVariableInfo(elemAccess.expression);
            if (elemAccess.expression.kind==ts.SyntaxKind.Identifier)
                this.elementAccess = elemAccess.expression.getText();
            else
                this.elementAccess = new CElementAccess(scope, elemAccess.expression);
            if (elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral)
            {
                let ident = elemAccess.argumentExpression.getText().slice(1,-1);
                if (ident.search(/^[_A-Za-z][_A-Za-z0-9]*$/) > -1)
                    this.argumentExpression = ident;
                else
                    this.argumentExpression = ExpressionProcessor.get(scope, elemAccess.argumentExpression);
            } else
                this.argumentExpression = ExpressionProcessor.get(scope, elemAccess.argumentExpression);
        } else
            this.unsupportedNode = node.getText();

        let varType = varInfo && varInfo.type;
        this.isSimpleVar = typeof varType === 'string';
        this.isDynamicArray = varInfo.isDynamicArray;
        this.isStaticArray = varType instanceof ArrayType && !varInfo.isDynamicArray;
        this.isDict = varInfo.isDict;
        this.isStruct = varType instanceof StructType && !varInfo.isDict;

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
