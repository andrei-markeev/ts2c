import * as kataw from "@andrei-markeev/kataw";
import { IScope } from "../program";
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from "../template";
import { CExpression } from "./expressions";
import { StandardResolversByPropName } from "../standard";
import { MaybeStandardCall } from "../types/utils";
import { ArrayType, StringVarType, UniversalVarType } from "../types/ctypes";
import { CVariable } from "./variable";

@CodeTemplate(`
{#statements}
    {#if jsvar}
        {varName} = {jsvar};
    {/if}
    switch ({varName}.type) {
    {#if stringTemplate && tempVarName}
            case JS_VAR_STRING:
                {statements {        }=> {this}}
                {tempVarName} = {stringTemplate};
                break;
    {#elseif stringTemplate && !tempVarName}
            case JS_VAR_STRING:
                {statements {        }=> {this}}
                {stringTemplate};
                break;
    {/if}
    {#if arrayTemplate && tempVarName}
            case JS_VAR_ARRAY:
                {statements {        }=> {this}}
                {tempVarName} = {arrayTemplate};
                break;
    {#elseif arrayTemplate && !tempVarName}
            case JS_VAR_ARRAY:
                {statements {        }=> {this}}
                {arrayTemplate};
                break;
    {/if}
        case JS_VAR_NULL:
            ARRAY_PUSH(err_defs, "TypeError: Cannot read properties of null (reading '{propName}')");
            THROW(err_defs->size);
            break;
        case JS_VAR_UNDEFINED:
            ARRAY_PUSH(err_defs, "TypeError: Cannot read properties of undefined (reading '{propName}')");
            THROW(err_defs->size);
            break;
        default:
            ARRAY_PUSH(err_defs, "TypeError: {varName}.{propName} is not a function.");
            THROW(err_defs->size);
            break;
    }
{/statements}
{#if !topExpressionOfStatement}
    {tempVarName}
{/if}
`)
export class CJsVarStandardCall extends CTemplateBase {
    jsvar: CExpression = '';
    varName: string = '';
    statements: CExpression[] = [];
    arrayTemplate: CExpression = '';
    stringCodeBlock: IScope = null;
    stringTemplate: CExpression = '';
    propName: string = '';
    topExpressionOfStatement: boolean = false;
    tempVarName: string = '';
    constructor(scope: IScope, call: MaybeStandardCall)
    {
        super();

        this.topExpressionOfStatement = call.parent.kind === kataw.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(call, 'tmp');
            const returnType = scope.root.typeHelper.getCType(call);
            scope.variables.push(new CVariable(scope, this.tempVarName, returnType));
        }

        if (!kataw.isIdentifier(call.expression.member)) {
            this.jsvar = CodeTemplateFactory.createForNode(scope, call.expression.member);
            this.varName = scope.root.symbolsHelper.addTemp(call, 'tempJsVar');
            scope.variables.push(new CVariable(scope, this.varName, UniversalVarType));
        } else {
            this.varName = call.expression.member.text;
        }
        this.propName = call.expression.expression.text;
        const matchingResolvers = StandardResolversByPropName[this.propName];
        for (const resolver of matchingResolvers) {
            const objType = resolver.objectType(scope.root.typeHelper, call);
            if (objType === StringVarType) {
                const tempScope = { statements: [], variables: scope.variables, root: scope.root, func: scope.func, parent: scope.parent };
                this.stringTemplate = resolver.createTemplate(this.stringCodeBlock, call);
                for (let statement of tempScope.statements)
                    this.statements.push(statement);
            } else if (objType instanceof ArrayType) {
                const tempScope = { statements: [], variables: scope.variables, root: scope.root, func: scope.func, parent: scope.parent };
                this.arrayTemplate = resolver.createTemplate(tempScope, call);
                for (let statement of tempScope.statements)
                    this.statements.push(statement);
            }
        }
        scope.root.headerFlags.try_catch = true;
    }

}
