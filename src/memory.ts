import * as ts from 'typescript';
import {TypeHelper, ArrayType, StructType} from './types';

type ScopeId = number | "main";
type VariableScopeInfo = {
    varPos: number;
    symbolId: number;
    declIdent: ts.Identifier;
    scopeId: ScopeId;
    simple: boolean
};

export class MemoryManager {
    private scopes: { [scopeId: string]: VariableScopeInfo[] } = {};
    private scopesOfVariables: { [varPos: number]: VariableScopeInfo } = {};

    constructor(private typeChecker: ts.TypeChecker, private typeHelper: TypeHelper) { }

    public preprocess() {

        for (let k in this.typeHelper.variables) {
            let v = this.typeHelper.variables[k];
            if (v.requiresAllocation)
                this.scheduleVariableDisposal(<ts.Identifier>v.declaration.name);
        }
    }

    public getGCVariableForScope(node: ts.Node) {
        let parentDecl = this.findParentFunctionNode(node);
        var scopeId: ScopeId = parentDecl && parentDecl.pos + 1 || "main";
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(v => !v.simple).length) {
            return "_gc_" + scopeId;
        }
        return null;
    }

    public getGCVariableForVariable(node: ts.Node, varPos: number) {
        let parentDecl = this.findParentFunctionNode(node);
        let scopeId: ScopeId = parentDecl && parentDecl.pos + 1 || "main";

        if (this.scopesOfVariables[varPos] && !this.scopesOfVariables[varPos].simple)
            return "_gc_" + this.scopesOfVariables[varPos].scopeId;
        else
            return null;
    }

    public getDestructorsForScope(node: ts.Node) {
        let parentDecl = this.findParentFunctionNode(node);
        let scopeId = parentDecl && parentDecl.pos + 1 || "main";
        let destructors = [];
        if (this.scopes[scopeId])
        {
            for (let simpleVarScopeInfo of this.scopes[scopeId].filter(v => v.simple)) {
                destructors.push(simpleVarScopeInfo.declIdent);
            }
        }
        return destructors;
    }

    public scheduleVariableDisposal(varIdent: ts.Identifier) {

        let varId = this.getSymbolId(varIdent);
        let varFuncNode = this.findParentFunctionNode(varIdent);
        let varPos = varIdent.pos;
        var scope: number | "main" = varFuncNode && varFuncNode.pos + 1 || "main"
        var isSimple = true;

        // TODO:
        // - calls from multiple external functions (only one of them is processed currently)
        // - circular references
        // - complicated call tree

        var queue = [varIdent];
        queue.push();
        while (queue.length > 0) {
            let node = queue.shift();

            let refs = this.typeHelper.getVariableInfo(node).references;
            let returned = false;
            for (let ref of refs) {
                let parentNode = this.findParentFunctionNode(ref);
                if (!parentNode)
                    scope = "main";

                if (ref.parent && ref.parent.kind == ts.SyntaxKind.BinaryExpression) {
                    let binaryExpr = <ts.BinaryExpression>ref.parent;
                    if (binaryExpr.operatorToken.kind == ts.SyntaxKind.FirstAssignment && binaryExpr.left.pos == ref.pos)
                        isSimple = false;
                }

                if (ref.parent && ref.parent.kind == ts.SyntaxKind.CallExpression) {
                    let call = <ts.CallExpression>ref.parent;
                    if (call.expression.kind == ts.SyntaxKind.Identifier && call.expression.pos == ref.pos) {
                        console.log(varIdent.getText() + " -> Found function call!");
                        if (scope !== "main") {
                            let funcNode = this.findParentFunctionNode(call);
                            scope = funcNode && funcNode.pos + 1 || "main";
                            isSimple = false;
                        }
                        this.addIfFoundInAssignment(varIdent, call, queue);
                    } else {
                        let symbol = this.typeChecker.getSymbolAtLocation(call.expression);
                        if (!symbol) {
                            if (call.expression.getText() != "console.log") {
                                console.log(varIdent.getText() + " -> Detected passing to external function " + call.expression.getText() + ". Scope changed to main.");
                                scope = "main";
                                isSimple = false;
                            }
                        }
                        else {
                            let funcDecl = <ts.FunctionDeclaration>symbol.valueDeclaration;
                            for (let i = 0; i < call.arguments.length; i++) {
                                if (call.arguments[i].kind == ts.SyntaxKind.Identifier && call.arguments[i].getText() == node.getText()) {
                                    console.log(varIdent.getText() + " -> Found passing to function " + call.expression.getText() + " as parameter " + funcDecl.parameters[i].name.getText());
                                    queue.push(<ts.Identifier>funcDecl.parameters[i].name);
                                    isSimple = false;
                                }
                            }
                        }
                    }
                }
                else if (ref.parent && ref.parent.kind == ts.SyntaxKind.ReturnStatement && !returned) {
                    returned = true;
                    queue.push(parentNode.name);
                    console.log(varIdent.getText() + " -> Found variable returned from the function!");
                    isSimple = false;
                }
                else
                    this.addIfFoundInAssignment(varIdent, ref, queue)
            }

        }

        var scopeInfo = { varPos: varPos, varId: varId, declIdent: varIdent, scopeId: scope, symbolId: varId, simple: isSimple };
        this.scopes[scope] = this.scopes[scope] || [];
        this.scopes[scope].push(scopeInfo);
        this.scopesOfVariables[varPos] = scopeInfo;

    }

    private addIfFoundInAssignment(varIdent: ts.Identifier, ref: ts.Node, queue: ts.Identifier[]): boolean {
        if (ref.parent && ref.parent.kind == ts.SyntaxKind.VariableDeclaration) {
            let varDecl = <ts.VariableDeclaration>ref.parent;
            if (varDecl.initializer && varDecl.initializer.pos == ref.pos) {
                queue.push(<ts.Identifier>varDecl.name);
                console.log(varIdent.getText() + " -> Found initializer-assignment to variable " + varDecl.name.getText());
                return true;
            }
        }
        else if (ref.parent && ref.parent.kind == ts.SyntaxKind.BinaryExpression) {
            let binaryExpr = <ts.BinaryExpression>ref.parent;
            if (binaryExpr.operatorToken.kind == ts.SyntaxKind.FirstAssignment && binaryExpr.right.pos == ref.pos) {
                // TODO: process non-identifier left hand side expressions
                queue.push(<ts.Identifier>binaryExpr.left);
                console.log(varIdent.getText() + " -> Found assignment to variable " + binaryExpr.left.getText());
                return true;
            }
        }

        return false;
    }

    private findParentFunctionNode(node: ts.Node) {
        var parent = node;
        while (parent && parent.kind != ts.SyntaxKind.FunctionDeclaration) {
            parent = parent.parent;
        }
        return <ts.FunctionDeclaration>parent;
    }

    private getSymbolId(node: ts.Node) {
        return this.typeChecker.getSymbolAtLocation(node)["id"];
    }

}