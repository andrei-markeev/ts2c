import * as ts from 'typescript';
import {CodeTemplate} from '../template';
import {CType, ArrayType, StructType, VariableInfo} from '../types';
import {IScope} from '../program';
import {CExpression, CCallExpression, ExpressionHelper} from './expressions';
import {CVariable} from './variable';

export class PrintfHelper {
    public static create(scope: IScope, printNode: ts.Expression) {
        let type = scope.root.typeHelper.getCType(printNode);
        let nodeExpression = ExpressionHelper.create(scope, printNode);
        let accessor = nodeExpression["resolve"] ? nodeExpression["resolve"]() : nodeExpression;
        let options = {
            emitCR: true
        }
        return new CPrintf(scope, printNode, accessor, type, options);
    }
}

interface PrintfOptions
{
    emitCR?: boolean;
    quotedString?: boolean;
    propName?: string; 
    indent?: string;
}

@CodeTemplate(`
{#if isQuotedCString}
    printf("{propPrefix}\\"%s\\"{CR}", {accessor});
{#elseif isCString}
    printf("%s{CR}", {accessor});
{#elseif isInteger}
    printf("{propPrefix}%d{CR}", {accessor});
{#elseif isBoolean && !propPrefix}
    printf({accessor} ? "true{CR}" : "false{CR}");
{#elseif isBoolean && propPrefix}
    printf("{propPrefix}%s", {accessor} ? "true{CR}" : "false{CR}");
{#elseif isStruct}
    printf("{propPrefix}{ ");
    {INDENT}{elementPrintfs {    printf(", ");\n    }=> {this}}
    {INDENT}printf(" }{CR}");
{#elseif isArray}
    printf("{propPrefix}[ ");
    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {
    {INDENT}    if ({iteratorVarName} != 0)
    {INDENT}        printf(", ");
    {INDENT}    {elementPrintfs}
    {INDENT}}
    {INDENT}printf(" ]{CR}");
{#else}
    printf(/* Unsupported printf expression */);
{/if}
`)
class CPrintf {

    public isQuotedCString: boolean = false;
    public isCString: boolean = false;
    public isInteger: boolean = false;
    public isBoolean: boolean = false;
    public isStruct: boolean = false;
    public isArray: boolean = false;

    public iteratorVarName: string;
    public arraySize: string;
    public elementPrintfs: CPrintf[] = [];
    public propPrefix: string = '';
    public CR: string = '';
    public INDENT: string = '';

    constructor(scope: IScope, printNode: ts.Node, public accessor: string, varType: CType, options: PrintfOptions) {
        this.isQuotedCString = varType == 'char *' && options.quotedString;
        this.isCString = varType == 'char *' && !options.quotedString;
        this.isInteger = varType == 'int16_t';
        this.isBoolean = varType == 'uint8_t';

        if (options.emitCR)
            this.CR = "\\n";

        if (options.propName)
            this.propPrefix = options.propName + ": ";

        if (options.indent)
            this.INDENT = options.indent;

        if (varType instanceof ArrayType) {
            this.isArray = true;
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(printNode);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, "int16_t"));
            scope.root.headerFlags.int16_t = true;
            this.arraySize = varType.isDynamicArray ? accessor + ".size" : varType.capacity + "";
            let elementAccessor = accessor + (varType.isDynamicArray ? ".data" : "") + "[" + this.iteratorVarName + "]";
            let opts = { quotedString: true, indent: this.INDENT + "    " };
            this.elementPrintfs = [
                new CPrintf(scope, printNode, elementAccessor, varType.elementType, opts)
            ];
        }
        else if (varType instanceof StructType) {
            this.isStruct = true;
            for (let k in varType.properties) {
                let propAccessor = varType.isDict ? "DICT_GET(" + accessor + ", \"" + k + "\")" : accessor + "->" + k;
                let opts = { quotedString: true, propName: k, indent: this.INDENT + "    " };
                this.elementPrintfs.push(new CPrintf(scope, printNode, propAccessor, varType.properties[k], opts));
            }
        }
    }
}
