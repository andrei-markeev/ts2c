import * as ts from 'typescript';
import {GlobalContext} from './global';
import {Emitter, HeaderKey} from './emit';


export type CType = string | StructType | ArrayType;
export const UniversalVarType = "struct js_var *";
type PropertiesDictionary = { [propName: string]: CType };

export class TypePromise {
    public resolved: boolean = false;
    constructor(
        public ident: ts.Identifier,
        public argumentExpr: ts.Node
    ) { }
}

export class ArrayType {
    constructor(
        public text: string,
        public elementType: CType,
        public capacity: number
    ) { }
}

export class StructType {
    constructor(
        public text: string,
        public properties: PropertiesDictionary
    ) { }
}

export class VariableInfo {
    /** Name of the variable */
    name: string;
    /** The final determined C type for this variable */
    type: CType;
    /** Contains all references to this variable */
    references: ts.Node[] = [];
    /** Where variable was declared */
    declaration: ts.VariableDeclaration;
    /** Determines if it was detected that new elements are added to array using array.push */
    newElementsAdded: boolean;
    /** Determines if it was detected that properties are assigned */
    propsAssigned: boolean;
    /** Determines that properties of an object are assigned with non-trivial values and thus object is dictionary */
    isDict: boolean;
}

/** Internal class for storing temporary variable details */
class VariableData {
    tsType: ts.Type;
    assignmentTypes: { [type: string]: CType } = {};
    typePromises: TypePromise[] = [];
    addedProperties: PropertiesDictionary = {};
}

export class TypeHelper {
    private userStructs: { [name: string]: StructType } = {};
    public variables: { [varDeclPos: number]: VariableInfo } = {};
    private variablesData: { [varDeclPos: number]: VariableData } = {};

    constructor(private emitter: Emitter) {
    }

    /** Performs initialization of variables array */
    /** Call this before using getVariableInfo */
    public figureOutVariablesAndTypes(source: ts.SourceFile) {

        this.findVariablesRecursively(source);
        this.resolvePromisesAndFinalizeTypes();

        for (var structName in this.userStructs)
        {
            this.emitter.emitToHeader("struct " + structName + " " + this.getStructureBodyString(this.userStructs[structName].properties));
        }


    }

    /** Get information of variable specified by ts.Identifier */
    public getVariableInfo(ident: ts.Identifier) {
        var symbol = GlobalContext.typeChecker.getSymbolAtLocation(ident);
        if (symbol != null)
            return this.variables[symbol.valueDeclaration.pos];
        else
            return null;
    }

    /** Get CType textual representation for inserting into the C code */
    public getTypeString(type: CType) {
        if (type instanceof ArrayType)
            return type.text;
        else if (type instanceof StructType)
            return type.text;
        else
            return type;
    }

    /** Convert ts.Type to CType */
    /** This is a simplistic implementation: when possible, use getVariableInfo instead. */
    public convertType(tsType: ts.Type, ident?: ts.Identifier): CType {
        if (!tsType || tsType.flags == ts.TypeFlags.Void)
            return "void";

        if (tsType.flags == ts.TypeFlags.String)
            return "char *";
        if (tsType.flags == ts.TypeFlags.Number) {
            this.emitter.emitPredefinedHeader(HeaderKey.int16_t);
            return "int16_t";
        }
        if (tsType.flags == ts.TypeFlags.Boolean)
            return "uint8_t";

        if (tsType.flags & ts.TypeFlags.ObjectType && tsType.getProperties().length > 0) {
            return this.generateStructure(tsType, ident);
        }

        if (tsType.flags == ts.TypeFlags.Any)
            return "void *";

        console.log("Non-standard type: " + GlobalContext.typeChecker.typeToString(tsType));
        return UniversalVarType;
    }


    private findVariablesRecursively(node: ts.Node) {
        if (node.kind == ts.SyntaxKind.Identifier) {
            let symbol = GlobalContext.typeChecker.getSymbolAtLocation(node);
            if (!symbol) {
                return;
            }

            let varPos = symbol.valueDeclaration.pos;
            if (!this.variables[varPos]) {
                this.variables[varPos] = new VariableInfo();
                this.variablesData[varPos] = new VariableData();
                this.variables[varPos].name = node.getText();
                this.variables[varPos].declaration = <ts.VariableDeclaration>symbol.declarations[0];
            }
            let varInfo = this.variables[varPos];
            let varData = this.variablesData[varPos];
            varInfo.references.push(node);

            if (node.parent && node.parent.kind == ts.SyntaxKind.VariableDeclaration) {
                let varDecl = <ts.VariableDeclaration>node.parent;
                if (varDecl.name.getText() == node.getText()) {
                    varData.tsType = GlobalContext.typeChecker.getTypeAtLocation(varDecl.name);
                    this.addTypeToVariable(varPos, <ts.Identifier>varDecl.name, varDecl.initializer);
                    if (varDecl.initializer && varDecl.initializer.kind == ts.SyntaxKind.ObjectLiteralExpression)
                        varInfo.propsAssigned = true;
                }
            }
            else if (node.parent && node.parent.kind == ts.SyntaxKind.BinaryExpression) {
                let binExpr = <ts.BinaryExpression>node.parent;
                if (binExpr.left.kind == ts.SyntaxKind.Identifier && binExpr.left.getText() == node.getText()) {
                    this.addTypeToVariable(varPos, <ts.Identifier>binExpr.left, binExpr.right);
                    if (binExpr.right && binExpr.right.kind == ts.SyntaxKind.ObjectLiteralExpression)
                        varInfo.propsAssigned = true;
                }
            }
            else if (node.parent && node.parent.kind == ts.SyntaxKind.PropertyAccessExpression) {
                let propAccess = <ts.PropertyAccessExpression>node.parent;
                if (propAccess.expression.pos == node.pos && propAccess.parent.kind == ts.SyntaxKind.BinaryExpression) {
                    let binExpr = <ts.BinaryExpression>propAccess.parent;
                    if (binExpr.left.pos == propAccess.pos)
                        varInfo.propsAssigned = true;
                }
                if (propAccess.expression.kind == ts.SyntaxKind.Identifier && propAccess.name.getText() == "push") {
                    varInfo.newElementsAdded = true;
                }
            }
            else if (node.parent && node.parent.kind == ts.SyntaxKind.ElementAccessExpression) {
                let elemAccess = <ts.ElementAccessExpression>node.parent;
                if (elemAccess.expression.pos == node.pos) {
                    varInfo.propsAssigned = true;

                    if (elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {

                        let propName = elemAccess.argumentExpression.getText().slice(1, -1);
                        varData.addedProperties[propName] = varData.addedProperties[propName] || UniversalVarType;
                        if (elemAccess.parent && elemAccess.parent.kind == ts.SyntaxKind.BinaryExpression) {
                            let binExpr = <ts.BinaryExpression>elemAccess.parent;
                            if (binExpr.left.pos == elemAccess.pos) {
                                let determinedType = this.determineType(<ts.Identifier>elemAccess.expression, binExpr.right);
                                if (!(determinedType instanceof TypePromise))
                                    varData.addedProperties[propName] = determinedType;
                            }
                        }

                    }
                    else if (elemAccess.argumentExpression.kind != ts.SyntaxKind.NumericLiteral) {
                        varInfo.isDict = true;
                    }
                }
            }
        }
        node.getChildren().forEach(c => this.findVariablesRecursively(c));
    }


    private resolvePromisesAndFinalizeTypes() {
        let firstPass = true;
        let somePromisesAreResolved;
        do {
            somePromisesAreResolved = false;

            for (let k of Object.keys(this.variables).map(k => +k)) {

                if (this.variablesData[k].typePromises.length > 0) {
                    for (let promise of this.variablesData[k].typePromises.filter(p => !p.resolved)) {
                        let accessVarInfo = this.getVariableInfo(promise.ident);
                        if (accessVarInfo != null) {
                            promise.resolved = true;
                            somePromisesAreResolved = true;
                            let accessVarType = accessVarInfo.type;
                            if (accessVarType instanceof StructType) {
                                if (promise.argumentExpr.kind == ts.SyntaxKind.StringLiteral) {
                                    let propType = accessVarType.properties[promise.argumentExpr.getText().slice(1, -1)];
                                    if (propType instanceof StructType)
                                        this.variablesData[k].assignmentTypes[propType.text] = propType;
                                    else if (propType instanceof ArrayType)
                                        this.variablesData[k].assignmentTypes[propType.text] = propType;
                                    else
                                        this.variablesData[k].assignmentTypes[propType] = propType;
                                }
                            }
                            else if (accessVarType instanceof ArrayType) {
                                this.variablesData[k].assignmentTypes[this.getTypeString(accessVarType.elementType)] = accessVarType.elementType;
                            }
                        }
                    }
                }

                let types = Object.keys(this.variablesData[k].assignmentTypes).filter(t => t != "void *" && t != UniversalVarType);
                if (types.length == 1) {
                    let varType = this.variablesData[k].assignmentTypes[types[0]];
                    if (varType instanceof ArrayType && this.variables[k].newElementsAdded) {
                        varType.text = "ARRAY(" + varType.elementType + ")";
                        if (varType.elementType == UniversalVarType)
                            this.emitter.emitPredefinedHeader(HeaderKey.js_var);
                    } else if (varType instanceof StructType) {
                        for (let addPropKey in this.variablesData[k].addedProperties)
                        {
                            varType.properties[addPropKey] = this.variablesData[k].addedProperties[addPropKey];
                        }
                    }
                    this.variables[k].type = varType;
                }
                else if (types.length == 0) {
                    this.variables[k].type = "void *";
                }
                else {
                    this.emitter.emitPredefinedHeader(HeaderKey.js_var);
                    this.variables[k].type = "struct jvar *";
                }
            }

            if (firstPass) {
                firstPass = false;
                somePromisesAreResolved = true;
            }

        } while (somePromisesAreResolved);

    }

    private addTypeToVariable(varPos: number, left: ts.Identifier, right: ts.Node) {
        let determinedType = this.determineType(left, right);
        if (determinedType instanceof TypePromise)
            this.variablesData[varPos].typePromises.push(determinedType);
        else if (determinedType instanceof ArrayType)
            this.variablesData[varPos].assignmentTypes[determinedType.text] = determinedType;
        else if (determinedType instanceof StructType)
            this.variablesData[varPos].assignmentTypes[determinedType.text] = determinedType;
        else
            this.variablesData[varPos].assignmentTypes[determinedType] = determinedType;

    }

    private determineType(left: ts.Identifier, right: ts.Node): CType | TypePromise {
        let tsType = right ? GlobalContext.typeChecker.getTypeAtLocation(right) : GlobalContext.typeChecker.getTypeAtLocation(left);
        if (right && right.kind == ts.SyntaxKind.ObjectLiteralExpression)
            return this.generateStructure(tsType, left);
        else if (right && right.kind == ts.SyntaxKind.ArrayLiteralExpression)
            return this.determineArrayType(<ts.ArrayLiteralExpression>right);
        else if (right && right.kind == ts.SyntaxKind.ElementAccessExpression) {
            let accessExpr = <ts.ElementAccessExpression>right;
            if (accessExpr.expression.kind == ts.SyntaxKind.Identifier)
                return new TypePromise(<ts.Identifier>accessExpr.expression, accessExpr.argumentExpression);
            else
                return this.convertType(tsType, left);
        }
        else
            return this.convertType(tsType, left);
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
            let propTsType = GlobalContext.typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration);
            let propType = this.convertType(propTsType, <ts.Identifier>prop.valueDeclaration.name);
            userStructInfo[prop.name] = propType;
        }

        let userStructCode = this.getStructureBodyString(userStructInfo);

        var found = false;
        for (var s in this.userStructs) {
            if (this.getStructureBodyString(this.userStructs[s].properties) == userStructCode) {
                structName = s;
                found = true;
                break;
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
            if (typeof propType === 'string')
                userStructCode += '    ' + propType + ' ' + propName + ';\n';
            else
                userStructCode += '    ' + propType.text + ' ' + propName + ';\n';
        }
        userStructCode += "};\n"
        return userStructCode;
    }

    private determineArrayType(arrLiteral: ts.ArrayLiteralExpression): ArrayType {
        var elementType;
        if (arrLiteral.elements.length > 0)
            elementType = this.convertType(GlobalContext.typeChecker.getTypeAtLocation(arrLiteral.elements[0]));
        else
            elementType = UniversalVarType;

        var cap = arrLiteral.elements.length;
        return new ArrayType("static " + this.getTypeString(elementType) + " {var}[" + cap + "]", elementType, cap);
    }

}