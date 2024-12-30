import * as kataw from 'kataw';
import { IScope } from './program';
import { CType } from './types/ctypes';
import { TypeHelper } from './types/typehelper';
import { CTemplateBase } from './template';
import { getNodeText, isCall } from './types/utils';
import { SymbolsHelper } from './symbols';

export interface IResolver {
    addSymbols?(s: SymbolsHelper): void;
    matchesNode(s: TypeHelper, n: kataw.CallExpression, options?: IResolverMatchOptions): boolean;
    objectType?(s: TypeHelper, n: kataw.CallExpression): CType;
    argumentTypes?(s: TypeHelper, n: kataw.CallExpression): CType[];
    returnType(s: TypeHelper, n: kataw.CallExpression): CType;
    needsDisposal(s: TypeHelper, n: kataw.CallExpression): boolean;
    getTempVarName(s: TypeHelper, n: kataw.CallExpression): string;
    createTemplate(s: IScope, n: kataw.CallExpression): CTemplateBase;
    getEscapeNode(s: TypeHelper, n: kataw.CallExpression): kataw.SyntaxNode;
}

export interface IResolverMatchOptions {
    determineObjectType: boolean;
}

var standardCallResolvers: IResolver[] = [];
export function StandardCallResolver(target: { new(): IResolver })
{
    standardCallResolvers.push(new target());
}
export class StandardCallHelper {
    public static addSymbols(symbolHelper: SymbolsHelper) {
        for (var resolver of standardCallResolvers)
            resolver.addSymbols?.(symbolHelper);
    }
    public static isStandardCall(typeHelper: TypeHelper, node: kataw.SyntaxNode) {
        if (!isCall(node))
            return false;
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return true;
        
        return false;
    }
    public static createTemplate(scope: IScope, node: kataw.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(scope.root.typeHelper, node))
                return resolver.createTemplate(scope, node);
        
        return null;
    }
    public static getObjectType(typeHelper: TypeHelper, node: kataw.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node, { determineObjectType: true }))
                return resolver.objectType ? resolver.objectType(typeHelper, node) : null;
        
        return null;
    }
    public static getArgumentTypes(typeHelper: TypeHelper, node: kataw.CallExpression) {
        const notDefined = node.argumentList.elements.map(a => null);
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node, { determineObjectType: true }))
                return resolver.argumentTypes ? resolver.argumentTypes(typeHelper, node) : notDefined;
        
        return notDefined;
    }
    public static getReturnType(typeHelper: TypeHelper, node: kataw.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return resolver.returnType(typeHelper, node);
        return null;
    }
    public static needsDisposal(typeHelper: TypeHelper, node: kataw.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return resolver.needsDisposal(typeHelper, node);
        return false;
    }
    public static getTempVarName(typeHelper: TypeHelper, node: kataw.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return resolver.getTempVarName(typeHelper, node);
        console.log("Internal error: cannot find matching resolver for node '" + getNodeText(node) + "' in StandardCallHelper.getTempVarName");
        return "tmp";
    }
    public static getEscapeNode(typeHelper: TypeHelper, node: kataw.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return resolver.getEscapeNode(typeHelper, node);
        
        return null;
    }
}