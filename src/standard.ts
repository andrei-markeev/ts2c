import * as kataw from '@andrei-markeev/kataw';
import { IScope } from './program';
import { CType } from './types/ctypes';
import { TypeHelper } from './types/typehelper';
import { CTemplateBase } from './template';
import { getNodeText, MaybeStandardCall } from './types/utils';
import { SymbolsHelper } from './symbols';

export interface IResolver<C extends kataw.CallExpression> {
    objectType?(s: TypeHelper, n: C): CType;
    argumentTypes?(s: TypeHelper, n: C): CType[];
    returnType(s: TypeHelper, n: C): CType;
    needsDisposal(s: TypeHelper, n: C): boolean;
    getTempVarName(s: TypeHelper, n: C): string;
    createTemplate(s: IScope, n: C): CTemplateBase;
    getEscapeNode(s: TypeHelper, n: C): kataw.SyntaxNode;
}

export interface ITypeExtensionResolver extends IResolver<MaybeStandardCall> {
    matchesNode(memberType: CType, options?: IResolverMatchOptions): boolean;
}

export interface IGlobalSymbolResolver extends IResolver<kataw.CallExpression> {
    addSymbols(rootId: number, s: SymbolsHelper): void;
}

export interface IResolverMatchOptions {
    determineObjectType: boolean;
}

export var StandardResolversByPropName: Record<string, ITypeExtensionResolver[]> = {};

var standardCallResolvers: ITypeExtensionResolver[] = [];
export function StandardCallResolver(...propNames: string[]) {
    return function (target: { new(): ITypeExtensionResolver })
    {
        const resolver = new target();
        standardCallResolvers.push(resolver);
        for (const propName of propNames) {
            if (!Array.isArray(StandardResolversByPropName[propName]))
                StandardResolversByPropName[propName] = [];
            StandardResolversByPropName[propName].push(resolver);
        }
    }
}

var globalSymbolResolvers: IGlobalSymbolResolver[] = [];
export function GlobalSymbolResolver(target: { new(): IGlobalSymbolResolver }) {
    globalSymbolResolvers.push(new target());
}

export class StandardCallHelper {
    constructor(private typeHelper: TypeHelper) { };

    public isStandardCall(call: MaybeStandardCall) {
        const memberType = this.typeHelper.getCType(call.expression.member);
        for (const resolver of StandardResolversByPropName[call.expression.expression.text]) {
            if (resolver.matchesNode(memberType))
                return true;
        }
        return false;
    }

    public matchStringPropName(member: kataw.ExpressionNode, stringPropName: string) {
        if (StandardResolversByPropName[stringPropName] === undefined)
            return false;
        const memberType = this.typeHelper.getCType(member);
        return canBeStandardCall(memberType, stringPropName);
    }

    public createTemplate(scope: IScope, call: MaybeStandardCall) {
        const memberType = this.typeHelper.getCType(call.expression.member);
        for (const resolver of StandardResolversByPropName[call.expression.expression.text]) {
            if (resolver.matchesNode(memberType))
                return resolver.createTemplate(scope, call);
        }
        return null;
    }
    public getObjectType(call: MaybeStandardCall) {
        const memberType = this.typeHelper.getCType(call.expression.member);
        for (const resolver of StandardResolversByPropName[call.expression.expression.text]) {
            if (resolver.objectType && resolver.matchesNode(memberType, { determineObjectType: true }))
                return resolver.objectType(this.typeHelper, call);
        }
        return null;
    }
    public getArgumentTypes(call: MaybeStandardCall) {
        const notDefined = call.argumentList.elements.map(a => null);
        const memberType = this.typeHelper.getCType(call.expression.member);
        for (const resolver of StandardResolversByPropName[call.expression.expression.text]) {
            if (resolver.argumentTypes && resolver.matchesNode(memberType, { determineObjectType: true }))
                return resolver.argumentTypes(this.typeHelper, call);
        }
        return notDefined;
    }
    public getReturnType(call: MaybeStandardCall) {
        const memberType = this.typeHelper.getCType(call.expression.member);
        for (const resolver of StandardResolversByPropName[call.expression.expression.text]) {
            if (resolver.matchesNode(memberType))
                return resolver.returnType(this.typeHelper, call);
        }
        return null;
    }
    public needsDisposal(call: MaybeStandardCall) {
        const memberType = this.typeHelper.getCType(call.expression.member);
        for (const resolver of StandardResolversByPropName[call.expression.expression.text]) {
            if (resolver.matchesNode(memberType))
                return resolver.needsDisposal(this.typeHelper, call);
        }
        return false;
    }
    public getTempVarName(call: MaybeStandardCall) {
        const memberType = this.typeHelper.getCType(call.expression.member);
        for (const resolver of StandardResolversByPropName[call.expression.expression.text]) {
            if (resolver.matchesNode(memberType))
                return resolver.getTempVarName(this.typeHelper, call);
        }
        console.warn("Internal error: cannot find matching resolver for node '" + getNodeText(call) + "' in StandardCallHelper.getTempVarName");
        return 'tmp';
    }
    public getEscapeNode(call: MaybeStandardCall) {
        const memberType = this.typeHelper.getCType(call.expression.member);
        for (const resolver of StandardResolversByPropName[call.expression.expression.text]) {
            if (resolver.matchesNode(memberType))
                return resolver.getEscapeNode(this.typeHelper, call);
        }
        return null;
    }
}

export function canBeStandardCall(memberType: CType, stringPropName: string) {
    if (StandardResolversByPropName[stringPropName] === undefined)
        return false;
    for (const resolver of StandardResolversByPropName[stringPropName]) {
        if (resolver.matchesNode(memberType))
            return true;
    }
    return false;
}

export function addStandardCallSymbols(rootId: number, symbolHelper: SymbolsHelper) {
    for (var resolver of globalSymbolResolvers)
        resolver.addSymbols(rootId, symbolHelper);
}
