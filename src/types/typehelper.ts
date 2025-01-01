import * as kataw from 'kataw';

import { StandardCallHelper } from '../standard';
import { CType, NumberVarType, BooleanVarType, StringVarType, RegexVarType, ArrayType, StructType, DictType, FuncType, VoidType, PointerVarType } from './ctypes';
import { TypeMerger } from './merge';
import { TypeResolver } from './resolve';
import { SymbolsHelper } from '../symbols';


export class TypeHelper {

    private arrayLiteralsTypes: { [litArrayPos: number]: CType } = {};
    private typeOfNodeDict: { [id: string]: { type: CType } } = {};
    private typeMerger: TypeMerger = new TypeMerger();
    private typeResolver: TypeResolver;

    constructor(private symbolsHelper: SymbolsHelper, private standardCallHelper: StandardCallHelper) {
        this.standardCallHelper.init(this);
        this.typeResolver = new TypeResolver(this, symbolsHelper, this.standardCallHelper, this.typeMerger, this.typeOfNodeDict);
    }

    public inferTypes(nodes: kataw.SyntaxNode[]) {
        this.typeResolver.inferTypes(nodes);
    }

    /** Get C type of TypeScript node */
    public getCType(node: kataw.SyntaxNode): CType {
        if (!node || !node.kind)
            return null;

        let found = this.typeOfNodeDict[node.start + "_" + node.end];
        if (found)
            return found.type;

        switch (node.kind) {
            case kataw.SyntaxKind.NumericLiteral:
                return NumberVarType;
            case kataw.SyntaxKind.TrueKeyword:
            case kataw.SyntaxKind.FalseKeyword:
                return BooleanVarType;
            case kataw.SyntaxKind.StringLiteral:
                return StringVarType;
            case kataw.SyntaxKind.RegularExpressionLiteral:
                return RegexVarType;
            case kataw.SyntaxKind.ArrayLiteral:
                {
                    if (!this.arrayLiteralsTypes[node.start])
                        this.determineArrayType(<kataw.ArrayLiteral>node);
                    return this.arrayLiteralsTypes[node.start];
                }
            case kataw.SyntaxKind.CallExpression:
                {
                    let call = <kataw.CallExpression>node;
                    let retType = this.standardCallHelper.getReturnType(call);
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

    public getDeclaration(n: kataw.Identifier): kataw.Identifier {
        let s = this.symbolsHelper.getSymbolAtLocation(n);
        return s && s.valueDeclaration;
    }

    private static syntheticNodesCounter = 0;
    public registerSyntheticNode(n: kataw.SyntaxNode, t: CType) {
        if (!n/* || !(n.flags & ts.NodeFlags.Synthesized)*/)
            return false;
        
        n.end = TypeHelper.syntheticNodesCounter++;
        this.typeResolver.setNodeType(n, t);
    }

    private scopeVariables: { [pos: number]: boolean } = {};
    public registerScopeVariable(decl: kataw.Identifier) {
        this.scopeVariables[decl.start] = true;
    }
    public isScopeVariableDeclaration(decl: kataw.Identifier) {
        return this.scopeVariables[decl.start] || false;
    }
    public isScopeVariable(n: kataw.Identifier) {
        const decl = this.getDeclaration(n);
        return decl && this.scopeVariables[decl.start] || false;
    }

    private determineArrayType(arrLiteral: kataw.ArrayLiteral): ArrayType {
        let elementType: CType = PointerVarType;
        let cap = arrLiteral.elementList.elements.length;
        if (cap > 0)
            elementType = this.getCType(arrLiteral.elementList.elements[0]) || PointerVarType;

        let type = new ArrayType(elementType, cap, false);
        this.arrayLiteralsTypes[arrLiteral.start] = type;
        return type;
    }
}