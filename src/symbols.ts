import * as ts from 'typescript'
import * as is from './typeguards'
import { TypeHelper, CType, StructType, ArrayType, getDeclaration, processAllNodes, findParentFunction } from './types';

/** Information about a variable */
export class VariableInfo {
    /** Name of the variable */
    name: string;
    /** The final determined C type for this variable */
    type: CType;
    /** Contains all references to this variable */
    references: ts.Node[] = [];
    /** Where variable was declared */
    declaration: ts.Node;
    /** Determines if the variable requires memory allocation */
    requiresAllocation: boolean;
}

export class SymbolsHelper {

    constructor(private typeChecker: ts.TypeChecker, private typeHelper: TypeHelper) { }

    private userStructs: { [name: string]: StructType } = {};

    private functionPrototypes: { [funcDeclPos: number]: ts.FunctionDeclaration } = {};
    
    public variables: { [varDeclPos: number]: VariableInfo } = {};
    
    public collectVariablesInfo(startNode: ts.Node) {
        processAllNodes(startNode, node => {
            if (is.Identifier(node)) {
                let decl = getDeclaration(this.typeChecker, node);
                if (decl) {
                    let varInfo = this.variables[decl.pos];
                    if (!varInfo) {
                        varInfo = this.variables[decl.pos] = {
                            name: decl.name.getText(),
                            type: this.typeHelper.getCType(node),
                            references: [],
                            declaration: node,
                            requiresAllocation: false
                        };
                        if (varInfo.type instanceof StructType)
                            this.registerStructure(<StructType>varInfo.type, decl.name.getText());
                    }

                    varInfo.references.push(node);
                    if (is.ObjectLiteralExpression(node) && varInfo.type instanceof StructType)
                        varInfo.requiresAllocation = true;
                    if (is.ArrayLiteralExpression(node) && varInfo.type instanceof ArrayType)
                        varInfo.requiresAllocation = true;
                }
            }
        });

    }

    public getStructsAndFunctionPrototypes() {
        let structs = Object.keys(this.userStructs).map(k => ({
            name: k,
            properties: Object.keys(this.userStructs[k].properties).map(pk => ({
                name: pk,
                type: this.userStructs[k].properties[pk]
            }))
        }));
        let functionPrototypes = Object.keys(this.functionPrototypes).map(k => this.functionPrototypes[k]);

        return [structs, functionPrototypes];
    }

    private registerStructure(structType: StructType, varName?: string) {
        let structName = "struct_" + Object.keys(this.userStructs).length + "_t";
        if (varName) {
            if (this.userStructs[varName + "_t"] == null)
                structName = varName + "_t";
            else {
                let i = 2;
                while (this.userStructs[varName + "_" + i + "_t"] != null)
                    i++;
                structName = varName + "_" + i + "_t";
            }
        }

        let userStructCode = this.getStructureBodyString(structType.properties);

        var found = false;
        for (var s in this.userStructs) {
            if (this.getStructureBodyString(this.userStructs[s].properties) == userStructCode) {
                structName = s;
                found = true;
                break;
            }
        }

        if (!found) {
            this.userStructs[structName] = structType;
            structType.structName = structName;
        }
        return this.userStructs[structName];
    }

    private getStructureBodyString(properties) {
        let userStructCode = '{\n';
        for (let propName in properties) {
            let propType = properties[propName];
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
    
    /** Get information of variable specified by ts.Node */
    public getVariableInfo(node: ts.Node, propKey?: string): VariableInfo {
        let symbol = this.typeChecker.getSymbolAtLocation(node);
        let varPos = symbol ? symbol.valueDeclaration.pos : node.pos;
        let varInfo = this.variables[varPos];
        if (varInfo && propKey) {
            let propPos = varInfo.varDeclPosByPropName[propKey];
            varInfo = this.variables[propPos];
        }
        return varInfo;
    }

    private temporaryVariables: { [scopeId: string]: string[] } = {};
    private iteratorVarNames = ['i', 'j', 'k', 'l', 'm', 'n'];
    /** Generate name for a new iterator variable and register it in temporaryVariables table.
     * Generated name is guarantied not to conflict with any existing names in specified scope.
     */
    public addIterator(scopeNode: ts.Node): string {
        let parentFunc = findParentFunction(scopeNode);
        let scopeId = parentFunc && parentFunc.pos + 1 || 'main';
        let existingSymbolNames = this.typeChecker.getSymbolsInScope(scopeNode, ts.SymbolFlags.Variable).map(s => s.name);
        if (!this.temporaryVariables[scopeId])
            this.temporaryVariables[scopeId] = [];
        existingSymbolNames = existingSymbolNames.concat(this.temporaryVariables[scopeId]);
        let i = 0;
        while (i < this.iteratorVarNames.length && existingSymbolNames.indexOf(this.iteratorVarNames[i]) > -1)
            i++;
        let iteratorVarName;
        if (i == this.iteratorVarNames.length) {
            i = 2;
            while (existingSymbolNames.indexOf("i_" + i) > -1)
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
    public addTemp(scopeNode: ts.Node, proposedName: string): string {
        let parentFunc = findParentFunction(scopeNode);
        let scopeId = parentFunc && parentFunc.pos + 1 || 'main';
        let existingSymbolNames = scopeNode == null ? [] : this.typeChecker.getSymbolsInScope(scopeNode, ts.SymbolFlags.Variable).map(s => s.name);
        if (!this.temporaryVariables[scopeId])
            this.temporaryVariables[scopeId] = [];
        existingSymbolNames = existingSymbolNames.concat(this.temporaryVariables[scopeId]);
        if (existingSymbolNames.indexOf(proposedName) > -1) {
            let i = 2;
            while (existingSymbolNames.indexOf(proposedName + "_" + i) > -1)
                i++;
            proposedName = proposedName + "_" + i;
        }

        this.temporaryVariables[scopeId].push(proposedName);
        return proposedName;
    }
    
}