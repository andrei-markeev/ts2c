import * as kataw from '@andrei-markeev/kataw';
import { CFunctionPrototype } from './nodes/function';
import { CodeTemplate } from './template';
import { IScope } from './program';
import { CVariable } from './nodes/variable';
import { SymbolsHelper } from './symbols';
import { TypeHelper } from './types/typehelper';
import { getNodeText, isFunctionDeclaration, isVariableDeclaration } from './types/utils';

@CodeTemplate(`
#ifndef {headerId}
#define {headerId}

{#if initFunctionName}
    int {initFunctionName}(void);
{/if}

{unsupported => /* Unsupported export: {this} */}

{userStructs => struct {name} {\n    {properties {    }=> {this};\n}\n};\n}

{variables => extern {this};\n}

{functionPrototypes => {this}\n}

#endif
`)
export class CHeader {
    public parent: IScope = null;
    public headerId: string = "";
    public unsupported: string[] = [];
    public userStructs: { name: string, properties: CVariable[] }[] = [];
    public variables: CVariable[] = [];
    public functionPrototypes: CFunctionPrototype[] = [];
    public initFunctionName: string = "";
    constructor(scope: IScope, rootNode: kataw.RootNode, public symbolsHelper: SymbolsHelper, public typeHelper: TypeHelper) {
        this.headerId = "TS2C_" + rootNode.fileName.replace(/(\.ts|\.js)$/, '_H').replace(/([A-Z])([a-z])/g, "$1_$2").replace(/[^A-Za-z_]+/g, "_").toUpperCase();
        this.initFunctionName = this.symbolsHelper.initFunctions[rootNode.id];
        const exportedSymbols = this.symbolsHelper.exportedSymbols[rootNode.id];
        for (const symbol of exportedSymbols) {
            if (isVariableDeclaration(symbol.valueDeclaration.parent))
                this.variables.push(new CVariable(scope, symbol.valueDeclaration.text, symbol.valueDeclaration, { removeStorageSpecifier: true }));
            else if (isFunctionDeclaration(symbol.valueDeclaration.parent))
                this.functionPrototypes.push(new CFunctionPrototype(scope, symbol.valueDeclaration.parent));
            else
                this.unsupported.push(getNodeText(symbol.valueDeclaration.parent));
        }
    }
}
