import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { GlobalSymbolResolver, IGlobalSymbolResolver } from '../../standard';
import { NumberVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CExpression } from '../../nodes/expressions';
import { TypeHelper } from '../../types/typehelper';
import { SymbolInfo, SymbolsHelper } from '../../symbols';

@GlobalSymbolResolver
class ParseIntResolver implements IGlobalSymbolResolver {
    parseIntSymbol: SymbolInfo;
    symbolHelper: SymbolsHelper;
    public addSymbols(rootId: number, symbolHelper: SymbolsHelper): void {
        this.symbolHelper = symbolHelper;
        this.parseIntSymbol = symbolHelper.registerSyntheticSymbol(rootId, null, 'parseInt', this);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        return new CParseInt(scope, node);
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

@CodeTemplate(`parse_int16_t({arguments {, }=> {this}})`)
class CParseInt extends CTemplateBase {
    public arguments: CExpression[];
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();
        this.arguments = call.argumentList.elements.map(a => CodeTemplateFactory.createForNode(scope, a));
        scope.root.headerFlags.parse_int16_t = true;
    }

}
