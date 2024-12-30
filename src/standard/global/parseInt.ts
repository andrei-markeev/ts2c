import * as kataw from 'kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver } from '../../standard';
import { NumberVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CExpression } from '../../nodes/expressions';
import { TypeHelper } from '../../types/typehelper';
import { SymbolInfo, SymbolsHelper } from '../../symbols';

@StandardCallResolver
class ParseIntResolver implements IResolver {
    parseIntSymbol: SymbolInfo;
    symbolHelper: SymbolsHelper;
    public addSymbols(symbolHelper: SymbolsHelper): void {
        this.symbolHelper = symbolHelper;
        this.parseIntSymbol = symbolHelper.registerSyntheticSymbol(null, 'parseInt');
    }
    public matchesNode(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return kataw.isIdentifier(call.expression) && call.expression.text == "parseInt" && this.symbolHelper.getSymbolAtLocation(call.expression) === this.parseIntSymbol;
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
