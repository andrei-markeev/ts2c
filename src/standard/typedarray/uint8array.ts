import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { GlobalSymbolResolver, IGlobalSymbolResolver } from '../../standard';
import { ArrayType, NumberVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CExpression } from '../../nodes/expressions';
import { TypeHelper } from '../../types/typehelper';
import { SymbolInfo, SymbolsHelper } from '../../symbols';
import { isNumericLiteral } from '../../types/utils';
import { CVariable } from '../../nodes/variable';

@GlobalSymbolResolver
class Uint8ArrayConstructorResolver implements IGlobalSymbolResolver {
    uint8arraySymbol: SymbolInfo;
    symbolHelper: SymbolsHelper;
    public addSymbols(rootId: number, symbolHelper: SymbolsHelper): void {
        this.symbolHelper = symbolHelper;
        this.uint8arraySymbol = symbolHelper.registerSyntheticSymbol(rootId, null, 'Uint8Array', this);
    }
    public returnType(typeHelper: TypeHelper, call: kataw.CallExpression) {
        let capacity = 10;
        if (call.argumentList.elements.length === 1 && isNumericLiteral(call.argumentList.elements[0])) {
            capacity = +call.argumentList.elements[0].text;
            return new ArrayType('char', capacity, false);
        } else if (call.argumentList.elements.length === 1 && typeHelper.getCType(call.argumentList.elements[0]) === NumberVarType)
            return new ArrayType('char', 0, true);
        else
            console.error('Only "new Uint8Array(length)" is supported.')
    }
    public createTemplate(scope: IScope, call: kataw.CallExpression) {
        return new CUint8ArrayConstructor(scope, call);
    }
    public needsDisposal(typeHelper: TypeHelper, call: kataw.CallExpression) {
        return call.argumentList.elements.length === 1 && !isNumericLiteral(call.argumentList.elements[0]);
    }
    public getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return 'tmp_byte_array';
    }
    public getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
        return null;
    }
}

@CodeTemplate(`
    {#if isDynamic}
        {tmpVarName} = malloc({arg});
        assert({tmpVarName} != NULL);
    {/if}
    {#if gcVarName}
        ARRAY_PUSH({gcVarName}, (void *){tmpVarName});
    {/if}
`)
class CUint8ArrayConstructor extends CTemplateBase {
    public isDynamic: boolean = false;
    public arg: CExpression = null;
    public tmpVarName: string = "";
    public gcVarName: string = "";
    constructor(scope: IScope, call: kataw.CallExpression) {
        super();

        this.arg = CodeTemplateFactory.createForNode(scope, call.argumentList.elements[0]);
        this.isDynamic = !isNumericLiteral(call.argumentList.elements[0]);
        if (this.isDynamic) {
            this.tmpVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            scope.variables.push(new CVariable(scope, this.tmpVarName, "char *"));
            this.gcVarName = scope.root.memoryManager.getGCVariableForNode(call);
            if (this.gcVarName)
                scope.root.headerFlags.gc_iterator = true;
        }

    }

}
