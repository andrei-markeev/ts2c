import * as ts from 'typescript';
import {GlobalContext} from './global';
import {Emitter, HeaderKey} from './emit';
import {TypeHelper, ArrayType, StructType} from './types';

type VariableScopeInfo = { varPos: number, symbolId: number, declIdent: ts.Identifier, scopeId: number | "main" };

export class MemoryManager {
    private scopes: { [scopeId: number]: VariableScopeInfo[] } = {};
    private scopesOfVariables: { [varPos: number]: VariableScopeInfo } = {};

    constructor(private typeHelper: TypeHelper) { }

    public preprocess() {

        for (let k in this.typeHelper.variables) {
            let v = this.typeHelper.variables[k];
            if (v.type instanceof ArrayType && v.newElementsAdded
                || v.type instanceof StructType && v.propsAssigned)
                this.scheduleVariableDisposal(<ts.Identifier>this.typeHelper.variables[k].declaration.name);
        }
    }

    public insertGCVariablesCreationIfNecessary(funcDecl: ts.FunctionDeclaration, emitter: Emitter) {
        var scopeId = funcDecl && funcDecl.pos + 1 || "main";
        if (this.scopes[scopeId] && this.scopes[scopeId].length) {
            emitter.emitToHeader("ARRAY(void *) _gc_" + scopeId + ";\n");
            emitter.emit("ARRAY_CREATE(_gc_" + scopeId + ", 2, 0);\n");
            emitter.emitPredefinedHeader(HeaderKey.gc_iterator);
            emitter.emitPredefinedHeader(HeaderKey.array);
        }
    }

    public insertGlobalPointerIfNecessary(node: ts.Node, varPos: number, varString: string, emitter: Emitter) {
        let parentDecl = this.findParentFunctionNode(node);
        let scopeId = parentDecl && parentDecl.pos + 1 || "main";

        emitter.emit("ARRAY_PUSH(_gc_" + this.scopesOfVariables[varPos].scopeId + ", " + varString + ");\n");
        emitter.emitPredefinedHeader(HeaderKey.array);
    }

    public insertDestructorsIfNecessary(node: ts.Node, emitter: Emitter) {
        let parentDecl = this.findParentFunctionNode(node);
        let scopeId = parentDecl && parentDecl.pos + 1 || "main";
        if (this.scopes[scopeId] && this.scopes[scopeId].length) {
            emitter.emit("for (_gc_i = 0; _gc_i < _gc_" + scopeId + ".size; _gc_i++)\n");
            emitter.emit("    free(_gc_" + scopeId + ".data[_gc_i]);\n");
            emitter.emit("free(_gc_" + scopeId + ".data);\n");
        }

    }

    public scheduleVariableDisposal(varIdent: ts.Identifier) {

        let varId = this.getSymbolId(varIdent);
        let varFuncNode = this.findParentFunctionNode(varIdent);
        let varPos = varIdent.pos;
        var scope: number | "main" = varFuncNode && varFuncNode.pos + 1 || "main"

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

                if (ref.parent && ref.parent.kind == ts.SyntaxKind.CallExpression) {
                    let call = <ts.CallExpression>ref.parent;
                    if (call.expression.kind == ts.SyntaxKind.Identifier && call.expression.getText() == node.getText()) {
                        console.log(varIdent.getText() + " -> Found function call!");
                        if (scope !== "main") {
                            let funcNode = this.findParentFunctionNode(call);
                            scope = funcNode && funcNode.pos + 1 || "main";
                        }
                        this.addIfFoundInAssignment(varIdent, node, call, queue);
                    } else {
                        let symbol = GlobalContext.typeChecker.getSymbolAtLocation(call.expression);
                        if (!symbol) {
                            if (call.expression.getText() != "console.log") {
                                console.log(varIdent.getText() + " -> Detected passing to external function " + call.expression.getText() + ". Scope changed to main.");
                                scope = "main";
                            }
                        }
                        else {
                            let funcDecl = <ts.FunctionDeclaration>symbol.valueDeclaration;
                            for (let i = 0; i < call.arguments.length; i++) {
                                if (call.arguments[i].kind == ts.SyntaxKind.Identifier && call.arguments[i].getText() == node.getText()) {
                                    console.log(varIdent.getText() + " -> Found passing to function " + call.expression.getText() + " as parameter " + funcDecl.parameters[i].name.getText());
                                    queue.push(<ts.Identifier>funcDecl.parameters[i].name);
                                }
                            }
                        }
                    }
                }
                else if (ref.parent && ref.parent.kind == ts.SyntaxKind.ReturnStatement && !returned) {
                    returned = true;
                    queue.push(parentNode.name);
                    console.log(varIdent.getText() + " -> Found variable returned from the function!");
                }
                else
                    this.addIfFoundInAssignment(varIdent, node, ref, queue);
            }

        }

        var scopeInfo = { varPos: varPos, varId: varId, declIdent: varIdent, scopeId: scope, symbolId: varId };
        this.scopes[scope] = this.scopes[scope] || [];
        this.scopes[scope].push(scopeInfo);
        this.scopesOfVariables[varPos] = scopeInfo;

    }

    private addIfFoundInAssignment(varIdent: ts.Identifier, node: ts.Identifier, ref: ts.Node, queue: ts.Identifier[]): boolean {
        if (ref.parent && ref.parent.kind == ts.SyntaxKind.VariableDeclaration) {
            let varDecl = <ts.VariableDeclaration>ref.parent;
            if (varDecl.initializer && varDecl.initializer.getText() == node.getText()) {
                queue.push(<ts.Identifier>varDecl.name);
                console.log(varIdent.getText() + " -> Found initializer-assignment to variable " + varDecl.name.getText());
                return true;
            }
        }
        else if (ref.parent && ref.parent.kind == ts.SyntaxKind.BinaryExpression) {
            let binaryExpr = <ts.BinaryExpression>ref.parent;
            if (binaryExpr.operatorToken.kind == ts.SyntaxKind.FirstAssignment
                && binaryExpr.right.getText() == node.getText()) {
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
        return GlobalContext.typeChecker.getSymbolAtLocation(node)["id"];
    }

}