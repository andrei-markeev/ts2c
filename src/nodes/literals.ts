import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../template';
import { IScope } from '../program';
import { ArrayType, StructType, DictType, UniversalVarType, StringVarType, NumberVarType, BooleanVarType } from '../types/ctypes';
import { CVariable, CVariableAllocation } from './variable';
import { CAssignment } from './assignment';
import { CRegexSearchFunction } from './regexfunc';
import { CExpression } from './expressions';
import { CAsUniversalVar } from './typeconvert';
import { isNumericLiteral, isPropertyDefinition, isStringLiteral, SyntaxKind_NaNIdentifier } from '../types/utils';

@CodeTemplate(`
{#if universalWrapper}
    js_var_from_array({expression})
{#else}
    {expression}
{/if}`, kataw.SyntaxKind.ArrayLiteral)
class CArrayLiteralExpression extends CTemplateBase {
    public expression: string;
    public universalWrapper: boolean = false;
    constructor(scope: IScope, node: kataw.ArrayLiteral) {
        super();
        let arrSize = node.elementList.elements.length;
        let type = scope.root.typeHelper.getCType(node);
        if (type === UniversalVarType) {
            type = new ArrayType(UniversalVarType, 0, true);
            this.universalWrapper = true;
            scope.root.headerFlags.js_var_array = true;
        }
        if (type instanceof ArrayType) {
            let varName: string;
            let canUseInitializerList = node.elementList.elements.every(e => isNumericLiteral(e) || isStringLiteral(e));
            if (!type.isDynamicArray && canUseInitializerList) {
                varName = scope.root.symbolsHelper.addTemp(node, "tmp_array");
                let s = "{ ";
                for (let i = 0; i < arrSize; i++) {
                    if (i != 0)
                        s += ", ";
                    let cExpr = CodeTemplateFactory.createForNode(scope, node.elementList.elements[i]);
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
                    let assignment = new CAssignment(scope, varName, i + "", type, node.elementList.elements[i])
                    scope.statements.push(assignment);
                }
            }
            this.expression = varName;
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
{/if}`, kataw.SyntaxKind.ObjectLiteral)
export class CObjectLiteralExpression extends CTemplateBase {
    public expression: string = '';
    public isStruct: boolean;
    public isDict: boolean;
    public universalWrapper: boolean = false;
    public allocator: CVariableAllocation;
    public initializers: CAssignment[];
    constructor(scope: IScope, node: kataw.ObjectLiteral) {
        super();
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
            this.initializers = node.propertyList.properties
                .filter(p => isPropertyDefinition(p))
                .map(p => {
                    let propName = (kataw.isIdentifier(p.left) || isStringLiteral(p.left)) && p.left.text;
                    return new CAssignment(scope, varName, this.isDict ? '"' + propName + '"' : propName, type, p.right)
                });

            this.expression = varName;
        } else
            this.expression = "/* Unsupported use of object literal expression */";
    }
}

var regexNames = {};

@CodeTemplate(`{expression}`, kataw.SyntaxKind.RegularExpressionLiteral)
class CRegexLiteralExpression extends CTemplateBase {
    public expression: string = '';
    constructor(scope: IScope, node: kataw.RegularExpressionLiteral) {
        super();
        let template = node.text;
        if (!regexNames[template]) {
            regexNames[template] = scope.root.symbolsHelper.addTemp(null, "regex");
            scope.root.functions.splice(scope.parent ? -2 : -1, 0, new CRegexSearchFunction(scope, template, regexNames[template]));
        }
        this.expression = regexNames[template];
        scope.root.headerFlags.regex = true;
    }
}

@CodeTemplate(`{value}`, kataw.SyntaxKind.StringLiteral)
export class CString extends CTemplateBase {
    public value: CExpression;
    public universalWrapper: boolean = false;
    constructor(scope: IScope, nodeOrString: kataw.StringLiteral | string) {
        super();
        let s = typeof nodeOrString === 'string' ? '"' + nodeOrString + '"' : nodeOrString.rawText.trim();
        s = s.replace(/\\u([A-Fa-f0-9]{4})/g, (match, g1) => String.fromCharCode(parseInt(g1, 16)));
        if (s.indexOf("'") == 0)
            this.value = '"' + s.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            this.value = s;

        if (typeof(nodeOrString) !== "string" && scope.root.typeHelper.getCType(nodeOrString) == UniversalVarType)
            this.value = new CAsUniversalVar(scope, this.value, StringVarType);
    }
}

@CodeTemplate(`{value}`, kataw.SyntaxKind.NumericLiteral)
export class CNumber {
    public value: CExpression;
    public universalWrapper: boolean = false;
    constructor(scope: IScope, node: kataw.NumericLiteral) {
        if (kataw.hexIntegerLiteral(node) || kataw.isOctalIntegerLiteral(node))
            this.value = node.rawText;
        else
            this.value = ""+node.text;
        if (scope.root.typeHelper.getCType(node) == UniversalVarType)
            this.value = new CAsUniversalVar(scope, this.value, NumberVarType);
    }
}

@CodeTemplate(`{value}`, [kataw.SyntaxKind.TrueKeyword, kataw.SyntaxKind.FalseKeyword])
export class CBoolean extends CTemplateBase {
    public value: CExpression;
    constructor(scope: IScope, node: kataw.SyntaxToken<kataw.SyntaxKind.TrueKeyword | kataw.SyntaxKind.FalseKeyword>) {
        super();
        this.value = node.kind == kataw.SyntaxKind.TrueKeyword ? "TRUE" : "FALSE";
        scope.root.headerFlags.bool = true;
        if (scope.root.typeHelper.getCType(node) == UniversalVarType)
            this.value = new CAsUniversalVar(scope, this.value, BooleanVarType);
    }
}

@CodeTemplate(`js_var_from(JS_VAR_NULL)`, kataw.SyntaxKind.NullKeyword)
export class CNull extends CTemplateBase {
    constructor(scope: IScope) {
        super();
        scope.root.headerFlags.js_var_from = true;
    }
}

@CodeTemplate(`js_var_from(JS_VAR_UNDEFINED)`, kataw.SyntaxKind.UndefinedKeyword)
export class CUndefined extends CTemplateBase {
    constructor(scope: IScope) {
        super();
        scope.root.headerFlags.js_var_from = true;
    }
}

@CodeTemplate(`js_var_from(JS_VAR_NAN)`, SyntaxKind_NaNIdentifier)
export class CNaN extends CTemplateBase {
    constructor(scope: IScope) {
        super();
        scope.root.headerFlags.js_var_from = true;
    }
}
