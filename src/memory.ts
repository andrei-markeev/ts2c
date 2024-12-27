import * as ts from 'typescript';
import { ArrayType, DictType, StringVarType, NumberVarType, UniversalVarType, FuncType, StructType } from './types/ctypes';
import { StandardCallHelper } from './standard';
import { StringMatchResolver } from './standard/string/match';
import { SymbolsHelper } from './symbols';
import { isPlusOp, isFunction, toPrimitive, findParentFunction, findParentSourceFile, getAllNodesInFunction, isCompoundAssignment, isEqualsExpression } from './types/utils';
import { TypeHelper } from './types/typehelper';

type VariableScopeInfo = {
    node: ts.Node;
    simple: boolean;
    array: boolean;
    arrayWithContents: boolean;
    dict: boolean;
    varName: string;
    scopeId: string;
    used: boolean;
};

type QueueItem = {
    node: ts.Node;
    nodeFunc: ts.FunctionDeclaration | ts.FunctionExpression
};

export class MemoryManager {
    private scopes: { [scopeId: string]: VariableScopeInfo[] } = {};
    private scopesOfVariables: { [key: string]: VariableScopeInfo } = {};
    private reusedVariables: { [key: string]: string } = {};
    private originalNodes: { [key: string]: ts.Node } = {};
    private references: { [key: string]: ts.Node[] } = {};
    private needsGCMain: boolean = false;

    constructor(private typeHelper: TypeHelper, private symbolsHelper: SymbolsHelper) { }

    public scheduleNodeDisposals(nodes: ts.Node[]) {
        nodes.filter(n => ts.isIdentifier(n)).forEach(n => {
            const decl = this.typeHelper.getDeclaration(n);
            if (decl) {
                this.references[decl.pos] = this.references[decl.pos] || [];
                this.references[decl.pos].push(n);
            }
        });
        for (let node of nodes) {
            switch (node.kind) {
                case ts.SyntaxKind.ArrayLiteralExpression:
                    {
                        let type = this.typeHelper.getCType(node);
                        if (type && type instanceof ArrayType && type.isDynamicArray || type === UniversalVarType)
                            this.scheduleNodeDisposal(node, { canReuse: type !== UniversalVarType });
                    }
                    break;
                case ts.SyntaxKind.ObjectLiteralExpression:
                    {
                        let type = this.typeHelper.getCType(node);
                        this.scheduleNodeDisposal(node, { canReuse: type !== UniversalVarType });
                    }
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    {
                        let binExpr = <ts.BinaryExpression>node;
                        const leftType = this.typeHelper.getCType(binExpr.left);
                        const rightType = this.typeHelper.getCType(binExpr.right);

                        if (isPlusOp(binExpr.operatorToken.kind)) {
                            if (leftType == UniversalVarType || rightType == UniversalVarType)
                                this.needsGCMain = true;
                            else {
                                let n: ts.Node = binExpr;
                                while (ts.isBinaryExpression(n.parent) && isPlusOp(n.parent.operatorToken.kind))
                                    n = n.parent;
                                const isInConsoleLog = ts.isCallExpression(n.parent) && n.parent.expression.getText() == "console.log";
                                if (!isInConsoleLog && (toPrimitive(leftType) == StringVarType || toPrimitive(rightType) == StringVarType))
                                    this.scheduleNodeDisposal(binExpr, { canReuse: false });
                            }
                        }

                        if (binExpr.operatorToken.kind === ts.SyntaxKind.InKeyword
                                && !(rightType instanceof ArrayType)
                                && (leftType === UniversalVarType || leftType instanceof ArrayType || leftType === NumberVarType && !ts.isNumericLiteral(binExpr.left)))
                            this.needsGCMain = true;
                            
                    }
                    break;
                case ts.SyntaxKind.CallExpression:
                    {
                        if (StandardCallHelper.needsDisposal(this.typeHelper, <ts.CallExpression>node))
                            this.scheduleNodeDisposal(node);
                    }
                    break;
                case ts.SyntaxKind.NewExpression:
                    {
                        this.scheduleNodeDisposal(node);
                    }
                    break;
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.FunctionDeclaration:
                    {
                        const type = this.typeHelper.getCType(node);
                        const parentFunc = findParentFunction(node.parent);
                        if (parentFunc && type instanceof FuncType && type.needsClosureStruct)
                            this.scheduleNodeDisposal(node, { subtype: "closure" });
                        else if (type instanceof FuncType && type.scopeType)
                            this.scheduleNodeDisposal(node, { subtype: "scope", canReuse: false });
                    }
                    break;
            }
        }
    }

    public getGCVariablesForScope(node: ts.Node) {
        let parentDecl = findParentFunction(node);
        var scopeId: string = parentDecl && parentDecl.pos + 1 + "" || "main";
        let realScopeId = this.scopes[scopeId] && this.scopes[scopeId].length && this.scopes[scopeId][0].scopeId
        let gcVars = [];
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(v => !v.simple && !v.array && !v.dict && !v.arrayWithContents).length) {
            gcVars.push("gc_" + realScopeId);
        }
        if (scopeId == "main" && this.needsGCMain && gcVars[0] != "gc_main") {
            gcVars.push("gc_main");
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
        let parentDecl = findParentFunction(node);
        let scopeId = parentDecl && parentDecl.pos + 1 || "main";
        let destructors: { varName: string, array: boolean, dict: boolean, string: boolean, arrayWithContents: boolean }[] = [];
        if (this.scopes[scopeId]) {

            // string match allocates array of strings, and each of those strings should be also disposed
            for (let simpleVarScopeInfo of this.scopes[scopeId].filter(v => v.simple && v.used)) {
                const type = this.typeHelper.getCType(simpleVarScopeInfo.node);
                destructors.push({
                    varName: simpleVarScopeInfo.varName,
                    array: simpleVarScopeInfo.array,
                    dict: simpleVarScopeInfo.dict,
                    string: type == StringVarType,
                    arrayWithContents: simpleVarScopeInfo.arrayWithContents
                });
            }
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
        if (ts.isBinaryExpression(node.parent) && ts.isIdentifier(node.parent.left) && node.parent.operatorToken.kind == ts.SyntaxKind.EqualsToken)
            return node.parent.left;
        if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name))
            return node.parent.name;
        return null;
    }

    private scheduleNodeDisposal(heapNode: ts.Node, options?: { canReuse?: boolean, subtype?: string }) {

        options = { canReuse: true, subtype: null, ...options };

        let isTemp = true;
        if (options.canReuse) {
            let existingVariable = this.tryReuseExistingVariable(heapNode);
            isTemp = existingVariable == null;
            if (!isTemp) {
                this.reusedVariables[heapNode.pos + "_" + heapNode.end] = existingVariable.pos + "_" + existingVariable.end;
                this.originalNodes[existingVariable.pos + "_" + existingVariable.end] = heapNode;
                heapNode = existingVariable;
            }
        }

        let topScopeNode = findParentFunction(heapNode);
        let topScope: number | "main" = topScopeNode && topScopeNode.pos + 1 || "main";
        let isSimple = true;
        if (this.isInsideLoop(heapNode))
            isSimple = false;

        let scopeTree = {};
        scopeTree[topScope] = true;

        let queue: QueueItem[] = [{ node: heapNode, nodeFunc: null }];
        if (options.subtype === "scope")
            queue = this.getStartNodesForTrekingFunctionScope(<ts.FunctionDeclaration | ts.FunctionExpression>heapNode).map(n => ({ node: n, nodeFunc: null }));
        let visited = {};
        while (queue.length > 0) {
            const { node, nodeFunc } = queue.shift();
                
            if (visited[node.pos + "_" + node.end])
                continue;

            let refs = [node];
            if (node.kind == ts.SyntaxKind.Identifier) {
                const decl = this.typeHelper.getDeclaration(node);
                if (decl)
                    refs = this.references[decl.pos] || refs;
            } else if (ts.isFunctionDeclaration(node)) {
                refs = this.references[node.pos] || refs;
            }
            let returned = false;
            for (let ref of refs) {
                visited[ref.pos + "_" + ref.end] = true;
                let parentNode = findParentFunction(isFunction(ref) ? ref.parent : ref);
                if (!parentNode)
                    topScope = "main";

                if (ts.isElementAccessExpression(ref) || ts.isPropertyAccessExpression(ref)) {
                    let elemAccess = ref;
                    while (ts.isElementAccessExpression(elemAccess.expression) || ts.isPropertyAccessExpression(elemAccess.expression))
                        elemAccess = elemAccess.expression;
                    if (ts.isIdentifier(elemAccess.expression)) {
                        console.log(heapNode.getText() + " -> Tracking parent variable: " + elemAccess.expression.getText() + ".");
                        queue.push({ node: elemAccess.expression, nodeFunc });
                    }
                }

                if (ref.parent && ts.isPropertyAccessExpression(ref.parent) && ref.parent.name === ref) {
                    const type = this.typeHelper.getCType(ref.parent.expression);
                    if (type instanceof StructType) {
                        console.log(heapNode.getText() + " -> Property of object " + ref.parent.expression.getText() + ".");
                        queue.push({ node: ref.parent, nodeFunc });
                    }
                }

                if (ref.parent && ts.isElementAccessExpression(ref.parent) && ref.parent.argumentExpression === ref) {
                    const type = this.typeHelper.getCType(ref.parent.expression);
                    if (type instanceof DictType) {
                        console.log(heapNode.getText() + " -> Property of dictionary " + ref.parent.expression.getText() + ".");
                        queue.push({ node: ref.parent.expression, nodeFunc });
                    }
                }

                if (isEqualsExpression(ref.parent) && ref.parent.left.getText() == heapNode.getText()) {
                    console.log(heapNode.getText() + " -> Detected assignment: " + ref.parent.getText() + ".");
                    isSimple = false;
                }

                if (ts.isBinaryExpression(ref) && isCompoundAssignment(ref.operatorToken)) {
                    console.log(ref.getText() + " -> is a compound assignment to variable " + ref.left.getText());
                    queue.push({ node: ref.left, nodeFunc });
                }

                if (ref.parent && ts.isPropertyAssignment(ref.parent) && ref === ref.parent.initializer) {
                    console.log(heapNode.getText() + " -> Detected passing to object literal: " + ref.parent.getText() + ".");
                    queue.push({ node: ref.parent.name, nodeFunc });
                    queue.push({ node: ref.parent.parent, nodeFunc });
                }
                if (ref.parent && ref.parent.kind == ts.SyntaxKind.ArrayLiteralExpression) {
                    console.log(heapNode.getText() + " -> Detected passing to array literal: " + ref.parent.getText() + ".");
                    queue.push({ node: ref.parent, nodeFunc });
                }
                if (ref.parent && ref.parent.kind == ts.SyntaxKind.ParenthesizedExpression) {
                    console.log(heapNode.getText() + " -> Found parenthesized expression.");
                    queue.push({ node: ref.parent, nodeFunc });
                }

                if (ref.parent && ref.parent.kind == ts.SyntaxKind.CallExpression) {
                    let call = <ts.CallExpression>ref.parent;
                    if (ts.isIdentifier(call.expression) && call.expression === ref) {
                        console.log(heapNode.getText() + " -> Found function call!");
                        if (topScope !== "main") {
                            let funcNode = findParentFunction(call);
                            topScope = funcNode && funcNode.pos + 1 || "main";
                            let targetScope = nodeFunc && nodeFunc.pos + 1 + "" || "none";
                            isSimple = false;
                            if (scopeTree[targetScope])
                                delete scopeTree[targetScope];
                            scopeTree[topScope] = targetScope;
                        }

                        if (ts.isReturnStatement(call.parent) && !returned) {
                            queue.push({ node: ts.isFunctionExpression(parentNode) ? parentNode : parentNode.name, nodeFunc: parentNode });
                            console.log(heapNode.getText() + " -> Found variable returned from the function!");
                            returned = true;
                            isSimple = false;
                        }
                        else
                            this.addIfFoundInAssignment(heapNode, call, queue, nodeFunc);
                    } else if (call.expression === ref) {
                        console.log(heapNode.getText() + " -> Found function expression call!");
                        isSimple = false;
                        queue.push({ node: call, nodeFunc });
                    } else {
                        const decl = this.typeHelper.getDeclaration(call.expression);
                        if (!decl) {
                            let isStandardCall = StandardCallHelper.isStandardCall(this.typeHelper, call);

                            if (isStandardCall) {
                                let standardCallEscapeNode = StandardCallHelper.getEscapeNode(this.typeHelper, call);
                                if (standardCallEscapeNode) {
                                    console.log(heapNode.getText() + " escapes to '" + standardCallEscapeNode.getText() + "' via standard call '" + call.getText() + "'.");
                                    queue.push({ node: standardCallEscapeNode, nodeFunc });
                                }
                            } else {
                                console.log(heapNode.getText() + " -> Detected passing to external function " + call.expression.getText() + "." + (topScope != "main" ? "Scope changed to main." : ""));
                                topScope = "main";
                            }
                        }
                        else {
                            let funcDecl = <ts.FunctionDeclaration>decl;
                            for (let i = 0; i < call.arguments.length; i++) {
                                if (call.arguments[i].pos <= ref.pos && call.arguments[i].end >= ref.end) {
                                    if (funcDecl.pos + 1 == topScope) {
                                        console.log(heapNode.getText() + " -> Found recursive call with parameter " + funcDecl.parameters[i].name.getText());
                                        queue.push({ node: funcDecl.name, nodeFunc });
                                    } else {
                                        console.log(heapNode.getText() + " -> Found passing to function " + call.expression.getText() + " as parameter " + funcDecl.parameters[i].name.getText());
                                        queue.push({ node: <ts.Identifier>funcDecl.parameters[i].name, nodeFunc });
                                    }
                                    isSimple = false;
                                }
                            }
                        }
                    }
                }
                else if (ts.isReturnStatement(ref.parent) && !returned) {
                    queue.push({ node: ts.isFunctionExpression(parentNode) ? parentNode : parentNode.name, nodeFunc: parentNode });
                    console.log(heapNode.getText() + " -> Found variable returned from the function!");
                    returned = true;
                    isSimple = false;
                }
                else
                    this.addIfFoundInAssignment(heapNode, ref, queue, nodeFunc);
            }

        }

        let type = this.typeHelper.getCType(heapNode);
        let varName: string;
        if (!isTemp)
            varName = heapNode.getText().replace(/\./g,'->');
        else if (ts.isStringLiteral(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_string");
        else if (ts.isNumericLiteral(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_number");
        else if (ts.isArrayLiteralExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_array");
        else if (ts.isObjectLiteralExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_obj");
        else if (ts.isBinaryExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_result");
        else if (ts.isPrefixUnaryExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_number");
        else if (ts.isCallExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, StandardCallHelper.getTempVarName(this.typeHelper, heapNode));
        else if (ts.isIdentifier(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, heapNode.text);
        else if (isFunction(heapNode)) {
            const suffix = options.subtype || "tmp";
            const maybePropertyName = ts.isPropertyAssignment(heapNode.parent) && ts.isIdentifier(heapNode.parent.name) ? heapNode.parent.name.text + "_" + suffix : suffix;
            const name = heapNode.name ? heapNode.name.text + "_" + suffix : maybePropertyName;
            varName = this.symbolsHelper.addTemp(findParentSourceFile(heapNode), name);
        } else
            varName = this.symbolsHelper.addTemp(heapNode, "tmp");

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
            array: !arrayWithContents && type && type instanceof ArrayType && type.isDynamicArray || type === UniversalVarType && ts.isArrayLiteralExpression(heapNode),
            dict: type && type instanceof DictType || type === UniversalVarType && ts.isObjectLiteralExpression(heapNode),
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

    private getStartNodesForTrekingFunctionScope(func: ts.FunctionDeclaration | ts.FunctionExpression) {
        const allNodesInFunc = getAllNodesInFunction(func);
        const startNodes = [];
        for (const node of allNodesInFunc) {
            const type = this.typeHelper.getCType(node);
            if (type instanceof FuncType && type.needsClosureStruct)
                startNodes.push(node);
        }

        return startNodes;
    }

    private addIfFoundInAssignment(varIdent: ts.Node, ref: ts.Node, queue: QueueItem[], nodeFunc: ts.FunctionDeclaration | ts.FunctionExpression): boolean {
        if (ref.parent && ref.parent.kind == ts.SyntaxKind.VariableDeclaration) {
            let varDecl = <ts.VariableDeclaration>ref.parent;
            if (varDecl.initializer && varDecl.initializer === ref) {
                queue.push({ node: varDecl.name, nodeFunc });
                console.log(varIdent.getText() + " -> Found initializer-assignment to variable " + varDecl.name.getText());
                return true;
            }
        }
        else if (ref.parent && ref.parent.kind == ts.SyntaxKind.BinaryExpression) {
            let binaryExpr = <ts.BinaryExpression>ref.parent;
            if (isEqualsExpression(binaryExpr) && binaryExpr.right === ref) {
                queue.push({ node: binaryExpr.left, nodeFunc });
                console.log(varIdent.getText() + " -> Found assignment to variable " + binaryExpr.left.getText());
                return true;
            }
        }

        return false;
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