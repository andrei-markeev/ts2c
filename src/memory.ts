import * as ts from 'typescript';
import {GlobalContext} from './global';
import {Emitter, HeaderKey} from './emit';
import {TypeHelper, ArrayType, StructType} from './types';

type VariableScopeInfo = { declIdent: ts.Identifier; scope: "main" | number };

export class MemoryManager {
    private variableScopes: { [varSymbId: number]: VariableScopeInfo } = {};

    constructor(private typeHelper: TypeHelper) { }

    public preprocess() {

        for (let k in this.typeHelper.variables) {
            let v = this.typeHelper.variables[k];
            if (v.type instanceof ArrayType && v.newElementsAdded
                || v.type instanceof StructType && v.propsAssigned)
                this.scheduleVariableDisposal(<ts.Identifier>this.typeHelper.variables[k].declaration.name);
        }
    }

    public insertGCVariablesCreationIfNecessary(emitter: Emitter) {
        let found = false;
        for (var varId in this.variableScopes) {
            let parentDecl = this.findParentFunctionNode(this.variableScopes[+varId].declIdent);
            let parentDeclId = parentDecl && parentDecl.pos || "main";

            if (parentDeclId == this.variableScopes[varId].scope)
                continue;
            emitter.emit("ARRAY_CREATE(_gc_" + varId + ", 2, 0);\n");
            found = true;
        }
        if (found) {
            emitter.emitToBeginningOfFunction("int _gc_i;\n");
            emitter.emitPredefinedHeader(HeaderKey.array);
        }
    }

    public insertGlobalPointerIfNecessary(varIdent: ts.Identifier, emitter: Emitter) {
        let varId = this.getSymbolId(varIdent);

        // determine if destructor is in same scope
        let parentDecl = this.findParentFunctionNode(varIdent);
        let parentDeclId = parentDecl && parentDecl.pos || "main";

        if (parentDeclId == this.variableScopes[varId].scope)
            return;

        // if not, generate memory accessor
        let varInfo = this.typeHelper.getVariableInfo(varIdent);
        let identString = "_gc_" + this.getSymbolId(varIdent);
        emitter.emitToHeader("ARRAY(void *) " + identString + ";\n");
        emitter.emit("ARRAY_PUSH(" + identString + ", " + varIdent.getText());
        if (varInfo && varInfo instanceof ArrayType && varInfo.newElementsAdded)
            emitter.emit(".data");
        emitter.emit(");\n");
        emitter.emitPredefinedHeader(HeaderKey.array);
    }

    public insertDestructorsIfNecessary(node: ts.Node, emitter: Emitter) {
        let parentDecl = this.findParentFunctionNode(node);
        let parentDeclId = parentDecl && parentDecl.pos || "main";
        for (let varId in this.variableScopes) {
            if (this.variableScopes[varId].scope == parentDeclId) {
                let symbolsInScope = GlobalContext.typeChecker.getSymbolsInScope(node, ts.SymbolFlags.Variable);
                let foundVars = symbolsInScope.filter(s => s["id"] == varId);
                if (foundVars.length > 0) {
                    emitter.emit("free(")
                    emitter.emit(foundVars[0].getName());

                    let varInfo = this.typeHelper.variables[foundVars[0].valueDeclaration.name.pos];
                    if (varInfo && varInfo.type instanceof ArrayType && varInfo.newElementsAdded)
                        emitter.emit(".data");
                    emitter.emit(");\n")
                }
                else {
                    emitter.emit("for (_gc_i = 0; _gc_i < _gc_" + varId + ".size; _gc_i++)\n");
                    emitter.emit("    free(_gc_" + varId + ".data[_gc_i]);\n");
                    emitter.emit("free(_gc_" + varId + ".data);\n");
                }
            }
        }

    }

    public scheduleVariableDisposal(varIdent: ts.Identifier): boolean {

        let varId = this.getSymbolId(varIdent);
        let varFuncNode = this.findParentFunctionNode(varIdent);
        this.variableScopes[varId] = {
            declIdent: varIdent,
            scope: varFuncNode && varFuncNode.pos || "main"
        };

        // TODO:
        // - connect disposal to values and scopes, not variables 
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
                    this.variableScopes[varId].scope = "main";

                if (ref.parent && ref.parent.kind == ts.SyntaxKind.CallExpression) {
                    let call = <ts.CallExpression>ref.parent;
                    if (call.expression.kind == ts.SyntaxKind.Identifier && call.expression.getText() == node.getText()) {
                        console.log(varIdent.getText() + " -> Found function call!");
                        if (this.variableScopes[varId].scope !== "main") {
                            let funcNode = this.findParentFunctionNode(call);
                            this.variableScopes[varId].scope = funcNode && funcNode.pos || "main";
                        }
                        this.addIfFoundInAssignment(varIdent, node, call, queue);
                    } else {
                        let symbol = GlobalContext.typeChecker.getSymbolAtLocation(call.expression);
                        if (!symbol) {
                            if (call.expression.getText() != "console.log") {
                                console.log(varIdent.getText() + " -> Detected passing to external function. Scope changed to main.");
                                this.variableScopes[varId].scope = "main";
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

        return false;

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