import * as ts from 'typescript';
import { TypeHelper, ArrayType, StructType, DictType, StringVarType } from './types';
import { StandardCallHelper } from './standard';
import { StringMatchResolver } from './standard/string/match';
import { SymbolsHelper } from './symbols';

type VariableScopeInfo = {
    node: ts.Node;
    simple: boolean,
    array: boolean;
    arrayWithContents: boolean;
    dict: boolean;
    varName: string;
    scopeId: string;
    used: boolean;
};

export class MemoryManager {
    private scopes: { [scopeId: string]: VariableScopeInfo[] } = {};
    private scopesOfVariables: { [key: string]: VariableScopeInfo } = {};
    private reusedVariables: { [key: string]: string } = {};
    private originalNodes: { [key: string]: ts.Node } = {};
    private references: { [key: string]: ts.Node[] } = {};

    constructor(private typeChecker: ts.TypeChecker, private typeHelper: TypeHelper, private symbolsHelper: SymbolsHelper) { }

    public scheduleNodeDisposals(nodes: ts.Node[]) {
        for (let node of nodes) {
            switch (node.kind) {
                case ts.SyntaxKind.Identifier:
                    {
                        const symbol = this.typeChecker.getSymbolAtLocation(node);
                        if (symbol) {
                            this.references[symbol.valueDeclaration.pos] = this.references[symbol.valueDeclaration.pos] || [];
                            this.references[symbol.valueDeclaration.pos].push(node);
                        }
                    }
                    break;
                case ts.SyntaxKind.ArrayLiteralExpression:
                    {
                        let type = this.typeHelper.getCType(node);
                        if (type && type instanceof ArrayType && type.isDynamicArray)
                            this.scheduleNodeDisposal(node, true);
                    }
                    break;
                case ts.SyntaxKind.ObjectLiteralExpression:
                    {
                        let type = this.typeHelper.getCType(node);
                        if (type && (type instanceof StructType || type instanceof DictType))
                            this.scheduleNodeDisposal(node, true);
                    }
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    {
                        let binExpr = <ts.BinaryExpression>node;
                        if (binExpr.operatorToken.kind == ts.SyntaxKind.PlusToken
                            || binExpr.operatorToken.kind == ts.SyntaxKind.FirstCompoundAssignment) {
                            let leftType = this.typeHelper.getCType(binExpr.left);
                            let rightType = this.typeHelper.getCType(binExpr.right);
                            if (leftType == StringVarType || rightType == StringVarType)
                                this.scheduleNodeDisposal(binExpr, true);
                        }
                    }
                    break;
                case ts.SyntaxKind.CallExpression:
                    {
                        if (StandardCallHelper.needsDisposal(this.typeHelper, <ts.CallExpression>node))
                            this.scheduleNodeDisposal(node, true);
                    }
                    break;
            }
        }
    }

    public getGCVariablesForScope(node: ts.Node) {
        let parentDecl = this.findParentFunctionNode(node);
        var scopeId: string = parentDecl && parentDecl.pos + 1 + "" || "main";
        let realScopeId = this.scopes[scopeId] && this.scopes[scopeId].length && this.scopes[scopeId][0].scopeId
        let gcVars = [];
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(v => !v.simple && !v.array && !v.dict && !v.arrayWithContents).length) {
            gcVars.push("gc_" + realScopeId);
        }
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(v => !v.simple && v.array).length) {
            gcVars.push("gc_" + realScopeId + "_arrays");
        }
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(v => !v.simple && v.arrayWithContents).length) {
            gcVars.push("gc_" + realScopeId + "_arrays_c");
        }
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(v => !v.simple && v.dict).length) {
            gcVars.push("gc_" + realScopeId + "_dicts");
        }
        return gcVars;
    }

    public getGCVariableForNode(node: ts.Node) {
        let key = node.pos + "_" + node.end;
        if (this.reusedVariables[key])
            key = this.reusedVariables[key];

        if (this.scopesOfVariables[key] && !this.scopesOfVariables[key].simple) {
            if (this.scopesOfVariables[key].array)
                return "gc_" + this.scopesOfVariables[key].scopeId + "_arrays";
            else if (this.scopesOfVariables[key].arrayWithContents)
                return "gc_" + this.scopesOfVariables[key].scopeId + "_arrays_c";
            else if (this.scopesOfVariables[key].dict)
                return "gc_" + this.scopesOfVariables[key].scopeId + "_dicts";
            else
                return "gc_" + this.scopesOfVariables[key].scopeId;
        }
        else
            return null;
    }

    public getDestructorsForScope(node: ts.Node) {
        let parentDecl = this.findParentFunctionNode(node);
        let scopeId = parentDecl && parentDecl.pos + 1 || "main";
        let destructors: { varName: string, array: boolean, dict: boolean, string: boolean, arrayWithContents: boolean }[] = [];
        if (this.scopes[scopeId]) {

            // string match allocates array of strings, and each of those strings should be also disposed
            for (let simpleVarScopeInfo of this.scopes[scopeId].filter(v => v.simple && v.used))
                destructors.push({
                    varName: simpleVarScopeInfo.varName,
                    array: simpleVarScopeInfo.array,
                    dict: simpleVarScopeInfo.dict,
                    string: this.typeHelper.getCType(simpleVarScopeInfo.node) == StringVarType,
                    arrayWithContents: simpleVarScopeInfo.arrayWithContents
                });
        }
        return destructors;
    }

    public variableWasReused(node: ts.Node) {
        let key = node.pos + "_" + node.end;
        return !!this.reusedVariables[key];
    }

    /** Variables that need to be disposed are tracked by memory manager */
    public getReservedTemporaryVarName(node: ts.Node) {
        let key = node.pos + "_" + node.end;
        if (this.reusedVariables[key])
            key = this.reusedVariables[key];
        let scopeOfVar = this.scopesOfVariables[key];
        if (scopeOfVar) {
            scopeOfVar.used = true;
            return scopeOfVar.varName;
        } else
            return null;
    }

    /** Sometimes we can reuse existing variable instead of creating a temporary one. */
    public tryReuseExistingVariable(node: ts.Node) {
        if (node.parent.kind == ts.SyntaxKind.BinaryExpression) {
            let assignment = <ts.BinaryExpression>node.parent;
            if (assignment.left.kind == ts.SyntaxKind.Identifier)
                return assignment.left;
        }
        if (node.parent.kind == ts.SyntaxKind.VariableDeclaration) {
            let assignment = <ts.VariableDeclaration>node.parent;
            if (assignment.name.kind == ts.SyntaxKind.Identifier)
                return assignment.name;
        }
        return null;
    }

    private scheduleNodeDisposal(heapNode: ts.Node, isTemp: boolean) {

        let nodeToDispose = this.tryReuseExistingVariable(heapNode) || heapNode;
        let isTempVar = nodeToDispose == heapNode;
        if (!isTempVar) {
            this.reusedVariables[heapNode.pos + "_" + heapNode.end] = nodeToDispose.pos + "_" + nodeToDispose.end;
            this.originalNodes[nodeToDispose.pos + "_" + nodeToDispose.end] = heapNode;
            heapNode = nodeToDispose;
            isTemp = false;
        }

        let varFuncNode = this.findParentFunctionNode(heapNode);
        var topScope: number | "main" = varFuncNode && varFuncNode.pos + 1 || "main"
        var isSimple = true;
        if (this.isInsideLoop(heapNode))
            isSimple = false;

        var scopeTree = {};
        scopeTree[topScope] = true;

        var queue = [heapNode];
        queue.push();
        var visited = {};
        while (queue.length > 0) {
            let node = queue.shift();
            if (visited[node.pos + "_" + node.end])
                continue;

            let refs = [node];
            if (node.kind == ts.SyntaxKind.Identifier) {
                const symbol = this.typeChecker.getSymbolAtLocation(node);
                if (symbol)
                    refs = this.references[symbol.valueDeclaration.pos] || refs;
            }
            let returned = false;
            for (let ref of refs) {
                visited[ref.pos + "_" + ref.end] = true;
                let parentNode = this.findParentFunctionNode(ref);
                if (!parentNode)
                    topScope = "main";

                if (ref.kind == ts.SyntaxKind.PropertyAccessExpression) {
                    let elemAccess = <ts.PropertyAccessExpression>ref;
                    while (elemAccess.expression.kind == ts.SyntaxKind.PropertyAccessExpression)
                        elemAccess = <ts.PropertyAccessExpression>elemAccess.expression;
                    if (elemAccess.expression.kind == ts.SyntaxKind.Identifier) {
                        console.log(heapNode.getText() + " -> Tracking parent variable: " + elemAccess.expression.getText() + ".");
                        queue.push(elemAccess.expression);
                    }
                }

                if (ref.parent && ref.parent.kind == ts.SyntaxKind.BinaryExpression) {
                    let binaryExpr = <ts.BinaryExpression>ref.parent;
                    if (binaryExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken && binaryExpr.left.getText() == heapNode.getText()) {
                        console.log(heapNode.getText() + " -> Detected assignment: " + binaryExpr.getText() + ".");
                        isSimple = false;
                    }
                }

                if (ref.parent && ref.parent.kind == ts.SyntaxKind.PropertyAssignment) {
                    console.log(heapNode.getText() + " -> Detected passing to object literal: " + ref.parent.getText() + ".");
                    queue.push(ref.parent.parent);
                }
                if (ref.parent && ref.parent.kind == ts.SyntaxKind.ArrayLiteralExpression) {
                    console.log(heapNode.getText() + " -> Detected passing to array literal: " + ref.parent.getText() + ".");
                    queue.push(ref.parent);
                }

                if (ref.parent && ref.parent.kind == ts.SyntaxKind.CallExpression) {
                    let call = <ts.CallExpression>ref.parent;
                    if (call.expression.kind == ts.SyntaxKind.Identifier && call.expression.pos == ref.pos) {
                        console.log(heapNode.getText() + " -> Found function call!");
                        if (topScope !== "main") {
                            let funcNode = this.findParentFunctionNode(call);
                            topScope = funcNode && funcNode.pos + 1 || "main";
                            let targetScope = node.parent.pos + 1 + "";
                            isSimple = false;
                            if (scopeTree[targetScope])
                                delete scopeTree[targetScope];
                            scopeTree[topScope] = targetScope;
                        }
                        this.addIfFoundInAssignment(heapNode, call, queue);
                    } else {
                        let symbol = this.typeChecker.getSymbolAtLocation(call.expression);
                        if (!symbol) {
                            let isStandardCall = StandardCallHelper.isStandardCall(this.typeHelper, call);

                            if (isStandardCall) {
                                let standardCallEscapeNode = StandardCallHelper.getEscapeNode(this.typeHelper, call);
                                if (standardCallEscapeNode) {
                                    console.log(heapNode.getText() + " escapes to '" + standardCallEscapeNode.getText() + "' via standard call '" + call.getText() + "'.");
                                    queue.push(standardCallEscapeNode);
                                }
                            } else {
                                console.log(heapNode.getText() + " -> Detected passing to external function " + call.expression.getText() + ". Scope changed to main.");
                                topScope = "main";
                                isSimple = false;
                            }
                        }
                        else {
                            let funcDecl = <ts.FunctionDeclaration>symbol.valueDeclaration;
                            for (let i = 0; i < call.arguments.length; i++) {
                                if (call.arguments[i].pos <= ref.pos && call.arguments[i].end >= ref.end) {
                                    if (funcDecl.pos + 1 == topScope) {
                                        console.log(heapNode.getText() + " -> Found recursive call with parameter " + funcDecl.parameters[i].name.getText());
                                        queue.push(funcDecl.name);
                                    } else {
                                        console.log(heapNode.getText() + " -> Found passing to function " + call.expression.getText() + " as parameter " + funcDecl.parameters[i].name.getText());
                                        queue.push(<ts.Identifier>funcDecl.parameters[i].name);
                                    }
                                    isSimple = false;
                                }
                            }
                        }
                    }
                }
                else if (ref.parent && ref.parent.kind == ts.SyntaxKind.ReturnStatement && !returned) {
                    returned = true;
                    queue.push(parentNode.name);
                    console.log(heapNode.getText() + " -> Found variable returned from the function!");
                    isSimple = false;
                }
                else
                    this.addIfFoundInAssignment(heapNode, ref, queue)
            }

        }

        let type = this.typeHelper.getCType(heapNode);
        let varName: string;
        if (ts.isArrayLiteralExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_array");
        else if (ts.isObjectLiteralExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_obj");
        else if (ts.isBinaryExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_string");
        else if (ts.isCallExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, StandardCallHelper.getTempVarName(this.typeHelper, heapNode));
        else
            varName = heapNode.getText().replace(/\./g, "->");

        let vnode = heapNode;
        let key = vnode.pos + "_" + vnode.end;
        let arrayWithContents = false;
        if (this.originalNodes[key])
            vnode = this.originalNodes[key];
        if (vnode.kind == ts.SyntaxKind.CallExpression && new StringMatchResolver().matchesNode(this.typeHelper, <ts.CallExpression>vnode))
            arrayWithContents = true;

        let foundScopes = topScope == "main" ? [topScope] : Object.keys(scopeTree);
        var scopeInfo = {
            node: heapNode,
            simple: isSimple,
            arrayWithContents: arrayWithContents,
            array: !arrayWithContents && type && type instanceof ArrayType && type.isDynamicArray,
            dict: type && type instanceof DictType,
            varName: varName,
            scopeId: foundScopes.join("_"),
            used: !isTemp
        };
        this.scopesOfVariables[heapNode.pos + "_" + heapNode.end] = scopeInfo;

        for (let sc of foundScopes) {
            this.scopes[sc] = this.scopes[sc] || [];
            this.scopes[sc].push(scopeInfo);
        }

    }

    private addIfFoundInAssignment(varIdent: ts.Node, ref: ts.Node, queue: ts.Node[]): boolean {
        if (ref.parent && ref.parent.kind == ts.SyntaxKind.VariableDeclaration) {
            let varDecl = <ts.VariableDeclaration>ref.parent;
            if (varDecl.initializer && varDecl.initializer.pos == ref.pos) {
                queue.push(varDecl.name);
                console.log(varIdent.getText() + " -> Found initializer-assignment to variable " + varDecl.name.getText());
                return true;
            }
        }
        else if (ref.parent && ref.parent.kind == ts.SyntaxKind.BinaryExpression) {
            let binaryExpr = <ts.BinaryExpression>ref.parent;
            if (binaryExpr.operatorToken.kind == ts.SyntaxKind.FirstAssignment && binaryExpr.right.pos == ref.pos) {
                queue.push(binaryExpr.left);
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

    private isInsideLoop(node: ts.Node) {
        var parent = node;
        while (parent
            && parent.kind != ts.SyntaxKind.ForInStatement
            && parent.kind != ts.SyntaxKind.ForOfStatement
            && parent.kind != ts.SyntaxKind.ForStatement
            && parent.kind != ts.SyntaxKind.WhileStatement
            && parent.kind != ts.SyntaxKind.DoStatement) {
            parent = parent.parent;
        }
        return !!parent;
    }

}