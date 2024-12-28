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
            case ts.SyntaxKind.CallExpression:
                {
                    let call = <ts.CallExpression>node;
                    let retType = StandardCallHelper.getReturnType(this, call);
                    if (retType)
                        return retType;
                }
        }

        return null;
    }

    /** Get textual representation of type of the parameter for inserting into the C code */
    public getTypeString(cType: CType): string {
        if (cType instanceof ArrayType || cType instanceof StructType || cType instanceof DictType || cType instanceof FuncType)
            return cType.getText();
        else if (typeof cType === 'string')
            return cType;
        else
            return "/* Cannot determine variable type from source " + JSON.stringify(cType) + "*/";
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

    private determineArrayType(arrLiteral: ts.ArrayLiteralExpression): ArrayType {
        let elementType: CType = PointerVarType;
        let cap = arrLiteral.elements.length;
        if (cap > 0)
            elementType = this.getCType(arrLiteral.elements[0]) || PointerVarType;

        let type = new ArrayType(elementType, cap, false);
        this.arrayLiteralsTypes[arrLiteral.pos] = type;
        return type;
    }
}