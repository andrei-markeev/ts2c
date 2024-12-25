import * as ts from 'typescript';

import { StandardCallHelper } from '../standard';
import { CType, NumberVarType, BooleanVarType, StringVarType, RegexVarType, ArrayType, StructType, DictType, FuncType, VoidType, PointerVarType } from './ctypes';
import { TypeMerger } from './merge';
import { TypeResolver } from './resolve';
import { findParentSourceFile } from './utils';


export class TypeHelper {

    private arrayLiteralsTypes: { [litArrayPos: number]: CType } = {};
    private objectLiteralsTypes: { [litObjectPos: number]: CType } = {};
    private typeOfNodeDict: { [id: string]: { type: CType } } = {};
    private typeMerger: TypeMerger = new TypeMerger();
    private typeResolver: TypeResolver;

    constructor(private typeChecker: ts.TypeChecker, allNodes: ts.Node[]) {
        this.typeResolver = new TypeResolver(typeChecker, allNodes, this, this.typeMerger, this.typeOfNodeDict);
    }

    public inferTypes() {
        this.typeResolver.inferTypes();
    }

    /** Get C type of TypeScript node */
    public getCType(node: ts.Node): CType {
        if (!node || !node.kind)
            return null;

        let found = this.typeOfNodeDict[node.pos + "_" + node.end];
        if (found)
            return found.type;

        switch (node.kind) {
            case ts.SyntaxKind.NumericLiteral:
                return NumberVarType;
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
                return BooleanVarType;
            case ts.SyntaxKind.StringLiteral:
                return StringVarType;
            case ts.SyntaxKind.RegularExpressionLiteral:
                return RegexVarType;
            case ts.SyntaxKind.ArrayLiteralExpression:
                {
                    if (!this.arrayLiteralsTypes[node.pos])
                        this.determineArrayType(<ts.ArrayLiteralExpression>node);
                    return this.arrayLiteralsTypes[node.pos];
                }
            case ts.SyntaxKind.ObjectLiteralExpression:
                {
                    if (!this.objectLiteralsTypes[node.pos])
                        this.objectLiteralsTypes[node.pos] = this.generateStructure(this.typeChecker.getTypeAtLocation(node));
                    return this.objectLiteralsTypes[node.pos];
                }
            case ts.SyntaxKind.CallExpression:
                {
                    let call = <ts.CallExpression>node;
                    let retType = StandardCallHelper.getReturnType(this, call);
                    if (retType)
                        return retType;
                }
        }

        if (node.kind != ts.SyntaxKind.ImportClause && node.pos != -1) {
            let tsType = this.typeChecker.getTypeAtLocation(node);
            let type = tsType && this.convertType(tsType, node);
            if (type)
                return type;
        }

        return null;
    }

    /** Get textual representation of type of the parameter for inserting into the C code */
    public getTypeString(source) {

        let cType = source;
        if (source && source.flags != null && source.intrinsicName != null) // ts.Type
            cType = this.convertType(source)
        else if (source && source.flags != null && source.callSignatures != null && source.constructSignatures != null) // ts.Type
            cType = this.convertType(source)
        else if (source && source.kind != null && source.flags != null) // ts.Node
            cType = this.getCType(source);

        if (cType instanceof ArrayType || cType instanceof StructType || cType instanceof DictType || cType instanceof FuncType)
            return cType.getText();
        else if (typeof cType === 'string')
            return cType;
        else
            return "/* Cannot determine variable type from source " + (source && source.getText ? source.getText() : JSON.stringify(source)) + "*/";
    }

    public getDeclaration(n: ts.Node) {
        let s = this.typeChecker.getSymbolAtLocation(n);
        return s && <ts.NamedDeclaration>s.valueDeclaration;
    }

    private static syntheticNodesCounter = 0;
    public registerSyntheticNode(n: ts.Node, t: CType) {
        if (!n || !(n.flags & ts.NodeFlags.Synthesized))
            return false;
        
        (n as any).end = TypeHelper.syntheticNodesCounter++;
        this.typeResolver.setNodeType(n, t);
    }

    private scopeVariables: { [pos: number]: boolean } = {};
    public registerScopeVariable(decl: ts.NamedDeclaration) {
        this.scopeVariables[decl.pos] = true;
    }
    public isScopeVariableDeclaration(decl: ts.NamedDeclaration) {
        return this.scopeVariables[decl.pos] || false;
    }
    public isScopeVariable(n: ts.Identifier) {
        const decl = this.getDeclaration(n);
        return decl && this.scopeVariables[decl.pos] || false;
    }

    /** Convert ts.Type to CType */
    private convertType(tsType: ts.Type, node?: ts.Node): CType {
        if (!tsType || tsType.flags == ts.TypeFlags.Void)
            return VoidType;

        if (tsType.flags == ts.TypeFlags.String || tsType.flags == ts.TypeFlags.StringLiteral)
            return StringVarType;
        if (tsType.flags == ts.TypeFlags.Number || tsType.flags == ts.TypeFlags.NumberLiteral)
            return NumberVarType;
        if (tsType.flags == ts.TypeFlags.Boolean || tsType.flags == (ts.TypeFlags.Boolean + ts.TypeFlags.Union))
            return BooleanVarType;
        if (tsType.flags & ts.TypeFlags.Object && tsType.getProperties().length > 0 && tsType.getProperties().every(s => /[a-zA-Z_]/.test(s.name))) {
            const structType = this.generateStructure(tsType);
            const baseType = this.typeChecker.getBaseTypeOfLiteralType(tsType);
            const cTypeTag = baseType && baseType.symbol && baseType.symbol.getJsDocTags().filter(t => t.name == "ctype")[0];
            structType.forcedType = cTypeTag && cTypeTag.text.map(t => t.text).join().trim();
            structType.external = baseType && baseType.symbol && findParentSourceFile(baseType.symbol.declarations[0]).isDeclarationFile;
            return structType;
        }

        return null;
    }

    private generateStructure(tsType: ts.Type): StructType {
        let userStructInfo = {};
        for (let prop of tsType.getProperties()) {
            if (prop.name == "prototype")
                continue;
            let declaration = <ts.NamedDeclaration>prop.valueDeclaration;
            let propTsType = this.typeChecker.getTypeOfSymbolAtLocation(prop, declaration);
            let propType = this.convertType(propTsType, <ts.Identifier>declaration.name) || PointerVarType;
            if (propType == PointerVarType && ts.isPropertyAssignment(declaration)) {
                if (declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer))
                    propType = this.determineArrayType(<ts.ArrayLiteralExpression>declaration.initializer);
            }
            userStructInfo[prop.name] = { type: propType, order: declaration.pos };
        }
        return this.typeMerger.ensureNoTypeDuplicates(new StructType(userStructInfo));
    }

    private determineArrayType(arrLiteral: ts.ArrayLiteralExpression): ArrayType {
        let elementType: CType = PointerVarType;
        let cap = arrLiteral.elements.length;
        if (cap > 0)
            elementType = this.convertType(this.typeChecker.getTypeAtLocation(arrLiteral.elements[0])) || PointerVarType;

        let type = new ArrayType(elementType, cap, false);
        this.arrayLiteralsTypes[arrLiteral.pos] = type;
        return type;
    }
}