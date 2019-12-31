import * as ts from 'typescript';
import { isEqualsExpression, isFieldPropertyAccess, isFieldElementAccess } from './utils';

export class CircularTypesFinder {
    constructor(private allNodes: ts.Node[], private typeChecker: ts.TypeChecker) { }

    private assignments: { [key: string]: string[] } = {};
    private circularAssignments: { [pos: number]: { node: ts.Node, propChain: string[] } } = {};

    public findCircularAssignments() {
        this.circularAssignments = {};
        this.assignments = {};
        for (const node of this.allNodes) {
            if (isEqualsExpression(node) || ts.isVariableDeclaration(node)) {
                const left = isEqualsExpression(node) ? node.left : node.name;
                const right = isEqualsExpression(node) ? node.right : node.initializer;
                if (!left || !right)
                    continue;
                let lvar = left;
                const leftProps = [];
                while (isFieldPropertyAccess(lvar) || isFieldElementAccess(lvar)) {
                    if (isFieldPropertyAccess(lvar))
                        leftProps.unshift(lvar.name.text);
                    else if (isFieldElementAccess(lvar))
                        leftProps.unshift(lvar.argumentExpression.getText().slice(1, -1));
                    lvar = lvar.expression;
                }
                this.checkOneAssignment(node, lvar, leftProps, right);
            }
        }
        console.log(Object.keys(this.circularAssignments));
        return this.circularAssignments;
    }

    private checkOneAssignment(refNode: ts.Node, left: ts.Node, leftProps: string[], right: ts.Node) {
        if (ts.isObjectLiteralExpression(right)) {
            for (const prop of right.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name))
                    this.checkOneAssignment(refNode, left, leftProps.concat(prop.name.text), prop.initializer);
            }
            return;
        }
        const rightProps = [];
        while (isFieldPropertyAccess(right) || isFieldElementAccess(right)) {
            if (isFieldPropertyAccess(right))
                rightProps.unshift(right.name.text);
            else if (isFieldElementAccess(right))
                rightProps.unshift(right.argumentExpression.getText().slice(1, -1));
            right = right.expression;
        }
        const symbolRight = this.typeChecker.getSymbolAtLocation(right);
        const symbolLeft = this.typeChecker.getSymbolAtLocation(left);
        if (symbolRight && symbolLeft) {
            const key = symbolLeft.valueDeclaration.pos + "->" + leftProps.map(p => p + "->").join("");
            const value = symbolRight.valueDeclaration.pos + "->" + rightProps.map(p => p + "->").join("");
            if (key.indexOf(value) === 0 || Object.keys(this.assignments).filter(k => k.indexOf(value) === 0).some(k => this.assignments[k].some(a => key.indexOf(a) === 0)))
                this.circularAssignments[refNode.pos] = { node: symbolLeft.valueDeclaration, propChain: leftProps };
            this.assignments[key] = (this.assignments[key] || []).concat(value);
        }
    }


}