import * as ts from 'typescript';
import {IScope} from './program';
import {CType, TypeHelper} from './types';

export interface IResolver {
    matchesNode(s: TypeHelper, n: ts.Node): boolean;
    returnType(): CType;
    createTemplate(s: IScope, n: ts.Node): any;
}

var standardCallResolvers: IResolver[] = [];
export function StandardCallResolver(target: any)
{
    standardCallResolvers.push(new target());
}
export class StandardCallHelper {
    public static createTemplate(scope: IScope, node: ts.Node) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(scope.root.typeHelper, node))
                return resolver.createTemplate(scope, node);
        
        return null;
    }
    public static getReturnType(typeHelper: TypeHelper, node: ts.Node) {
        for (var resolver of standardCallResolvers)
            if (resolver.matchesNode(typeHelper, node))
                return resolver.returnType();
    }
}