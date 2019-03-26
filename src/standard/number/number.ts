import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../../template';
import {StandardCallResolver, IResolver} from '../../standard';
import {NumberVarType, TypeHelper, UniversalVarType} from '../../types';
import {IScope} from '../../program';
import {CExpression} from '../../nodes/expressions';

@StandardCallResolver
class NumberCallResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        return ts.isIdentifier(call.expression) && call.expression.text == "Number";
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        const type = typeHelper.getCType(call.arguments[0]);
        return type == NumberVarType ? NumberVarType : UniversalVarType;
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CNumberCall(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
    public getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
}

@CodeTemplate(`
{#if call}
    {call}({arg})
{#else}
    {arg}
{/if}`)
class CNumberCall {
    public call: string = "";
    public arg: CExpression;
    constructor(scope: IScope, call: ts.CallExpression) {
        this.arg = CodeTemplateFactory.createForNode(scope, call.arguments[0]);

        const type = scope.root.typeHelper.getCType(call.arguments[0]);
        if (type != NumberVarType && type != UniversalVarType) {
            this.call = "str_to_int16_t";
            scope.root.headerFlags.str_to_int16_t = true;
        } else if (type == UniversalVarType) {
            this.call = "js_var_to_number";
            scope.root.headerFlags.js_var_to_number = true;
        }
    }

}
