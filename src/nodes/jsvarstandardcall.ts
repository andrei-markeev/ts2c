import * as kataw from "@andrei-markeev/kataw";
import { IScope } from "../program";
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from "../template";
import { CExpression } from "./expressions";
import { StandardResolversByPropName } from "../standard";
import { MaybeStandardCall } from "../types/utils";
import { ArrayType, StringVarType } from "../types/ctypes";

@CodeTemplate(`
{#if jsvar}
    struct js_var {varName} = {jsvar};
{/if}
switch ({varName}.type) {
{#if stringTemplate}
        case JS_VAR_STRING:
            {stringTemplate}
            break;
{/if}
{#if arrayTemplate}
        case JS_VAR_ARRAY:
            {arrayTemplate}
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
        ARRAY_PUSH(err_defs, "TypeError: {jsvar}.{propName} is not a function.");
        THROW(err_defs->size);
        break;
}
`)
export class CJsVarStandardCall extends CTemplateBase {
    jsvar: CExpression = '';
    varName: string = '';
    arrayTemplate: CExpression = '';
    stringTemplate: CExpression = '';
    propName: string = '';
    constructor(scope: IScope, call: MaybeStandardCall)
    {
        super();

        if (!kataw.isIdentifier(call.expression.member)) {
            this.jsvar = CodeTemplateFactory.createForNode(scope, call.expression.member);
            this.varName = scope.root.symbolsHelper.addTemp(call, 'tempJsVar');
        } else {
            this.varName = call.expression.member.text;
        }
        this.propName = call.expression.expression.text;
        const matchingResolvers = StandardResolversByPropName[this.propName];
        for (const resolver of matchingResolvers) {
            const objType = resolver.objectType(scope.root.typeHelper, call);
            if (objType === StringVarType)
                this.stringTemplate = resolver.createTemplate(scope, call);
            else if (objType instanceof ArrayType)
                this.arrayTemplate = resolver.createTemplate(scope, call);
        }
        scope.root.headerFlags.try_catch = true;
    }

}
