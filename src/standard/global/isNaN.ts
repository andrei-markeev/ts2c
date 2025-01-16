import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CTemplateBase } from '../../template';
import { IResolver, GlobalSymbolResolver, IGlobalSymbolResolver } from '../../standard';
import { BooleanVarType, UniversalVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CAsUniversalVar } from '../../nodes/typeconvert';
import { TypeHelper } from '../../types/typehelper';
import { SymbolInfo, SymbolsHelper } from '../../symbols';

@GlobalSymbolResolver
class IsNaNResolver implements IGlobalSymbolResolver {
    isNaNSymbol: SymbolInfo;
    symbolHelper: SymbolsHelper;
    public addSymbols(rootId: number, symbolHelper: SymbolsHelper): void {
        this.symbolHelper = symbolHelper;
        this.isNaNSymbol = symbolHelper.registerSyntheticSymbol(rootId, null, 'isNaN', this);
    }
    public argumentTypes(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return [ UniversalVarType ];
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return BooleanVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CIsNaN(scope, node);
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

@CodeTemplate(`js_var_isnan({argument})`)
class CIsNaN extends CTemplateBase {
    public argument: CAsUniversalVar = null;
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        this.argument = new CAsUniversalVar(scope, call.argumentList.elements[0]);
        scope.root.headerFlags.js_var_isnan = true;
        scope.root.headerFlags.js_var_to_number = true;
    }

}
