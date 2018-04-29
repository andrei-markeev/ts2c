import * as ts from 'typescript'
import * as is from './typeguards'
import { TypeHelper, CType, StructType, ArrayType, getDeclaration, findParentFunction, DictType } from './types';

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
    /** References to variables that represent properties of this variable */
    varDeclPosByPropName: { [key: string]: number };
}

export class SymbolsHelper {

    constructor(private typeChecker: ts.TypeChecker, private typeHelper: TypeHelper) { }

    private userStructs: { [name: string]: StructType } = {};

    private functionPrototypes: { [funcDeclPos: number]: ts.FunctionDeclaration } = {};
    
    public variables: { [varDeclPos: number]: VariableInfo } = {};
    
    public collectVariablesInfo(allNodes: ts.Node[]) {
        const findAssignedValue = (n: ts.Node) => {
            if (is.PropertyAssignment(n.parent) && n.parent.name == n)
                return n.parent.initializer;
            if (is.VariableDeclaration(n.parent) && n.parent.name == n)
                return n.parent.initializer;
            if (is.BinaryExpression(n.parent) && n.parent.left == n && n.parent.operatorToken.kind == ts.SyntaxKind.EqualsToken)
                return n.parent.right;
            return null;
        };
        allNodes.forEach(node => {
            let propsChain: any[] = [];
            let topNode = node;
            while (topNode) {
                if (is.PropertyAccessExpression(topNode)) {
                    propsChain.push([topNode, topNode.name.getText()]);
                    topNode = topNode.expression;
                } else if (is.ElementAccessExpression(topNode)) {
                    propsChain.push([topNode, topNode.argumentExpression.getText().replace(/^"(.*)"$/, "$1")]);
                    topNode = topNode.expression;
                } else
                    break;
            }
            if (is.Identifier(topNode)) {
                let tsSymbol = this.typeChecker.getSymbolAtLocation(topNode);
                if (!tsSymbol)
                    return;
                let varNode: (ts.NamedDeclaration | ts.PropertyAccessExpression | ts.ElementAccessExpression) = tsSymbol.valueDeclaration;
                let varName = tsSymbol.name;
                let varType = this.typeHelper.getCType(varNode);
                let varInfo: VariableInfo, propName: string, prop: [ts.NamedDeclaration | ts.PropertyAccessExpression | ts.ElementAccessExpression, string];
                do {
                    varInfo = this.variables[varNode.pos];
                    if (!varInfo) {
                        varInfo = this.variables[varNode.pos] = {
                            name: varName,
                            type: varType,
                            references: [ varNode ],
                            declaration: varNode,
                            requiresAllocation: false,
                            varDeclPosByPropName: {}
                        };
                        if (varInfo.type instanceof StructType) {
                            this.registerStructure(varInfo.type);
                            this.updateStructureName(varInfo.type, varName);
                        }
                    }
                    prop = propsChain.pop();
                    if (prop) {
                        [varNode, propName] = prop;
                        varName += "." + propName;
                        varInfo.varDeclPosByPropName[propName] = varNode.pos;
                        if (varInfo.type instanceof StructType)
                            varType = varInfo.type.properties[propName];
                        else if (varInfo.type instanceof DictType)
                            varType = varInfo.type.elementType;
                        else if (varInfo.type instanceof ArrayType)
                            varType = varInfo.type.elementType;
                        else
                            throw new Error("Internal error: element access expression is not compatible with type of " + varInfo.name);
                    }
                } while (prop)
            
                varInfo.references.push(node);
                let assigned = findAssignedValue(node);
                if (is.ObjectLiteralExpression(assigned) && varInfo.type instanceof StructType)
                    varInfo.requiresAllocation = true;
                if (is.ArrayLiteralExpression(assigned) && varInfo.type instanceof ArrayType)
                    varInfo.requiresAllocation = true;

            }
        });

        Object.keys(this.variables).forEach(k => console.log("VAR", this.variables[k].name, this.variables[k].declaration.getText(), this.variables[k].type));

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

    private registerStructure(structType: StructType) {
        let found = this.findStructByType(structType);
        if (!found) {
            structType.structName = "struct_" + Object.keys(this.userStructs).length + "_t";
            this.userStructs[structType.structName] = structType;
        }
    }

    private updateStructureName(structType: StructType, varName: string) {
        varName = varName.replace(/\./g, "_") + "_t";
        if (this.userStructs[varName] == null) {
            let found = this.findStructByType(structType);
            this.userStructs[varName] = this.userStructs[found];
            structType.structName = varName;
            delete this.userStructs[found];
        }
    }

    private findStructByType(structType: StructType) {
        let userStructCode = this.getStructureBodyString(structType.properties);

        var found = false;
        for (var s in this.userStructs) {
            if (this.getStructureBodyString(this.userStructs[s].properties) == userStructCode)
                return s;
        }

        return null;
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
    public getVariableInfo(node: ts.Node): VariableInfo {
        for (let k in this.variables)
            if (this.variables[k].references.some(r => r == node))
                return this.variables[k];
        
        return null;
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