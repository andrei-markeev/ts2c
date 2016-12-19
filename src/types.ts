import * as ts from 'typescript';
import {StandardCallHelper} from './resolver';

export type CType = string | StructType | ArrayType | DictType;
export const UniversalVarType = "struct js_var *";
export const PointerVarType = "void *";
export const StringVarType = "const char *";
export const NumberVarType = "int16_t";
export const BooleanVarType = "uint8_t";

/** Type that represents static or dynamic array */
export class ArrayType {

    public static getArrayStructName(elementTypeText: string) {
        while (elementTypeText.indexOf(NumberVarType) > -1)
            elementTypeText = elementTypeText.replace(NumberVarType, "number");
        while (elementTypeText.indexOf(StringVarType) > -1)
            elementTypeText = elementTypeText.replace(StringVarType, "string");
        while (elementTypeText.indexOf(PointerVarType) > -1)
            elementTypeText = elementTypeText.replace(PointerVarType, "pointer");
        while (elementTypeText.indexOf(BooleanVarType) > -1)
            elementTypeText = elementTypeText.replace(BooleanVarType, "bool");

        elementTypeText = elementTypeText.replace(/^struct array_(.*)_t \*$/, (all, g1) => "array_" + g1);

        return "array_" +
            elementTypeText
                .replace(/^static /, '').replace('{var}', '').replace(/[\[\]]/g, '')
                .replace(/ /g, '_')
                .replace(/const char */g, 'string')
                .replace(/\*/g, '8') + "_t";
    }

    private structName: string;
    public getText() {

        let elementType = this.elementType;
        let elementTypeText;
        if (typeof elementType === 'string')
            elementTypeText = elementType;
        else
            elementTypeText = elementType.getText();

        this.structName = ArrayType.getArrayStructName(elementTypeText);

        if (this.isDynamicArray)
            return "struct " + this.structName + " *";
        else
            return "static " + elementTypeText + " {var}[" + this.capacity + "]";
    }
    constructor(
        public elementType: CType,
        public capacity: number,
        public isDynamicArray: boolean
    ) {
    }
}

type PropertiesDictionary = { [propName: string]: CType };

/** Type that represents JS object with static properties (implemented as C struct) */
export class StructType {
    public getText() {
        return this.structName;
    }
    constructor(
        private structName: string,
        public properties: PropertiesDictionary
    ) { }
}

/** Type that represents JS object with dynamic properties (implemented as dynamic dictionary) */
export class DictType {
    public getText() {
        let elementType = this.elementType;
        let elementTypeText;
        if (typeof elementType === 'string')
            elementTypeText = elementType;
        else
            elementTypeText = elementType.getText();

        return "DICT(" + elementTypeText + ")";
    }
    constructor(
        public elementType: CType
    ) { }
}

/** Information about a variable */
export class VariableInfo {
    /** Name of the variable */
    name: string;
    /** The final determined C type for this variable */
    type: CType;
    /** Contains all references to this variable */
    references: ts.Node[] = [];
    /** Where variable was declared */
    declaration: ts.VariableDeclaration;
    /** Determines if the variable requires memory allocation */
    requiresAllocation: boolean;
}

// forOfIterator ====> for <var> of <array_variable> ---> <var>.type = (type of <array_variable>).elementType
// forInIterator ====> for <var> in <dict_variable> ---> <var>.type = StringVarType
// dynamicArrayOf ====> <var>.push(<value>) ---> <var>.elementType = (type of <value>)
// propertyType ====> <var>[<string>] = <value> ---> <var>.properties[<string>] = (type of <value>)
// propertyType ====> <var>.<ident> = <value> ---> <var>.properties[<ident>] = (type of <value>)
// arrayOf ====> <var>[<number>] = <value> ---> <var>.elementType = (type of <value>)
// dictOf ====> <var>[<something>] = <value> ---> <var>.elementType = (type of <value>)

enum TypePromiseKind {
    variable,
    forOfIterator,
    forInIterator,
    propertyType,
    dynamicArrayOf,
    arrayOf,
    dictOf
}

class TypePromise {
    public bestType: CType;
    constructor(
        public associatedNode: ts.Node,
        public promiseKind: TypePromiseKind = TypePromiseKind.variable,
        public propertyName: string = null
    ) { }
}

type PromiseDictionary = { [promiseId: string]: TypePromise };

class VariableData {
    tsType: ts.Type;
    typePromises: { [id: string]: TypePromise } = {};
    addedProperties: { [propName: string]: CType } = {};
    parameterIndex: number;
    parameterFuncDeclPos: number;
    objLiteralAssigned: boolean = false;
    arrLiteralAssigned: boolean = false;
    isDynamicArray: boolean;
    isDict: boolean;
}


export class TypeHelper {

    private userStructs: { [name: string]: StructType } = {};
    private variablesData: { [varDeclPos: number]: VariableData } = {};
    private functionCallsData: { [funcDeclPos: number]: PromiseDictionary[] } = {};
    private functionReturnsData: { [funcDeclPos: number]: PromiseDictionary } = {};

    public variables: { [varDeclPos: number]: VariableInfo } = {};
    private functionReturnTypes: { [funcDeclPos: number]: CType } = {};
    private functionPrototypes: { [funcDeclPos: number]: ts.FunctionDeclaration } = {};
    private arrayLiteralsTypes: { [litArrayPos: number]: CType } = {};
    private objectLiteralsTypes: { [litObjectPos: number]: CType } = {};

    constructor(private typeChecker: ts.TypeChecker) { }

    /** Performs initialization of variables array */
    /** Call this before using getVariableInfo */
    public figureOutVariablesAndTypes(sources: ts.SourceFile[]) {

        for (let source of sources)
            this.findVariablesRecursively(source);
        this.resolvePromisesAndFinalizeTypes();

        let structs = this.getUserStructs();
        let functionPrototypes = Object.keys(this.functionPrototypes).map(k => this.functionPrototypes[k]);

        return [structs, functionPrototypes];

    }

    public getCType(node: ts.Node): CType {
        if (!node.kind)
            return null;
        switch (node.kind) {
            case ts.SyntaxKind.NumericLiteral:
                return NumberVarType;
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
                return BooleanVarType;
            case ts.SyntaxKind.StringLiteral:
                return StringVarType;
            case ts.SyntaxKind.Identifier:
                {
                    let varInfo = this.getVariableInfo(<ts.Identifier>node);
                    return varInfo && varInfo.type || null;
                }
            case ts.SyntaxKind.ElementAccessExpression:
                {
                    let elemAccess = <ts.ElementAccessExpression>node;
                    let parentObjectType = this.getCType(elemAccess.expression);
                    if (parentObjectType instanceof ArrayType)
                        return parentObjectType.elementType;
                    else if (parentObjectType instanceof StructType)
                        return parentObjectType.properties[elemAccess.argumentExpression.getText().slice(1, -1)];
                    else if (parentObjectType instanceof DictType)
                        return parentObjectType.elementType;
                    return null;
                }
            case ts.SyntaxKind.PropertyAccessExpression:
                {
                    let propAccess = <ts.PropertyAccessExpression>node;
                    let parentObjectType = this.getCType(propAccess.expression);
                    if (parentObjectType instanceof StructType)
                        return parentObjectType.properties[propAccess.name.getText()];
                    else if (parentObjectType instanceof ArrayType && propAccess.name.getText() == "length")
                        return NumberVarType;
                    else if (parentObjectType === StringVarType && propAccess.name.getText() == "length")
                        return NumberVarType;
                    return null;
                }
            case ts.SyntaxKind.CallExpression:
                {
                    let call = <ts.CallExpression>node;
                    let retType = StandardCallHelper.getReturnType(this, call);
                    if (retType)
                        return retType;

                    if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                        let propAccess = <ts.PropertyAccessExpression>call.expression;
                        let propName = propAccess.name.getText(); 
                        if ((propName == "indexOf" || propName == "lastIndexOf") && call.arguments.length == 1) {
                            let exprType = this.getCType(propAccess.expression);
                            if (exprType && exprType == StringVarType)
                                return NumberVarType;
                        }
                    } else if (call.expression.kind == ts.SyntaxKind.Identifier) {
                        let funcSymbol = this.typeChecker.getSymbolAtLocation(call.expression);
                        if (funcSymbol != null) {
                            let funcDeclPos = funcSymbol.valueDeclaration.pos + 1;
                            return this.functionReturnTypes[funcDeclPos];
                        }
                    }
                    return null;
                }
            case ts.SyntaxKind.ArrayLiteralExpression:
                return this.arrayLiteralsTypes[node.pos];
            case ts.SyntaxKind.ObjectLiteralExpression:
                return this.objectLiteralsTypes[node.pos];
            case ts.SyntaxKind.FunctionDeclaration:
                return this.functionReturnTypes[node.pos + 1] || 'void';
            default:
                {
                    let tsType = this.typeChecker.getTypeAtLocation(node);
                    let type = tsType && this.convertType(tsType);
                    if (type != UniversalVarType && type != PointerVarType)
                        return type;
                }
                return null;
        }
    }

    /** Get information of variable specified by ts.Identifier */
    public getVariableInfo(node: ts.Identifier): VariableInfo {
        let ident = node;
        let symbol = this.typeChecker.getSymbolAtLocation(ident);
        if (symbol != null)
            return this.variables[symbol.valueDeclaration.pos];
        else
            return null;
    }

    /** Get textual representation of type of the parameter for inserting into the C code */
    public getTypeString(source) {

        if (source.flags != null && source.intrinsicName != null) // ts.Type
            source = this.convertType(source)
        else if (source.flags != null && source.callSignatures != null && source.constructSignatures != null) // ts.Type
            source = this.convertType(source)
        else if (source.kind != null && source.flags != null) // ts.Node
            source = this.getCType(source);
        else if (source.name != null && source.flags != null && source.valueDeclaration != null && source.declarations != null) //ts.Symbol
            source = this.variables[source.valueDeclaration.pos].type;

        if (source instanceof ArrayType)
            return source.getText();
        else if (source instanceof StructType)
            return source.getText();
        else if (source instanceof DictType)
            return source.getText();
        else if (typeof source === 'string')
            return source;
        else
            throw new Error("Unrecognized type source");
    }

    private temporaryVariables: { [scopeId: string]: string[] } = {};
    private iteratorVarNames = ['i', 'j', 'k', 'l', 'm', 'n'];
    /** Generate name for a new iterator variable and register it in temporaryVariables table.
     * Generated name is guarantied not to conflict with any existing names in specified scope.
     */
    public addNewIteratorVariable(scopeNode: ts.Node): string {
        let parentFunc = this.findParentFunction(scopeNode);
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
    public addNewTemporaryVariable(scopeNode: ts.Node, proposedName: string): string {
        let parentFunc = this.findParentFunction(scopeNode);
        let scopeId = parentFunc && parentFunc.pos + 1 || 'main';
        let existingSymbolNames = this.typeChecker.getSymbolsInScope(scopeNode, ts.SymbolFlags.Variable).map(s => s.name);
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

    private getUserStructs() {
        return Object.keys(this.userStructs)
            .filter(k => Object.keys(this.userStructs[k].properties).length > 0)
            .map(k => {
                return {
                    name: k,
                    properties: Object.keys(this.userStructs[k].properties)
                        .map(pk => {
                            return {
                                name: pk,
                                type: this.userStructs[k].properties[pk]
                            };
                        })
                };
            });
    }

    /** Convert ts.Type to CType */
    /** Used mostly during type preprocessing stage */
    private convertType(tsType: ts.Type, ident?: ts.Identifier): CType {
        if (!tsType || tsType.flags == ts.TypeFlags.Void)
            return "void";

        if (tsType.flags == ts.TypeFlags.String || tsType.flags == ts.TypeFlags.StringLiteral)
            return StringVarType;
        if (tsType.flags == ts.TypeFlags.Number || tsType.flags == ts.TypeFlags.NumberLiteral)
            return NumberVarType;
        if (tsType.flags == ts.TypeFlags.Boolean || tsType.flags == (ts.TypeFlags.Boolean+ts.TypeFlags.Union))
            return BooleanVarType;

        if (tsType.flags & ts.TypeFlags.ObjectType && tsType.getProperties().length > 0) {
            return this.generateStructure(tsType, ident);
        }

        if (tsType.flags == ts.TypeFlags.Any)
            return PointerVarType;

        console.log("Non-standard type: " + this.typeChecker.typeToString(tsType));
        return PointerVarType;
    }

    private findParentFunction(node: ts.Node) {
        let parentFunc = node;
        while (parentFunc && parentFunc.kind != ts.SyntaxKind.FunctionDeclaration) {
            parentFunc = parentFunc.parent;
        }
        return parentFunc;
    }

    private findVariablesRecursively(node: ts.Node) {
        if (node.kind == ts.SyntaxKind.CallExpression) {
            let call = <ts.CallExpression>node;
            if (call.expression.kind == ts.SyntaxKind.Identifier) {
                let funcSymbol = this.typeChecker.getSymbolAtLocation(call.expression);
                if (funcSymbol != null) {
                    let funcDeclPos = funcSymbol.valueDeclaration.pos + 1;
                    if (funcDeclPos > call.pos)
                        this.functionPrototypes[funcDeclPos] = <ts.FunctionDeclaration>funcSymbol.valueDeclaration;
                    for (let i = 0; i < call.arguments.length; i++) {
                        if (!this.functionCallsData[funcDeclPos])
                            this.functionCallsData[funcDeclPos] = [];
                        let callData = this.functionCallsData[funcDeclPos];
                        let argId = call.arguments[i].pos + "_" + call.arguments[i].end;
                        if (!callData[i])
                            callData[i] = {};
                        callData[i][argId] = new TypePromise(call.arguments[i]);
                    }
                }
            }
        }
        else if (node.kind == ts.SyntaxKind.ReturnStatement) {
            let ret = <ts.ReturnStatement>node;
            let parentFunc = this.findParentFunction(node);
            let scopeId = parentFunc && parentFunc.pos + 1 || 'main';
            let promiseId = node.pos + "_" + node.end;
            if (!this.functionReturnsData[scopeId])
                this.functionReturnsData[scopeId] = {};
            if (ret.expression) {
                if (ret.expression.kind == ts.SyntaxKind.ConditionalExpression) {
                    let ternary = <ts.ConditionalExpression>ret.expression;
                    let whenTrueId = ternary.whenTrue.pos + "_" + ternary.whenTrue.end;
                    let whenFalseId = ternary.whenFalse.pos + "_" + ternary.whenFalse.end;
                    this.functionReturnsData[scopeId][whenTrueId] = new TypePromise(ternary.whenTrue);
                    this.functionReturnsData[scopeId][whenFalseId] = new TypePromise(ternary.whenFalse);
                } else
                    this.functionReturnsData[scopeId][promiseId] = new TypePromise(ret.expression);
            } else {
                this.functionReturnsData[scopeId][promiseId] = "void";
            }
        }
        else if (node.kind == ts.SyntaxKind.ArrayLiteralExpression) {
            if (!this.arrayLiteralsTypes[node.pos])
                this.determineArrayType(<ts.ArrayLiteralExpression>node);
            
            let arrType = this.arrayLiteralsTypes[node.pos];
            if (arrType instanceof ArrayType
                && node.parent.kind == ts.SyntaxKind.PropertyAccessExpression
                && node.parent.parent.kind == ts.SyntaxKind.CallExpression)
            {
                let propAccess = <ts.PropertyAccessExpression>node.parent;
                // if array literal is concated, we need to ensure that we
                // have corresponding dynamic array type for the temporary variable
                if (propAccess.name.getText() == "concat")
                    this.ensureArrayStruct(arrType.elementType);
            }
        }
        else if (node.kind == ts.SyntaxKind.ObjectLiteralExpression) {
            if (!this.objectLiteralsTypes[node.pos]) {
                let type = this.generateStructure(this.typeChecker.getTypeAtLocation(node));
                this.objectLiteralsTypes[node.pos] = type;
            }
        }
        else if (node.kind == ts.SyntaxKind.Identifier) {
            let symbol = this.typeChecker.getSymbolAtLocation(node);
            if (symbol) {

                let varPos = symbol.valueDeclaration.pos;
                if (!this.variables[varPos]) {
                    this.variables[varPos] = new VariableInfo();
                    this.variablesData[varPos] = new VariableData();
                    this.variables[varPos].name = node.getText();
                    this.variables[varPos].declaration = <ts.VariableDeclaration>symbol.declarations[0];
                    this.variablesData[varPos].tsType = this.typeChecker.getTypeAtLocation(node);
                }
                let varInfo = this.variables[varPos];
                let varData = this.variablesData[varPos];
                varInfo.references.push(node);

                if (node.parent && node.parent.kind == ts.SyntaxKind.VariableDeclaration) {
                    let varDecl = <ts.VariableDeclaration>node.parent;
                    if (varDecl.name.getText() == node.getText()) {
                        this.addTypePromise(varPos, varDecl.initializer);
                        if (varDecl.initializer && varDecl.initializer.kind == ts.SyntaxKind.ObjectLiteralExpression)
                            varData.objLiteralAssigned = true;
                        if (varDecl.initializer && varDecl.initializer.kind == ts.SyntaxKind.ArrayLiteralExpression)
                            varData.arrLiteralAssigned = true;
                        if (varDecl.parent && varDecl.parent.parent && varDecl.parent.parent.kind == ts.SyntaxKind.ForOfStatement) {
                            let forOfStatement = <ts.ForOfStatement>varDecl.parent.parent;
                            if (forOfStatement.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
                                let forOfInitializer = <ts.VariableDeclarationList>forOfStatement.initializer;
                                if (forOfInitializer.declarations[0].pos == varDecl.pos) {
                                    this.addTypePromise(varPos, forOfStatement.expression, TypePromiseKind.forOfIterator);
                                }
                            }
                        }
                        else if (varDecl.parent && varDecl.parent.parent && varDecl.parent.parent.kind == ts.SyntaxKind.ForInStatement) {
                            let forInStatement = <ts.ForInStatement>varDecl.parent.parent;
                            if (forInStatement.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
                                let forInInitializer = <ts.VariableDeclarationList>forInStatement.initializer;
                                if (forInInitializer.declarations[0].pos == varDecl.pos) {
                                    this.addTypePromise(varPos, forInStatement.expression, TypePromiseKind.forInIterator);
                                }
                            }
                        }
                    }
                }
                else if (node.parent && node.parent.kind == ts.SyntaxKind.Parameter) {
                    let funcDecl = <ts.FunctionDeclaration>node.parent.parent;
                    for (let i = 0; i < funcDecl.parameters.length; i++) {
                        if (funcDecl.parameters[i].pos == node.pos) {
                            let param = funcDecl.parameters[i];
                            varData.parameterIndex = i;
                            varData.parameterFuncDeclPos = funcDecl.pos + 1;
                            this.addTypePromise(varPos, param.name);
                            this.addTypePromise(varPos, param.initializer);
                            break;
                        }
                    }
                }
                else if (node.parent && node.parent.kind == ts.SyntaxKind.BinaryExpression) {
                    let binExpr = <ts.BinaryExpression>node.parent;
                    if (binExpr.left.kind == ts.SyntaxKind.Identifier
                        && binExpr.left.getText() == node.getText()
                        && binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                        this.addTypePromise(varPos, binExpr.left);
                        this.addTypePromise(varPos, binExpr.right);
                        if (binExpr.right && binExpr.right.kind == ts.SyntaxKind.ObjectLiteralExpression)
                            varData.objLiteralAssigned = true;
                        if (binExpr.right && binExpr.right.kind == ts.SyntaxKind.ArrayLiteralExpression)
                            varData.arrLiteralAssigned = true;
                    }
                }
                else if (node.parent && node.parent.kind == ts.SyntaxKind.PropertyAccessExpression) {
                    let propAccess = <ts.PropertyAccessExpression>node.parent;
                    let propName = propAccess.name.getText(); 
                    if (propAccess.expression.pos == node.pos && propAccess.parent.kind == ts.SyntaxKind.BinaryExpression) {
                        let binExpr = <ts.BinaryExpression>propAccess.parent;
                        if (binExpr.left.pos == propAccess.pos && binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                            this.addTypePromise(varPos, binExpr.left, TypePromiseKind.propertyType, propAccess.name.getText());
                            this.addTypePromise(varPos, binExpr.right, TypePromiseKind.propertyType, propAccess.name.getText());
                        }
                    }
                    if (propAccess.expression.kind == ts.SyntaxKind.Identifier && (propName == "push" || propName == "unshift")) {
                        varData.isDynamicArray = true;
                        if (propAccess.parent && propAccess.parent.kind == ts.SyntaxKind.CallExpression) {
                            let call = <ts.CallExpression>propAccess.parent;
                            for (let arg of call.arguments)
                                this.addTypePromise(varPos, arg, TypePromiseKind.dynamicArrayOf);
                        }
                    }
                    if (propAccess.expression.kind == ts.SyntaxKind.Identifier && (propName == "pop" || propName == "shift")) {
                        varData.isDynamicArray = true;
                        if (propAccess.parent && propAccess.parent.kind == ts.SyntaxKind.CallExpression) {
                            let call = <ts.CallExpression>propAccess.parent;
                            if (call.arguments.length == 0)
                                this.addTypePromise(varPos, call, TypePromiseKind.dynamicArrayOf);
                        }
                    }
                    if (propAccess.expression.kind == ts.SyntaxKind.Identifier && propName == "splice") {
                        varData.isDynamicArray = true;
                        if (propAccess.parent && propAccess.parent.kind == ts.SyntaxKind.CallExpression) {
                            let call = <ts.CallExpression>propAccess.parent;
                            if (call.arguments.length > 2) {
                                for (let arg of call.arguments.slice(2))
                                    this.addTypePromise(varPos, arg, TypePromiseKind.dynamicArrayOf);
                            }
                            if (call.arguments.length >= 2) {
                                this.addTypePromise(varPos, call);
                            }
                        }
                    }
                    if (propAccess.expression.kind == ts.SyntaxKind.Identifier && propName == "slice") {
                        varData.isDynamicArray = true;
                        if (propAccess.parent && propAccess.parent.kind == ts.SyntaxKind.CallExpression) {
                            let call = <ts.CallExpression>propAccess.parent;
                            if (call.arguments.length >= 1) {
                                this.addTypePromise(varPos, call);
                            }
                        }
                    }
                }
                else if (node.parent && node.parent.kind == ts.SyntaxKind.ElementAccessExpression) {
                    let elemAccess = <ts.ElementAccessExpression>node.parent;
                    if (elemAccess.expression.pos == node.pos) {

                        let propName;
                        let promiseKind;
                        if (elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                            propName = elemAccess.argumentExpression.getText().slice(1, -1);
                            promiseKind = TypePromiseKind.propertyType;
                        }
                        else if (elemAccess.argumentExpression.kind == ts.SyntaxKind.NumericLiteral) {
                            promiseKind = TypePromiseKind.arrayOf;
                        }
                        else {
                            varData.isDict = true;
                            promiseKind = TypePromiseKind.dictOf;
                        }

                        this.addTypePromise(varPos, elemAccess, promiseKind, propName);

                        if (elemAccess.parent && elemAccess.parent.kind == ts.SyntaxKind.BinaryExpression) {
                            let binExpr = <ts.BinaryExpression>elemAccess.parent;
                            if (binExpr.left.pos == elemAccess.pos && binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                                if (elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                                    this.addTypePromise(varPos, binExpr.right, promiseKind, propName);
                                }
                            }
                        }
                    }
                }
                else if (node.parent && node.parent.kind == ts.SyntaxKind.ForOfStatement) {
                    let forOfStatement = <ts.ForOfStatement>node.parent;
                    if (forOfStatement.initializer.kind == ts.SyntaxKind.Identifier && forOfStatement.initializer.pos == node.pos) {
                        this.addTypePromise(varPos, forOfStatement.expression, TypePromiseKind.forOfIterator);
                    }
                }
                else if (node.parent && node.parent.kind == ts.SyntaxKind.ForInStatement) {
                    let forInStatement = <ts.ForInStatement>node.parent;
                    if (forInStatement.initializer.kind == ts.SyntaxKind.Identifier && forInStatement.initializer.pos == node.pos) {
                        this.addTypePromise(varPos, forInStatement.expression, TypePromiseKind.forInIterator);
                    }
                }
            }
        }
        node.getChildren().forEach(c => this.findVariablesRecursively(c));
    }


    private resolvePromisesAndFinalizeTypes() {

        let somePromisesAreResolved: boolean;

        do {

            somePromisesAreResolved = this.tryResolvePromises();

            for (let k of Object.keys(this.variables).map(k => +k)) {
                let promises = Object.keys(this.variablesData[k].typePromises)
                    .map(p => this.variablesData[k].typePromises[p]);
                let variableBestTypes = promises
                    .filter(p => p.promiseKind != TypePromiseKind.propertyType)
                    .map(p => p.bestType);

                let varType = variableBestTypes.length ? variableBestTypes.reduce((c, n) => this.mergeTypes(c, n).type) : null;
                varType = varType || PointerVarType;

                if (varType instanceof ArrayType) {
                    if (this.variablesData[k].isDynamicArray && !this.variablesData[k].parameterFuncDeclPos && this.variablesData[k].arrLiteralAssigned)
                        this.variables[k].requiresAllocation = true;
                    varType.isDynamicArray = varType.isDynamicArray || this.variablesData[k].isDynamicArray;
                }
                else if (varType instanceof StructType) {
                    if (this.variablesData[k].objLiteralAssigned)
                        this.variables[k].requiresAllocation = true;
                    for (let addPropKey in this.variablesData[k].addedProperties) {
                        let addPropType = this.variablesData[k].addedProperties[addPropKey];
                        varType.properties[addPropKey] = addPropType;
                    }
                }
                else if (varType instanceof DictType) {
                    this.variables[k].requiresAllocation = true;
                    let elemType = varType.elementType;
                    for (let addPropKey in this.variablesData[k].addedProperties) {
                        let addPropType = this.variablesData[k].addedProperties[addPropKey];
                        let mergeResult = this.mergeTypes(elemType, addPropType);
                        elemType = mergeResult.type;
                    }
                    varType.elementType = elemType;
                }
                this.variables[k].type = varType;

            }

        } while (somePromisesAreResolved);

        for (let k of Object.keys(this.variables).map(k => +k))
            this.postProcessArrays(this.variables[k].type)

    }

    private postProcessArrays(varType: CType) {

        if (varType instanceof ArrayType && varType.isDynamicArray) {
            this.ensureArrayStruct(varType.elementType);
            this.postProcessArrays(varType.elementType);
        } else if (varType instanceof DictType) {
            this.postProcessArrays(varType.elementType);
        } else if (varType instanceof StructType) {
            for (let k in varType.properties) {
                this.postProcessArrays(varType.properties[k]);
            }
        }

    }

    private tryResolvePromises() {
        let somePromisesAreResolved = false;

        /** Function parameters */
        for (let varPos of Object.keys(this.variables).map(k => +k)) {
            let funcDeclPos = this.variablesData[varPos].parameterFuncDeclPos;
            if (funcDeclPos && this.functionCallsData[funcDeclPos]) {
                let paramIndex = this.variablesData[varPos].parameterIndex;
                let functionCallsPromises = this.functionCallsData[funcDeclPos][paramIndex];
                let variablePromises = this.variablesData[varPos].typePromises;
                for (let id in functionCallsPromises) {
                    if (!variablePromises[id]) {
                        variablePromises[id] = functionCallsPromises[id];
                        somePromisesAreResolved = true;
                    }
                    let currentType = variablePromises[id].bestType || PointerVarType;
                    let resolvedType = this.getCType(functionCallsPromises[id].associatedNode);
                    let mergeResult = this.mergeTypes(currentType, resolvedType);
                    if (mergeResult.replaced)
                        somePromisesAreResolved = true;
                    variablePromises[id].bestType = mergeResult.type;
                }
            }
        }

        /** Function return types */
        for (let funcDeclPos in this.functionReturnsData) {
            let promises = this.functionReturnsData[funcDeclPos];
            for (let id in promises) {
                let resolvedType = this.getCType(promises[id].associatedNode) || PointerVarType;

                let mergeResult = this.mergeTypes(this.functionReturnTypes[funcDeclPos], resolvedType);
                if (mergeResult.replaced)
                    somePromisesAreResolved = true;
                this.functionReturnTypes[funcDeclPos] = mergeResult.type;
            }
        }

        /** Variables */
        for (let varPos of Object.keys(this.variables).map(k => +k)) {

            for (let promiseId in this.variablesData[varPos].typePromises) {
                let promise = this.variablesData[varPos].typePromises[promiseId];
                let resolvedType = this.getCType(promise.associatedNode) || PointerVarType;

                let finalType = resolvedType;
                if (promise.promiseKind == TypePromiseKind.dynamicArrayOf) {
                    // nested arrays should also be dynamic
                    if (resolvedType instanceof ArrayType)
                        resolvedType.isDynamicArray = true;
                    finalType = new ArrayType(resolvedType, 0, true);
                }
                else if (promise.promiseKind == TypePromiseKind.arrayOf) {
                    finalType = new ArrayType(resolvedType, 0, false);
                }
                else if (promise.promiseKind == TypePromiseKind.dictOf) {
                    finalType = new DictType(resolvedType);
                }
                else if (resolvedType instanceof ArrayType && promise.promiseKind == TypePromiseKind.forOfIterator) {
                    finalType = resolvedType.elementType;
                }
                else if (resolvedType instanceof DictType && promise.promiseKind == TypePromiseKind.forInIterator) {
                    finalType = StringVarType;
                }

                let bestType = promise.bestType;
                if (promise.promiseKind == TypePromiseKind.propertyType)
                    bestType = this.variablesData[varPos].addedProperties[promise.propertyName];

                let mergeResult = this.mergeTypes(bestType, finalType);
                if (mergeResult.replaced)
                    somePromisesAreResolved = true;
                promise.bestType = mergeResult.type;

                if (promise.promiseKind == TypePromiseKind.propertyType && mergeResult.replaced)
                    this.variablesData[varPos].addedProperties[promise.propertyName] = mergeResult.type;
            }

        }

        return somePromisesAreResolved;

    }


    private generateStructure(tsType: ts.Type, ident?: ts.Identifier): StructType {
        var structName = "struct_" + Object.keys(this.userStructs).length + "_t";
        var varName = ident && ident.getText();
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
        let userStructInfo: PropertiesDictionary = {};
        for (let prop of tsType.getProperties()) {
            let propTsType = this.typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration);
            let propType = this.convertType(propTsType, <ts.Identifier>prop.valueDeclaration.name);
            if (propType == PointerVarType && prop.valueDeclaration.kind == ts.SyntaxKind.PropertyAssignment) {
                let propAssignment = <ts.PropertyAssignment>prop.valueDeclaration;
                if (propAssignment.initializer && propAssignment.initializer.kind == ts.SyntaxKind.ArrayLiteralExpression)
                    propType = this.determineArrayType(<ts.ArrayLiteralExpression>propAssignment.initializer);
            }
            userStructInfo[prop.name] = propType;
        }

        let userStructCode = this.getStructureBodyString(userStructInfo);

        var found = false;
        if (Object.keys(userStructInfo).length > 0) {
            for (var s in this.userStructs) {
                if (this.getStructureBodyString(this.userStructs[s].properties) == userStructCode) {
                    structName = s;
                    found = true;
                    break;
                }
            }
        }

        if (!found)
            this.userStructs[structName] = new StructType('struct ' + structName + ' *', userStructInfo);
        return this.userStructs[structName];
    }

    private getStructureBodyString(properties: PropertiesDictionary) {
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

    private determineArrayType(arrLiteral: ts.ArrayLiteralExpression): ArrayType | string {
        var elementType;
        if (arrLiteral.elements.length > 0)
            elementType = this.convertType(this.typeChecker.getTypeAtLocation(arrLiteral.elements[0]));
        else
            return UniversalVarType;

        let cap = arrLiteral.elements.length;
        let type = new ArrayType(elementType, cap, false);
        this.arrayLiteralsTypes[arrLiteral.pos] = type;
        return type;
    }

    private ensureArrayStruct(elementType: CType) {
        let elementTypeText = this.getTypeString(elementType);
        let structName = ArrayType.getArrayStructName(elementTypeText);
        this.userStructs[structName] = new StructType(structName, {
            size: NumberVarType,
            capacity: NumberVarType,
            data: elementTypeText + "*"
        });
    }

    private addTypePromise(varPos: number, associatedNode: ts.Node, promiseKind: TypePromiseKind = TypePromiseKind.variable, propName: string = null) {
        if (!associatedNode)
            return;
        let promiseId = associatedNode.pos + "_" + associatedNode.end;
        let promise = new TypePromise(associatedNode, promiseKind, propName);
        this.variablesData[varPos].typePromises[promiseId] = promise;
    }

    private mergeTypes(currentType: CType, newType: CType) {
        let newResult = { type: newType, replaced: true };
        let currentResult = { type: currentType, replaced: false };

        if (!currentType && newType)
            return newResult;
        else if (!newType)
            return currentResult;
        else if (this.getTypeString(currentType) == this.getTypeString(newType))
            return currentResult;
        else if (currentType == PointerVarType)
            return newResult;
        else if (newType == PointerVarType)
            return currentResult;
        else if (currentType == UniversalVarType)
            return newResult;
        else if (newType == UniversalVarType)
            return currentResult;
        else if (currentType instanceof ArrayType && newType instanceof ArrayType) {
            let cap = Math.max(newType.capacity, currentType.capacity);
            newType.capacity = cap;
            currentType.capacity = cap;
            let isDynamicArray = newType.isDynamicArray || currentType.isDynamicArray;
            newType.isDynamicArray = isDynamicArray;
            currentType.isDynamicArray = isDynamicArray;

            let mergeResult = this.mergeTypes(currentType.elementType, newType.elementType);
            newType.elementType = mergeResult.type;
            currentType.elementType = mergeResult.type;
            if (mergeResult.replaced)
                return newResult;

            return currentResult;
        }
        else if (currentType instanceof DictType && newType instanceof ArrayType) {
            if (newType.elementType == currentType.elementType || currentType.elementType == PointerVarType)
                return newResult;
        }
        else if (currentType instanceof ArrayType && newType instanceof DictType) {
            if (newType.elementType == currentType.elementType || newType.elementType == PointerVarType)
                return currentResult;
        }
        else if (currentType instanceof StructType && newType instanceof DictType) {
            return newResult;
        }
        else if (currentType instanceof DictType && newType instanceof DictType) {
            if (newType.elementType != PointerVarType && currentType.elementType == PointerVarType)
                return newResult;

            return currentResult;
        }

        console.log("WARNING: candidate for UniversalVarType! Current: " + this.getTypeString(currentType) + ", new: " + this.getTypeString(newType));
        return currentResult;
    }

}