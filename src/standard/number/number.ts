import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { GlobalSymbolResolver, IGlobalSymbolResolver } from '../../standard';
import { NumberVarType, UniversalVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CExpression } from '../../nodes/expressions';
import { TypeHelper } from '../../types/typehelper';
import { SymbolInfo, SymbolsHelper } from '../../symbols';

@GlobalSymbolResolver
class NumberCallResolver implements IGlobalSymbolResolver {
    numberSymbol: SymbolInfo;
    symbolHelper: SymbolsHelper;
    public addSymbols(symbolHelper: SymbolsHelper): void {
        this.symbolHelper = symbolHelper;
        this.numberSymbol = symbolHelper.registerSyntheticSymbol(null, 'Number', this);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        const type = typeHelper.getCType(call.argumentList.elements[0]);
        return type == NumberVarType ? NumberVarType : UniversalVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CNumberCall(scope, node);
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
{#if call}
    {call}({arg})
{#else}
    {arg}
{/if}`)
class CNumberCall extends CTemplateBase {
    public call: string = "";
    public arg: CExpression;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();

        this.arg = CodeTemplateFactory.createForNode(scope, call.argumentList.elements[0]);

        const type = scope.root.typeHelper.getCType(call.argumentList.elements[0]);
        if (type != NumberVarType && type != UniversalVarType) {
            this.call = "str_to_int16_t";
            scope.root.headerFlags.str_to_int16_t = true;
        } else if (type == UniversalVarType) {
            this.call = "js_var_to_number";
            scope.root.headerFlags.js_var_to_number = true;
        }
    }

}
