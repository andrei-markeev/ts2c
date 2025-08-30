import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { CType, ArrayType, StructType, DictType, StringVarType, NumberVarType, BooleanVarType, RegexVarType, VoidType, UniversalVarType, getTypeText, CharVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { GlobalSymbolResolver, IGlobalSymbolResolver } from '../../standard';
import { isSideEffectExpression, getAllNodesUnder, isStringLiteral, isBinaryExpression } from '../../types/utils';
import { CAssignment } from '../../nodes/assignment';
import { CString } from '../../nodes/literals';
import { TypeHelper } from '../../types/typehelper';
import { SymbolInfo, SymbolsHelper } from '../../symbols';

@GlobalSymbolResolver
export class ConsoleLogResolver implements IGlobalSymbolResolver {
    consoleSymbol: SymbolInfo;
    symbolHelper: SymbolsHelper;
    public addSymbols(rootId: number, symbolHelper: SymbolsHelper): void {
        this.symbolHelper = symbolHelper;
        this.consoleSymbol = symbolHelper.registerSyntheticSymbol(rootId, null, 'console');
        symbolHelper.registerSyntheticSymbol(rootId, this.consoleSymbol, 'log', this);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return VoidType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CConsoleLog(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return null;
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return null;
    }
}


@CodeTemplate(`
{#statements}
    {#if printfCalls.length}
        {printfCalls => {this}\n}
    {/if}
{/statements}
{printfCall}`)
class CConsoleLog extends CTemplateBase {
    public printfCalls: CPrintf[] = [];
    public printfCall: CPrintf = null;

    constructor(scope: IScope, node: kataw.CallExpression) {
        super();
        let printfs = [];
        let printNodes = node.argumentList.elements;
        for (let i = 0; i < printNodes.length; i++) {
            let printNode = printNodes[i];
            let nodeExpressions = processBinaryExpressions(scope, printNode);
            
            let stringLit = '';
            nodeExpressions = nodeExpressions.reduce((a, c) => {
                if (isStringLiteral(c.node))
                    stringLit += CodeTemplateFactory.templateToString(new CString(scope, c.node)).slice(1, -1);
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
                    nodeExpressions.push({ node: printNode, prefix: '', postfix: '' });
            }

            for (let j = 0; j < nodeExpressions.length; j++) {
                const { node, prefix, postfix } = nodeExpressions[j];
                const type = scope.root.typeHelper.getCType(node);
                const nodesUnder: kataw.SyntaxNode[] = getAllNodesUnder(node);
                const hasSideEffects = nodesUnder.some(n => isSideEffectExpression(n));
                let accessor = "";
                if (hasSideEffects && (type instanceof ArrayType || type instanceof StructType || type instanceof DictType || type === UniversalVarType))
                {
                    const tempVarName = scope.root.symbolsHelper.addTemp(node, "tmp_result");
                    // crutch
                    let tempVarType = type;
                    if (tempVarType instanceof ArrayType && !tempVarType.isDynamicArray)
                        tempVarType = getTypeText(tempVarType.elementType) + "*";
                    scope.variables.push(new CVariable(scope, tempVarName, tempVarType));
                    printfs.push(new CAssignment(scope, tempVarName, null, tempVarType, node, false));
                    accessor = tempVarName;
                }
                else if (isStringLiteral(node))
                    accessor = CodeTemplateFactory.templateToString(new CString(scope, node)).slice(1, -1).replace(/%/g, "%%");
                else
                    accessor = CodeTemplateFactory.templateToString(CodeTemplateFactory.createForNode(scope, node));

                let options = {
                    prefix: (i > 0 && j == 0 ? " " : "") + prefix.replace(/%/g, "%%"),
                    postfix: postfix.replace(/%/g, "%%") + (i == printNodes.length - 1 && j == nodeExpressions.length - 1 ? "\\n" : "")
                };
                printfs.push(new CPrintf(scope, node, accessor, type, options));
            }
        }
        this.printfCalls = printfs.slice(0, -1);
        this.printfCall = printfs[printfs.length - 1];
        scope.root.headerFlags.printf = true;
    }
}

function processBinaryExpressions(scope: IScope, printNode: kataw.SyntaxNode): { node: kataw.SyntaxNode, prefix: string, postfix: string }[] {
    let type = scope.root.typeHelper.getCType(printNode);
    if (type == StringVarType && isBinaryExpression(printNode)) {
        if (printNode.operatorToken.kind == kataw.SyntaxKind.Add)
        {
            let left = processBinaryExpressions(scope, printNode.left);
            let right = processBinaryExpressions(scope, printNode.right);
            return [].concat(left, right);
        }
    }
    
    return [ { node: printNode, prefix: '', postfix: '' } ];
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
{#elseif isCString && quoted}
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
{#elseif isStaticArray && elementFormatString && +arraySize==1}
    printf("{PREFIX}[ {elementFormatString} ]{POSTFIX}", {accessor}[0]);
{#elseif isStaticArray && elementFormatString && +arraySize==2}
    printf("{PREFIX}[ {elementFormatString}, {elementFormatString} ]{POSTFIX}", {accessor}[0], {accessor}[1]);
{#elseif isStaticArray && elementFormatString && +arraySize==3}
    printf("{PREFIX}[ {elementFormatString}, {elementFormatString}, {elementFormatString} ]{POSTFIX}", {accessor}[0], {accessor}[1], {accessor}[2]);
{#elseif isArray}
    printf("{PREFIX}[ ");
    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {
    {INDENT}    if ({iteratorVarName} != 0)
    {INDENT}        printf(", ");
    {INDENT}    {elementPrintfs}
    {INDENT}}
    {INDENT}printf(" ]{POSTFIX}");
{#elseif isUniversalVar}
    js_var_log("{PREFIX}", {accessor}, "{POSTFIX}", {trueIfQuotedOtherwiseFalse}, FALSE);
{#else}
    printf(/* Unsupported printf expression */);
{/if}`)
class CPrintf {

    public isStringLiteral: boolean = false;
    public quoted: boolean = false;
    public trueIfQuotedOtherwiseFalse: string = 'FALSE';
    public isCString: boolean = false;
    public isRegex: boolean = false;
    public isInteger: boolean = false;
    public isBoolean: boolean = false;
    public isDict: boolean = false;
    public isStruct: boolean = false;
    public isArray: boolean = false;
    public isStaticArray: boolean = false;
    public isUniversalVar: boolean = false;

    public iteratorVarName: string;
    public tempVarName: string;
    public needDisposeVarName: string;
    public arraySize: string;
    public elementPrintfs: CPrintf[] = [];
    public elementFormatString: string = '';
    public propPrefix: string = '';
    public PREFIX: string;
    public POSTFIX: string;
    public INDENT: string = '';

    constructor(scope: IScope, printNode: kataw.SyntaxNode, public accessor: string, varType: CType, options: PrintfOptions) {
        this.isStringLiteral = varType == StringVarType && printNode.kind == kataw.SyntaxKind.StringLiteral;
        this.isCString = varType == StringVarType || varType instanceof ArrayType && varType.elementType === CharVarType;
        this.isRegex = varType == RegexVarType;
        this.isInteger = varType == NumberVarType;
        this.isBoolean = varType == BooleanVarType;
        this.isUniversalVar = varType == UniversalVarType;

        this.quoted = options.quotedString;
        if (options.quotedString)
            this.trueIfQuotedOtherwiseFalse = 'TRUE';

        if (this.isUniversalVar) {
            scope.root.headerFlags.bool = true;
            scope.root.headerFlags.js_var_log = true;
        }

        this.PREFIX = options.prefix || '';
        this.POSTFIX = options.postfix || '';

        if (options.propName)
            this.PREFIX = this.PREFIX + options.propName + ": ";

        if (options.indent)
            this.INDENT = options.indent;

        if (varType instanceof ArrayType && !this.isCString) {
            this.isArray = true;
            this.isStaticArray = !varType.isDynamicArray;
            this.elementFormatString = varType.elementType == NumberVarType ? '%d'
                : varType.elementType == StringVarType ? '\\"%s\\"' : '';
            this.arraySize = varType.isDynamicArray ? accessor + "->size" : varType.capacity + "";

            if (!this.isStaticArray || !this.elementFormatString || varType.capacity > 3) {
                this.iteratorVarName = scope.root.symbolsHelper.addIterator(printNode);
                scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
                let elementAccessor = accessor + (varType.isDynamicArray ? "->data" : "") + "[" + this.iteratorVarName + "]";
                let opts = { quotedString: true, indent: this.INDENT + "    " };
                this.elementPrintfs = [
                    new CPrintf(scope, printNode, elementAccessor, varType.elementType, opts)
                ];
            }
        }
        else if (varType instanceof DictType) {
            this.isDict = true;
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(printNode);
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
            let opts = { quotedString: true, indent: this.INDENT + "    " };
            this.elementPrintfs = [
                new CPrintf(scope, printNode, accessor + "->values->data[" + this.iteratorVarName + "]", varType.elementType, opts)
            ];
        }
        else if (varType instanceof StructType) {
            this.isStruct = true;
            for (let k in varType.properties) {
                let opts = { quotedString: true, propName: k, indent: this.INDENT + "    " };
                if (varType.propertyDefs[k].recursive) {
                    const objString = "[object Object]";
                    const stringLit = kataw.createStringLiteral(objString, objString, 0, -1, -1);
                    this.elementPrintfs.push(new CPrintf(scope, stringLit, objString, StringVarType, opts));
                } else {
                    let propAccessor = accessor + "->" + k;
                    this.elementPrintfs.push(new CPrintf(scope, printNode, propAccessor, varType.properties[k], opts));
                }
            }
        }
    }
}
