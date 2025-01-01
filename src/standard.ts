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
    private typeHelper: TypeHelper = null;
    private resolverMap: Record<string, IResolver> = {};
    private objTypeResolverMap: Record<string, IResolver> = {};

    public init(typeHelper: TypeHelper) {
        this.typeHelper = typeHelper;
    }

    public bindResolvers(nodes: kataw.SyntaxNode[]) {
        for (const node of nodes) {
            if (!isCall(node))
                continue;

            for (var resolver of standardCallResolvers) {
                const key = node.start + "_" + node.end;
                if (resolver.matchesNode(this.typeHelper, node, { determineObjectType: true }))
                    this.objTypeResolverMap[key] = resolver;
                if (resolver.matchesNode(this.typeHelper, node))
                    this.resolverMap[key] = resolver;
            }
        }
    }
    public isStandardCall(node: kataw.SyntaxNode) {
        if (!isCall(node))
            return false;
        return this.resolverMap[node.start + "_" + node.end] !== undefined;
    }
    public createTemplate(scope: IScope, node: kataw.CallExpression) {
        const resolver = this.resolverMap[node.start + "_" + node.end];
        return resolver ? resolver.createTemplate(scope, node) : null;
    }
    public getObjectType(node: kataw.CallExpression) {
        const resolver = this.objTypeResolverMap[node.start + "_" + node.end];
        return resolver && resolver.objectType ? resolver.objectType(this.typeHelper, node) : null;
    }
    public getArgumentTypes(node: kataw.CallExpression) {
        const notDefined = node.argumentList.elements.map(a => null);
        const resolver = this.objTypeResolverMap[node.start + "_" + node.end];
        return resolver && resolver.argumentTypes ? resolver.argumentTypes(this.typeHelper, node) : notDefined;
    }
    public getReturnType(node: kataw.CallExpression) {
        const resolver = this.resolverMap[node.start + "_" + node.end];
        return resolver ? resolver.returnType(this.typeHelper, node) : null;
    }
    public needsDisposal(node: kataw.CallExpression) {
        const resolver = this.resolverMap[node.start + "_" + node.end];
        return resolver ? resolver.needsDisposal(this.typeHelper, node) : false;
    }
    public getTempVarName(node: kataw.CallExpression) {
        const resolver = this.resolverMap[node.start + "_" + node.end];
        if (!resolver)
            console.warn("Internal error: cannot find matching resolver for node '" + getNodeText(node) + "' in StandardCallHelper.getTempVarName");
        return resolver ? resolver.getTempVarName(this.typeHelper, node) : 'tmp';
    }
    public getEscapeNode(node: kataw.CallExpression) {
        const resolver = this.resolverMap[node.start + "_" + node.end];
        return resolver ? resolver.getEscapeNode(this.typeHelper, node) : null;
    }
}

export function addStandardCallSymbols(symbolHelper: SymbolsHelper) {
    for (var resolver of standardCallResolvers)
        resolver.addSymbols?.(symbolHelper);
}
