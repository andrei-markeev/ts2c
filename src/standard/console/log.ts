import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../../template';
import {CType, ArrayType, StructType, DictType, VariableInfo, StringVarType, NumberVarType, BooleanVarType, RegexVarType} from '../../types';
import {IScope} from '../../program';
import {CExpression} from '../../nodes/expressions';
import {CCallExpression} from '../../nodes/call';
import {CVariable} from '../../nodes/variable';

export class ConsoleLogHelper {
    public static create(scope: IScope, printNodes: ts.Expression[]) {
        let printfs = [];
        for (let i = 0; i < printNodes.length; i++) {
            let printNode = printNodes[i];
            let type = scope.root.typeHelper.getCType(printNode);
            let nodeExpressions = processBinaryExpressions(scope, printNode);
            
            let stringLit = '';
            nodeExpressions = nodeExpressions.reduce((a, c) => {
                if (c.node.kind == ts.SyntaxKind.StringLiteral)
                    stringLit += c.expression.resolve().slice(1, -1);
                else {
                    a.push(c);
                    c.prefix = stringLit;
                    stringLit = '';
                }
                return a;
            }, []);
            if (stringLit) {
                if (nodeExpressions.length)
                    nodeExpressions[nodeExpressions.length - 1].postfix = stringLit;
                else
                    nodeExpressions.push({ node: printNode, expression: stringLit, prefix: '', postfix: '' });
            }
            

            for (let j = 0; j < nodeExpressions.length; j++) {
                let { node, expression, prefix, postfix } = nodeExpressions[j];
                let accessor = expression["resolve"] ? expression["resolve"]() : expression;
                let options = {
                    prefix: (i > 0 && j == 0 ? " " : "") + prefix,
                    postfix: postfix + (i == printNodes.length - 1 && j == nodeExpressions.length - 1 ? "\\n" : "")
                };
                printfs.push(new CPrintf(scope, node, accessor, type, options));
            }
        }
        return printfs;
    }
}

function processBinaryExpressions(scope: IScope, printNode: ts.Node) {
    let type = scope.root.typeHelper.getCType(printNode);
    if (type == StringVarType && printNode.kind == ts.SyntaxKind.BinaryExpression) {
        let binExpr = <ts.BinaryExpression>printNode;
        if (scope.root.typeHelper.getCType(binExpr.left) == StringVarType
            && scope.root.typeHelper.getCType(binExpr.right) == StringVarType)
        {
            let left = processBinaryExpressions(scope, binExpr.left);
            let right = processBinaryExpressions(scope, binExpr.right);
            return [].concat(left, right);
        }
    }
    
    return [ { node: printNode, expression: CodeTemplateFactory.createForNode(scope, printNode), prefix: '', postfix: '' } ];
}

interface PrintfOptions {
    prefix?: string;
    postfix?: string;
    quotedString?: boolean;
    propName?: string;
    indent?: string;
}

@CodeTemplate(`
{#if isStringLiteral}
    printf("{PREFIX}{accessor}{POSTFIX}");
{#elseif isQuotedCString}
    printf("{PREFIX}\\"%s\\"{POSTFIX}", {accessor});
{#elseif isCString}
    printf("{PREFIX}%s{POSTFIX}", {accessor});
{#elseif isRegex}
    printf("{PREFIX}%s{POSTFIX}", {accessor}.str);
{#elseif isInteger}
    printf("{PREFIX}%d{POSTFIX}", {accessor});
{#elseif isBoolean && !PREFIX && !POSTFIX}
    printf({accessor} ? "true" : "false");
{#elseif isBoolean && (PREFIX || POSTFIX)}
    printf("{PREFIX}%s{POSTFIX}", {accessor} ? "true" : "false");
{#elseif isDict}
    printf("{PREFIX}{ ");
    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {accessor}->index->size; {iteratorVarName}++) {
    {INDENT}    if ({iteratorVarName} != 0)
    {INDENT}        printf(", ");
    {INDENT}    printf("\\"%s\\": ", {accessor}->index->data[{iteratorVarName}]);
    {INDENT}    {elementPrintfs}
    {INDENT}}
    {INDENT}printf(" }{POSTFIX}");
{#elseif isStruct}
    printf("{PREFIX}{ ");
    {INDENT}{elementPrintfs {    printf(", ");\n    }=> {this}}
    {INDENT}printf(" }{POSTFIX}");
{#elseif isArray}
    printf("{PREFIX}[ ");
    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {
    {INDENT}    if ({iteratorVarName} != 0)
    {INDENT}        printf(", ");
    {INDENT}    {elementPrintfs}
    {INDENT}}
    {INDENT}printf(" ]{POSTFIX}");
{#else}
    printf(/* Unsupported printf expression */);
{/if}`)
class CPrintf {

    public isStringLiteral: boolean = false;
    public isQuotedCString: boolean = false;
    public isCString: boolean = false;
    public isRegex: boolean = false;
    public isInteger: boolean = false;
    public isBoolean: boolean = false;
    public isDict: boolean = false;
    public isStruct: boolean = false;
    public isArray: boolean = false;

    public iteratorVarName: string;
    public arraySize: string;
    public elementPrintfs: CPrintf[] = [];
    public propPrefix: string = '';
    public PREFIX: string;
    public POSTFIX: string;
    public INDENT: string = '';

    constructor(scope: IScope, printNode: ts.Node, public accessor: string, varType: CType, options: PrintfOptions) {
        this.isStringLiteral = varType == StringVarType && printNode.kind == ts.SyntaxKind.StringLiteral;
        this.isQuotedCString = varType == StringVarType && options.quotedString;
        this.isCString = varType == StringVarType && !options.quotedString;
        this.isRegex = varType == RegexVarType;
        this.isInteger = varType == NumberVarType;
        this.isBoolean = varType == BooleanVarType;

        this.PREFIX = options.prefix || '';
        this.POSTFIX = options.postfix || '';

        if (options.propName)
            this.PREFIX = this.PREFIX + options.propName + ": ";

        if (options.indent)
            this.INDENT = options.indent;

        if (varType instanceof ArrayType) {
            this.isArray = true;
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(printNode);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
            this.arraySize = varType.isDynamicArray ? accessor + "->size" : varType.capacity + "";
            let elementAccessor = accessor + (varType.isDynamicArray ? "->data" : "") + "[" + this.iteratorVarName + "]";
            let opts = { quotedString: true, indent: this.INDENT + "    " };
            this.elementPrintfs = [
                new CPrintf(scope, printNode, elementAccessor, varType.elementType, opts)
            ];
        }
        else if (varType instanceof DictType) {
            this.isDict = true;
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(printNode);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
            let opts = { quotedString: true, indent: this.INDENT + "    " };
            this.elementPrintfs = [
                new CPrintf(scope, printNode, accessor + "->values->data[" + this.iteratorVarName + "]", varType.elementType, opts)
            ];
        }
        else if (varType instanceof StructType) {
            this.isStruct = true;
            for (let k in varType.properties) {
                let propAccessor = accessor + "->" + k;
                let opts = { quotedString: true, propName: k, indent: this.INDENT + "    " };
                this.elementPrintfs.push(new CPrintf(scope, printNode, propAccessor, varType.properties[k], opts));
            }
        }
    }
}
