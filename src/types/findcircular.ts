import * as kataw from '@andrei-markeev/kataw';
import { isEqualsExpression, isFieldPropertyAccess, isFieldElementAccess, isVariableDeclaration, isObjectLiteral, isPropertyDefinition, isStringLiteralAsIdentifier, isFieldPropertyAccessNotMethodCall, isFieldElementAccessNotMethodCall } from './utils';
import { SymbolsHelper } from '../symbols';

export class CircularTypesFinder {
    constructor(private allNodes: kataw.SyntaxNode[], private symbolsHelper: SymbolsHelper) { }

    private assignments: { [key: string]: string[] } = {};
    private circularAssignments: { [pos: number]: { node: kataw.SyntaxNode, propChain: string[] } } = {};

    public findCircularAssignments() {
        this.circularAssignments = {};
        this.assignments = {};
        for (const node of this.allNodes) {
            if (isEqualsExpression(node) || isVariableDeclaration(node)) {
                const left = isEqualsExpression(node) ? node.left : node.binding;
                const right = isEqualsExpression(node) ? node.right : node.initializer;
                if (!left || !right)
                    continue;
                let lvar = left;
                const leftProps = [];
                while (isFieldPropertyAccessNotMethodCall(lvar) || isFieldElementAccessNotMethodCall(lvar)) {
                    if (isFieldPropertyAccess(lvar) && kataw.isIdentifier(lvar.expression))
                        leftProps.unshift(lvar.expression.text);
                    else if (isFieldElementAccess(lvar) && isStringLiteralAsIdentifier(lvar.expression))
                        leftProps.unshift(lvar.expression.text);
                    lvar = lvar.member;
                }
                this.checkOneAssignment(node, lvar, leftProps, right);
            }
        }
        if (Object.keys(this.circularAssignments).length > 0)
            console.log(Object.keys(this.circularAssignments));
        return this.circularAssignments;
    }

    private checkOneAssignment(refNode: kataw.SyntaxNode, left: kataw.SyntaxNode, leftProps: string[], right: kataw.SyntaxNode) {
        if (isObjectLiteral(right)) {
            for (const prop of right.propertyList.properties) {
                if (isPropertyDefinition(prop) && kataw.isIdentifier(prop.left))
                    this.checkOneAssignment(refNode, left, leftProps.concat(prop.left.text), prop.right);
            }
            return;
        }
        const rightProps = [];
        while (isFieldPropertyAccess(right) || isFieldElementAccess(right)) {
            if (isFieldPropertyAccess(right) && kataw.isIdentifier(right.expression))
                rightProps.unshift(right.expression.text);
            else if (isFieldElementAccess(right) && isStringLiteralAsIdentifier(right.expression))
                rightProps.unshift(right.expression.text);
            right = right.expression;
        }
        const symbolRight = kataw.isIdentifier(right) ? this.symbolsHelper.getSymbolAtLocation(right) : null;
        const symbolLeft = kataw.isIdentifier(left) ? this.symbolsHelper.getSymbolAtLocation(left) : null;
        if (symbolRight && symbolRight.valueDeclaration && symbolLeft && symbolLeft.valueDeclaration) {
            const key = symbolLeft.valueDeclaration.start + "->" + leftProps.map(p => p + "->").join("");
            const value = symbolRight.valueDeclaration.start + "->" + rightProps.map(p => p + "->").join("");
            if (key.indexOf(value) === 0 || Object.keys(this.assignments).filter(k => k.indexOf(value) === 0).some(k => this.assignments[k].some(a => key.indexOf(a) === 0)))
                this.circularAssignments[refNode.start] = { node: symbolLeft.valueDeclaration, propChain: leftProps };
            this.assignments[key] = (this.assignments[key] || []).concat(value);
        }
    }


}