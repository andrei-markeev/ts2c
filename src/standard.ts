import * as ts from 'typescript';
import { IScope } from './program';
import { CType } from './types/ctypes';
import { TypeHelper } from './types/typehelper';
import { CTemplateBase } from './template';

export interface IResolver {
    matchesNode(s: TypeHelper, n: ts.CallExpression, options?: IResolverMatchOptions): boolean;
    objectType?(s: TypeHelper, n: ts.CallExpression): CType;
    argumentTypes?(s: TypeHelper, n: ts.CallExpression): CType[];
    returnType(s: TypeHelper, n: ts.CallExpression): CType;
    needsDisposal(s: TypeHelper, n: ts.CallExpression): boolean;
    getTempVarName(s: TypeHelper, n: ts.CallExpression): string;
    createTemplate(s: IScope, n: ts.CallExpression): CTemplateBase;
    getEscapeNode(s: TypeHelper, n: ts.CallExpression): ts.Node;
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
    public static isStandardCall(typeHelper: TypeHelper, node: ts.Node) {
        if (!ts.isCallExpression(node))
            return false;
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return true;
        
        return false;
    }
    public static createTemplate(scope: IScope, node: ts.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(scope.root.typeHelper, node))
                return resolver.createTemplate(scope, node);
        
        return null;
    }
    public static getObjectType(typeHelper: TypeHelper, node: ts.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node, { determineObjectType: true }))
                return resolver.objectType ? resolver.objectType(typeHelper, node) : null;
        
        return null;
    }
    public static getArgumentTypes(typeHelper: TypeHelper, node: ts.CallExpression) {
        const notDefined = node.arguments.map(a => null);
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node, { determineObjectType: true }))
                return resolver.argumentTypes ? resolver.argumentTypes(typeHelper, node) : notDefined;
        
        return notDefined;
    }
    public static getReturnType(typeHelper: TypeHelper, node: ts.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return resolver.returnType(typeHelper, node);
        return null;
    }
    public static needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return resolver.needsDisposal(typeHelper, node);
        return false;
    }
    public static getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return resolver.getTempVarName(typeHelper, node);
        console.log("Internal error: cannot find matching resolver for node '" + node.getText() + "' in StandardCallHelper.getTempVarName");
        return "tmp";
    }
    public static getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return resolver.getEscapeNode(typeHelper, node);
        
        return null;
    }
}