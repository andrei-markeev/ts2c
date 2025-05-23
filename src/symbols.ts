import * as kataw from '@andrei-markeev/kataw'
import { CType, StructType, ArrayType, NumberVarType, FuncType } from './types/ctypes';
import { TypeHelper } from './types/typehelper';
import { findParentFunction, isEqualsExpression, isFieldPropertyAccess, isObjectLiteral, isPropertyDefinition, isStringLiteral, isVariableDeclaration } from './types/utils';
import { reservedCSymbolNames } from './program';
import { IGlobalSymbolResolver } from './standard';

export interface SymbolInfo {
    id: number;
    parent: SymbolInfo | undefined;
    valueDeclaration: kataw.Identifier | undefined;
    references: kataw.Identifier[];
    members: SymbolInfo[];
    conflict: boolean;
    resolver?: IGlobalSymbolResolver;
}

export interface SymbolScope {
    symbols: Record<string, SymbolInfo>;
    parent: SymbolScope;
    start: number;
    end: number;
}

export class SymbolsHelper {
    constructor() { }

    private userStructs: { [name: string]: StructType } = {};
    private arrayStructs: CType[] = [];

    private scopes: SymbolScope[] = [];
    private nextId = 1;
    public globalSymbolsWithResolvers: SymbolInfo[] = [];

    public createSymbolScope(start: number, end: number) {
        const currentScope = this.findSymbolScope({ start, end });
        const newScope = {
            symbols: {},
            parent: currentScope,
            start: start,
            end: end
        };
        this.scopes.push(newScope);
        return newScope;
    }

    public registerSymbol(node: kataw.Identifier) {
        let [path, parent] = this.getSymbolPath(node);
        if (!path)
            return;
        this.findSymbolScope(node).symbols[path] = {
            id: this.nextId++,
            parent: parent,
            valueDeclaration: node,
            references: [node],
            members: [],
            conflict: node.text === path && reservedCSymbolNames.indexOf(path) > -1
        };
    }

    public registerSyntheticSymbol(parentSymbol: SymbolInfo | null, name: string, resolver?: IGlobalSymbolResolver) {
        let symbolPath = name;
        if (parentSymbol)
            symbolPath = parentSymbol.id + ":" + symbolPath;

        const symbol = {
            id: this.nextId++,
            parent: parentSymbol,
            valueDeclaration: undefined,
            references: [],
            members: [],
            conflict: false,
            resolver
        };

        this.scopes[0].symbols[symbolPath] = symbol;
        if (resolver)
            this.globalSymbolsWithResolvers.push(symbol);

        return symbol;
    }

    public addReference(node: kataw.Identifier) {
        const symbol = this.getSymbolAtLocation(node);
        if (!symbol) {
            return;
        }

        if (symbol.references.indexOf(node) === -1)
            symbol.references.push(node);
    }

    public getSymbolAtLocation(node: kataw.SyntaxNode) {
        const [symbolPath] = this.getSymbolPath(node);
        if (!symbolPath)
            return;
        return this.getSymbolByPath(node, symbolPath);
    }

    private getSymbolByPath(span: { start: number, end: number }, path: string) {
        let scope = this.findSymbolScope(span)
        let found: SymbolInfo | undefined = undefined;
        while (scope && !found) {
            found = scope.symbols[path];
            scope = scope.parent;
        }
        return found;
    }

    private getSymbolPath(node: kataw.SyntaxNode) {
        let parentSymbol: SymbolInfo = null;
        let mustHaveParent = false;
        if (isPropertyDefinition(node.parent) && node.parent.left === node) {
            mustHaveParent = true;
            let propDefinitionList = <kataw.PropertyDefinitionList>node.parent.parent;
            if (!isObjectLiteral(propDefinitionList.parent))
                return [null, null];
            let objLiteralParent = propDefinitionList.parent.parent;
            if (isVariableDeclaration(objLiteralParent))
                parentSymbol = this.getSymbolAtLocation(objLiteralParent.binding);
            else if (isPropertyDefinition(objLiteralParent))
                parentSymbol = this.getSymbolAtLocation(objLiteralParent.left);
            else if (isEqualsExpression(objLiteralParent) && kataw.isIdentifier(objLiteralParent.left))
                parentSymbol = this.getSymbolAtLocation(objLiteralParent.left);
            else
                return [null, null];
        } else if (isFieldPropertyAccess(node.parent) && node.parent.expression === node) {
            mustHaveParent = true;
            parentSymbol = kataw.isIdentifier(node.parent.member) && this.getSymbolAtLocation(node.parent.member);
        } else if (isFieldPropertyAccess(node)) {
            mustHaveParent = true;
            parentSymbol = this.getSymbolAtLocation(node.member);
            node = node.expression;
        }

        if (mustHaveParent && !parentSymbol) {
            return [null, null];
        }

        let symbolPath = null;
        if (kataw.isIdentifier(node))
            symbolPath = node.text;
        else if (isStringLiteral(node))
            symbolPath = node.text;
        else
            return [null, null];

        if (parentSymbol)
            symbolPath = parentSymbol.id + ":" + symbolPath;

        return [symbolPath, parentSymbol];
    }

    public findSymbolScope(span: { start: number, end: number }) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            const scope = this.scopes[i];
            if (span.start >= scope.start && span.end <= scope.end)
                return scope;
        }
        return undefined;
    }

    public isGlobalSymbol(node: kataw.Identifier) {
        const symbol = this.getSymbolAtLocation(node);
        if (!symbol)
            return false;
        if (symbol.parent)
            return false;
        if (!symbol.valueDeclaration)
            return true;
        const scope = this.findSymbolScope(symbol.valueDeclaration);
        return !scope.parent;
    }

    public addStandardSymbols() {
        this.registerSyntheticSymbol(null, 'NaN');
        this.registerSyntheticSymbol(null, 'undefined');
    }

    // TODO: improve
    // current system doesn't account for conflicting renames
    public renameConflictingSymbols() {
        for (const scope of this.scopes)
            for (const path in scope.symbols) {
                const symb = scope.symbols[path];
                if (symb.conflict) {
                    const newName = path + "_";
                    scope.symbols[path] = undefined;
                    scope.symbols[newName] = symb;
                    symb.conflict = false;
                    for (const ref of symb.references)
                        (ref as any).text = newName;
                }
            }
    }

    public getStructsAndFunctionPrototypes(typeHelper: TypeHelper) {

        for (let arrElemType of this.arrayStructs) {
            let elementTypeText = typeHelper.getTypeString(arrElemType);
            let structName = ArrayType.getArrayStructName(elementTypeText);
            this.userStructs[structName] = new StructType({
                size: { type: NumberVarType, order: 1 },
                capacity: { type: NumberVarType, order: 2 },
                data: { type: elementTypeText + "*", order: 3 }
            });
            this.userStructs[structName].structName = structName;
        }

        let structs = Object.keys(this.userStructs).filter(k => !this.userStructs[k].external).map(k => ({
            name: k,
            properties: Object.keys(this.userStructs[k].properties).map(pk => ({
                name: pk,
                type: this.userStructs[k].properties[pk]
            }))
        }));

        return [structs];
    }

    public ensureClosureStruct(type: FuncType, parentFuncType: FuncType, name: string) {
        if (!type.structName)
            type.structName = name + "_t";
        const params = {
            func: { type: type.getText(true), order: 0 },
            scope: { type: parentFuncType.scopeType || "void *", order: 1 }
        };
        const closureStruct = new StructType(params);
        let found = this.findStructByType(closureStruct);
        if (!found)
            this.userStructs[type.structName] = closureStruct;
    }

    public ensureStruct(structType: StructType, name: string) {
        if (!structType.structName) {
            let structName = name + "_t";
            if (this.symbolOrTempVarExists('main', null, structName)) {
                let i = 2;
                while (this.symbolOrTempVarExists('main', null, structName + "_" + i))
                    i++;
                structName = structName + "_" + i;
            }
            structType.structName = structName;
            this.temporaryVariables['main'].push(structName);
        }

        let found = this.findStructByType(structType);
        if (!found)
            this.userStructs[structType.structName] = structType;
    }

    public ensureArrayStruct(typeHelper: TypeHelper, elementType: CType) {
        if (this.arrayStructs.every(s => typeHelper.getTypeString(s) !== typeHelper.getTypeString(elementType)))
            this.arrayStructs.push(elementType);
    }

    private findStructByType(structType: StructType) {
        let userStructCode = this.getStructureBodyString(structType);

        for (var s in this.userStructs) {
            if (this.getStructureBodyString(this.userStructs[s]) == userStructCode)
                return s;
        }

        return null;
    }

    private getStructureBodyString(structType: StructType) {
        let userStructCode = '{\n';
        for (let propName in structType.properties) {
            let propType = structType.propertyDefs[propName].type;
            if (typeof propType === 'string') {
                userStructCode += '    ' + propType + ' ' + propName + ';\n';
            } else if (propType instanceof ArrayType) {
                let propTypeText = propType.getText();
                if (propTypeText.indexOf("{var}") > -1)
                    userStructCode += '    ' + propTypeText.replace(/^static /, '').replace("{var}", propName) + ';\n';
                else
                    userStructCode += '    ' + propTypeText + ' ' + propName + ';\n';
            } else {
                userStructCode += '    ' + propType.getText() + ' ' + propName + ';\n';
            }
        }
        userStructCode += "};\n"
        return userStructCode;
    }

    private symbolOrTempVarExists(scopeId: string | number, scopeNode: kataw.SyntaxNode, varName: string) {
        return this.temporaryVariables[scopeId].indexOf(varName) > -1
            || scopeNode && this.getSymbolByPath(scopeNode, varName) !== undefined
            || this.scopes[0].symbols[varName] !== undefined;
    }

    private temporaryVariables: { [scopeId: string]: string[] } = {
        "main": reservedCSymbolNames
    };
    private iteratorVarNames = ['i', 'j', 'k', 'l', 'm', 'n'];
    /** Generate name for a new iterator variable and register it in temporaryVariables table.
     * Generated name is guarantied not to conflict with any existing names in specified scope.
     */
    public addIterator(scopeNode: kataw.SyntaxNode): string {
        let parentFunc = findParentFunction(scopeNode);
        let scopeId = parentFunc && parentFunc.start + 1 || 'main';
        if (!this.temporaryVariables[scopeId])
            this.temporaryVariables[scopeId] = [];
        let i = 0;
        while (i < this.iteratorVarNames.length && this.symbolOrTempVarExists(scopeId, scopeNode, this.iteratorVarNames[i]))
            i++;
        let iteratorVarName;
        if (i == this.iteratorVarNames.length) {
            i = 2;
            while (this.symbolOrTempVarExists(scopeId, scopeNode, 'i_' + i))
                i++;
            iteratorVarName = "i_" + i;
        }
        else
            iteratorVarName = this.iteratorVarNames[i];

        this.temporaryVariables[scopeId].push(iteratorVarName);
        return iteratorVarName;
    }

    /** Generate name for a new temporary variable and register it in temporaryVariables table.
     * Generated name is guarantied not to conflict with any existing names in specified scope.
     */
    public addTemp(scopeNode: kataw.SyntaxNode, proposedName: string, reserve: boolean = true): string {
        let parentFunc = findParentFunction(scopeNode);
        let scopeId = parentFunc && parentFunc.start + 1 || 'main';
        if (!this.temporaryVariables[scopeId])
            this.temporaryVariables[scopeId] = [];
        if (this.symbolOrTempVarExists(scopeId, scopeNode, proposedName)) {
            let i = 2;
            while (this.symbolOrTempVarExists(scopeId, scopeNode, proposedName + "_" + i))
                i++;
            proposedName = proposedName + "_" + i;
        }

        if (reserve)
            this.temporaryVariables[scopeId].push(proposedName);
        return proposedName;
    }

    private closureVarNames: { [pos: number]: string } = [];
    public getClosureVarName(node: kataw.SyntaxNode) {
        if (!this.closureVarNames[node.start]) {
            const name = this.addTemp(node, "closure");
            this.closureVarNames[node.start] = name;
        }
        return this.closureVarNames[node.start];
    }

    private scopeVarNames: { [pos: number]: string } = [];
    public getScopeVarName(node: kataw.SyntaxNode) {
        if (!this.scopeVarNames[node.start]) {
            const name = this.addTemp(node, "scope");
            this.scopeVarNames[node.start] = name;
        }
        return this.scopeVarNames[node.start];
    }

}