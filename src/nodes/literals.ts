import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {IScope} from '../program';
import {ArrayType, StructType, DictType, UniversalVarType, StringVarType, NumberVarType, BooleanVarType, findParentFunction} from '../types';
import {CVariable, CVariableAllocation, CAsUniversalVar} from './variable';
import {CAssignment} from './assignment';
import {CRegexSearchFunction} from './regexfunc';
import { CExpression } from './expressions';

@CodeTemplate(`
{#if universalWrapper}
    js_var_from_array({expression})
{#else}
    {expression}
{/if}`, ts.SyntaxKind.ArrayLiteralExpression)
class CArrayLiteralExpression {
    public expression: string;
    public universalWrapper: boolean = false;
    constructor(scope: IScope, node: ts.ArrayLiteralExpression) {
        let arrSize = node.elements.length;
        let type = scope.root.typeHelper.getCType(node);
        if (type === UniversalVarType) {
            type = new ArrayType(UniversalVarType, 0, true);
            this.universalWrapper = true;
            scope.root.headerFlags.js_var_array = true;
        }
        if (type instanceof ArrayType) {
            let varName: string;
            let canUseInitializerList = node.elements.every(e => e.kind == ts.SyntaxKind.NumericLiteral || e.kind == ts.SyntaxKind.StringLiteral);
            if (!type.isDynamicArray && canUseInitializerList) {
                varName = scope.root.symbolsHelper.addTemp(node, "tmp_array");
                let s = "{ ";
                for (let i = 0; i < arrSize; i++) {
                    if (i != 0)
                        s += ", ";
                    let cExpr = CodeTemplateFactory.createForNode(scope, node.elements[i]);
                    s += typeof cExpr === 'string' ? cExpr : (<any>cExpr).resolve();
                }
                s += " }";
                scope.variables.push(new CVariable(scope, varName, type, { initializer: s }));
            }
            else {
                if (type.isDynamicArray) {
                    varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                    if (!scope.root.memoryManager.variableWasReused(node))
                        scope.func.variables.push(new CVariable(scope, varName, type, { initializer: "NULL" }));
                    scope.root.headerFlags.array = true;
                    scope.statements.push("ARRAY_CREATE(" + varName + ", " + Math.max(arrSize, 2) + ", " + arrSize + ");\n");
                    let gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                    if (gcVarName) {
                        scope.statements.push("ARRAY_PUSH(" + gcVarName + ", (void *)" + varName + ");\n");
                        scope.root.headerFlags.gc_iterator = true;
                        scope.root.headerFlags.array = true;
                    }
                }
                else
                {
                    varName = scope.root.symbolsHelper.addTemp(node, "tmp_array");
                    scope.variables.push(new CVariable(scope, varName, type));
                }

                for (let i = 0; i < arrSize; i++) {
                    let assignment = new CAssignment(scope, varName, i + "", type, node.elements[i])
                    scope.statements.push(assignment);
                }
            }
            this.expression = type.isDynamicArray ? "((void *)" + varName + ")" : varName;
        }
        else
            this.expression = "/* Unsupported use of array literal expression */";
    }
}

@CodeTemplate(`
{#statements}
    {#if isStruct || isDict}
        {allocator}
        {initializers}
    {/if}
{/statements}
{#if universalWrapper}
    js_var_from_dict({expression})
{#else}
    {expression}
{/if}`, ts.SyntaxKind.ObjectLiteralExpression)
class CObjectLiteralExpression {
    public expression: string = '';
    public isStruct: boolean;
    public isDict: boolean;
    public universalWrapper: boolean = false;
    public allocator: CVariableAllocation;
    public initializers: CAssignment[];
    constructor(scope: IScope, node: ts.ObjectLiteralExpression) {
        let type = scope.root.typeHelper.getCType(node);
        if (type === UniversalVarType) {
            type = new DictType(UniversalVarType);
            this.universalWrapper = true;
            scope.root.headerFlags.js_var_dict = true;
        }
        this.isStruct = type instanceof StructType;
        this.isDict = type instanceof DictType;
        if (this.isStruct || this.isDict) {
            let varName = scope.root.memoryManager.getReservedTemporaryVarName(node);

            if (!scope.root.memoryManager.variableWasReused(node))
                scope.func.variables.push(new CVariable(scope, varName, type, { initializer: "NULL" }));
            
            this.allocator = new CVariableAllocation(scope, varName, type, node);
            this.initializers = node.properties
                 .filter(p => p.kind == ts.SyntaxKind.PropertyAssignment)
                 .map(p => <ts.PropertyAssignment>p)
                 .map(p => {
                     const propName = (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text;
                     return new CAssignment(scope, varName, this.isDict ? '"' + propName + '"' : propName, type, p.initializer)
                 });
            
            this.expression = varName;
        } else
            this.expression = "/* Unsupported use of object literal expression */";
    }
}

var regexNames = {};

@CodeTemplate(`{expression}`, ts.SyntaxKind.RegularExpressionLiteral)
class CRegexLiteralExpression {
    public expression: string = '';
    constructor(scope: IScope, node: ts.RegularExpressionLiteral) {
        let template = node.text;
        if (!regexNames[template]) {
            regexNames[template] = scope.root.symbolsHelper.addTemp(null, "regex");
            scope.root.functions.splice(scope.parent ? -2 : -1, 0, new CRegexSearchFunction(scope, template, regexNames[template]));
        }
        this.expression = regexNames[template];
        scope.root.headerFlags.regex = true;
    }
}

@CodeTemplate(`{value}`, ts.SyntaxKind.StringLiteral)
export class CString {
    public value: CExpression;
    public universalWrapper: boolean = false;
    constructor(scope: IScope, nodeOrString: ts.StringLiteral | string) {
        let s = typeof nodeOrString === 'string' ? '"' + nodeOrString + '"' : nodeOrString.getText();
        s = s.replace(/\\u([A-Fa-f0-9]{4})/g, (match, g1) => String.fromCharCode(parseInt(g1, 16)));
        if (s.indexOf("'") == 0)
            this.value = '"' + s.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            this.value = s;

        if (typeof(nodeOrString) !== "string" && scope.root.typeHelper.getCType(nodeOrString) == UniversalVarType)
            this.value = new CAsUniversalVar(scope, nodeOrString, this.value, StringVarType);
    }
}

@CodeTemplate(`{value}`, ts.SyntaxKind.NumericLiteral)
export class CNumber {
    public value: CExpression;
    public universalWrapper: boolean = false;
    constructor(scope: IScope, node: ts.Node) {
        this.value = node.getText();
        if (scope.root.typeHelper.getCType(node) == UniversalVarType)
            this.value = new CAsUniversalVar(scope, node, this.value, NumberVarType);
    }
}

@CodeTemplate(`
{#if universalWrapper}
    js_var_from_uint8_t({value})
{#else}
    {value}
{/if}`, [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword])
export class CBoolean {
    public value: CExpression;
    public universalWrapper: boolean = false;
    constructor(scope: IScope, node: ts.Node) {
        this.value = node.kind == ts.SyntaxKind.TrueKeyword ? "TRUE" : "FALSE";
        scope.root.headerFlags.bool = true;
        if (scope.root.typeHelper.getCType(node) == UniversalVarType)
            this.value = new CAsUniversalVar(scope, node, this.value, BooleanVarType);
    }
}

@CodeTemplate(`js_var_from(JS_VAR_NULL)`, ts.SyntaxKind.NullKeyword)
export class CNull {
    constructor(scope: IScope) {
        scope.root.headerFlags.js_var_from = true;
    }
}

@CodeTemplate(`js_var_from(JS_VAR_UNDEFINED)`, ts.SyntaxKind.UndefinedKeyword)
export class CUndefined {
    constructor(scope: IScope) {
        scope.root.headerFlags.js_var_from = true;
    }
}

@CodeTemplate(`js_var_from(JS_VAR_NAN)`, ts.SyntaxKind.Count + 1)
export class CNaN {
    constructor(scope: IScope, node: ts.Node) {
        scope.root.headerFlags.js_var_from = true;
    }
}

@CodeTemplate(`this`, ts.SyntaxKind.ThisKeyword)
export class CThis {
    constructor(scope: IScope, node: ts.Node) { }
}
