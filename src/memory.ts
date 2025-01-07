import * as kataw from '@andrei-markeev/kataw';
import { ArrayType, DictType, StringVarType, NumberVarType, UniversalVarType, FuncType, StructType } from './types/ctypes';
import { StandardCallHelper } from './standard';
import { SymbolsHelper } from './symbols';
import { isPlusOp, isFunction, toPrimitive, findParentFunction, findParentSourceFile, getAllNodesInFunction, isCompoundAssignment, isEqualsExpression, isBinaryExpression, isCall, isFieldAccess, isNumericLiteral, isVariableDeclaration, isFunctionDeclaration, isFieldElementAccess, isFieldPropertyAccess, isPropertyDefinition, isReturnStatement, isFunctionExpression, isStringLiteral, isObjectLiteral, isArrayLiteral, isUnaryExpression, getNodeText, isCallArgument, isMaybeStandardCall, MaybeStandardCall } from './types/utils';
import { TypeHelper } from './types/typehelper';

type VariableScopeInfo = {
    node: kataw.SyntaxNode;
    simple: boolean;
    array: boolean;
    arrayWithContents: boolean;
    dict: boolean;
    varName: string;
    scopeId: string;
    used: boolean;
};

type QueueItem = {
    node: kataw.SyntaxNode;
    nodeFunc: kataw.FunctionDeclaration | kataw.FunctionExpression
};

export class MemoryManager {
    private scopes: { [scopeId: string]: VariableScopeInfo[] } = {};
    private scopesOfVariables: { [key: string]: VariableScopeInfo } = {};
    private reusedVariables: { [key: number]: number } = {};
    private originalNodes: { [key: string]: kataw.SyntaxNode } = {};
    private references: { [key: string]: kataw.SyntaxNode[] } = {};
    private needsGCMain: boolean = false;

    constructor(private typeHelper: TypeHelper, private symbolsHelper: SymbolsHelper, private standardCallHelper: StandardCallHelper) { }

    public scheduleNodeDisposals(nodes: kataw.SyntaxNode[]) {
        nodes.filter(n => kataw.isIdentifier(n)).forEach(n => {
            const decl = this.typeHelper.getDeclaration(n);
            if (decl) {
                this.references[decl.start] = this.references[decl.start] || [];
                this.references[decl.start].push(n);
            }
        });
        for (let node of nodes) {
            switch (node.kind) {
                case kataw.SyntaxKind.ArrayLiteral:
                    {
                        let type = this.typeHelper.getCType(node);
                        if (type && type instanceof ArrayType && type.isDynamicArray || type instanceof DictType || type === UniversalVarType)
                            this.scheduleNodeDisposal(node, { canReuse: type !== UniversalVarType });
                    }
                    break;
                case kataw.SyntaxKind.ObjectLiteral:
                    {
                        let type = this.typeHelper.getCType(node);
                        this.scheduleNodeDisposal(node, { canReuse: type !== UniversalVarType });
                    }
                    break;
                case kataw.SyntaxKind.BinaryExpression:
                case kataw.SyntaxKind.AssignmentExpression:
                    {
                        let binExpr = <kataw.BinaryExpression>node;
                        const leftType = this.typeHelper.getCType(binExpr.left);
                        const rightType = this.typeHelper.getCType(binExpr.right);

                        if (isPlusOp(binExpr.operatorToken.kind)) {
                            if (leftType === UniversalVarType || rightType === UniversalVarType)
                                this.needsGCMain = true;
                            else {
                                let n: kataw.SyntaxNode = binExpr;
                                while (isBinaryExpression(n.parent) && isPlusOp(n.parent.operatorToken.kind))
                                    n = n.parent;
                                let isInConsoleLog = false;
                                let call = n.parent.kind === kataw.SyntaxKind.ArgumentList ? n.parent.parent : null;
                                if (call && isCall(call) && isFieldPropertyAccess(call.expression)
                                    && kataw.isIdentifier(call.expression.member) && call.expression.member.text === 'console'
                                ) {
                                    isInConsoleLog = this.symbolsHelper.isGlobalSymbol(call.expression.member) 
                                        && kataw.isIdentifier(call.expression.expression) && call.expression.expression.text === 'log';
                                }
                                if (!isInConsoleLog && (toPrimitive(leftType) == StringVarType || toPrimitive(rightType) == StringVarType))
                                    this.scheduleNodeDisposal(binExpr, { canReuse: false });
                            }
                        }

                        if (binExpr.operatorToken.kind === kataw.SyntaxKind.InKeyword
                                && !(rightType instanceof ArrayType)
                                && (leftType === UniversalVarType || leftType instanceof ArrayType || leftType === NumberVarType && !isNumericLiteral(binExpr.left)))
                            this.needsGCMain = true;
                            
                    }
                    break;
                case kataw.SyntaxKind.CallExpression:
                    {
                        if (isMaybeStandardCall(node) && this.standardCallHelper.needsDisposal(node))
                            this.scheduleNodeDisposal(node);
                        else {
                            const call = <kataw.CallExpression>node;
                            const symbol = this.symbolsHelper.getSymbolAtLocation(call.expression);
                            if (symbol && symbol.resolver && symbol.resolver.needsDisposal(this.typeHelper, call))
                                this.scheduleNodeDisposal(node);
                        }
                    }
                    break;
                case kataw.SyntaxKind.NewExpression:
                    {
                        this.scheduleNodeDisposal(node);
                    }
                    break;
                case kataw.SyntaxKind.FunctionExpression:
                case kataw.SyntaxKind.FunctionDeclaration:
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

    public getGCVariablesForScope(node: kataw.SyntaxNode) {
        let parentDecl = findParentFunction(node);
        var scopeId: string = parentDecl && parentDecl.start + 1 + "" || "main";
        let realScopeId = this.scopes[scopeId] && this.scopes[scopeId].length && this.scopes[scopeId][0].scopeId
        let gcVars = [];
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(v => !v.simple && !v.array && !v.dict && !v.arrayWithContents).length) {
            gcVars.push("gc_" + realScopeId);
        }
        if (scopeId === "main" && this.needsGCMain && gcVars[0] !== "gc_main") {
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

    public getGCVariableForNode(node: kataw.SyntaxNode) {
        let key = node.id;
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

    public getDestructorsForScope(node: kataw.SyntaxNode) {
        let parentDecl = findParentFunction(node);
        let scopeId = parentDecl && parentDecl.start + 1 || "main";
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

    public variableWasReused(node: kataw.SyntaxNode) {
        return !!this.reusedVariables[node.id];
    }

    /** Variables that need to be disposed are tracked by memory manager */
    public getReservedTemporaryVarName(node: kataw.SyntaxNode) {
        let key = node.id;
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
    public tryReuseExistingVariable(node: kataw.SyntaxNode) {
        if (isEqualsExpression(node.parent) && kataw.isIdentifier(node.parent.left))
            return node.parent.left;
        if (isVariableDeclaration(node.parent) && kataw.isIdentifier(node.parent.binding))
            return node.parent.binding;
        return null;
    }

    private scheduleNodeDisposal(heapNode: kataw.SyntaxNode, options?: { canReuse?: boolean, subtype?: string }) {

        options = { canReuse: true, subtype: null, ...options };

        let isTemp = true;
        if (options.canReuse) {
            let existingVariable = this.tryReuseExistingVariable(heapNode);
            isTemp = existingVariable == null;
            if (!isTemp) {
                this.reusedVariables[heapNode.id] = existingVariable.id;
                this.originalNodes[existingVariable.id] = heapNode;
                heapNode = existingVariable;
            }
        }

        let topScopeNode = findParentFunction(heapNode);
        let topScope: number | "main" = topScopeNode && topScopeNode.start + 1 || "main";
        let isSimple = true;
        if (this.isInsideLoop(heapNode))
            isSimple = false;

        let scopeTree = {};
        scopeTree[topScope] = true;

        const heapNodeText = getNodeText(heapNode).trim();

        let queue: QueueItem[] = [{ node: heapNode, nodeFunc: null }];
        if (options.subtype === "scope")
            queue = this.getStartNodesForTrekingFunctionScope(<kataw.FunctionDeclaration | kataw.FunctionExpression>heapNode).map(n => ({ node: n, nodeFunc: null }));
        let visited = {};
        while (queue.length > 0) {
            const { node, nodeFunc } = queue.shift();

            if (visited[node.id])
                continue;

            let refs = [node];
            if (kataw.isIdentifier(node)) {
                const decl = this.typeHelper.getDeclaration(node);
                if (decl)
                    refs = this.references[decl.start] || refs;
            } else if (isFunctionDeclaration(node)) {
                refs = this.references[node.name.start] || refs;
            }
            let returned = false;
            for (let ref of refs) {
                visited[ref.id] = true;
                let parentNode = findParentFunction(isFunction(ref) ? ref.parent : ref);
                if (!parentNode)
                    topScope = "main";

                if (isFieldAccess(ref)) {
                    let elemAccess = ref;
                    while (isFieldAccess(elemAccess.member))
                        elemAccess = elemAccess.member;
                    if (kataw.isIdentifier(elemAccess.member)) {
                        console.log(heapNodeText + " -> Tracking parent variable: " + getNodeText(elemAccess.member) + ".");
                        queue.push({ node: elemAccess.member, nodeFunc });
                    }
                }

                if (ref.parent && isFieldPropertyAccess(ref.parent) && ref.parent.expression === ref) {
                    const type = this.typeHelper.getCType(ref.parent.member);
                    if (type instanceof StructType) {
                        console.log(heapNodeText + " -> Property of object " + getNodeText(ref.parent.member) + ".");
                        queue.push({ node: ref.parent, nodeFunc });
                    }
                }

                if (ref.parent && isFieldElementAccess(ref.parent) && ref.parent.expression === ref) {
                    const type = this.typeHelper.getCType(ref.parent.member);
                    if (type instanceof DictType) {
                        console.log(heapNodeText + " -> Property of dictionary " + getNodeText(ref.parent.member) + ".");
                        queue.push({ node: ref.parent.member, nodeFunc });
                    }
                }

                if (isEqualsExpression(ref.parent) && ref.parent.left === ref 
                    && kataw.isIdentifier(heapNode) && kataw.isIdentifier(ref) && heapNode.text === ref.text
                ) {
                    console.log(heapNodeText + " -> Detected assignment: " + getNodeText(ref.parent) + ".");
                    isSimple = false;
                }

                if (isBinaryExpression(ref) && isCompoundAssignment(ref.operatorToken)) {
                    console.log(getNodeText(ref) + " -> is a compound assignment to variable " + getNodeText(ref.left));
                    queue.push({ node: ref.left, nodeFunc });
                }

                if (ref.parent && isPropertyDefinition(ref.parent) && ref === ref.parent.right) {
                    console.log(heapNodeText + " -> Detected passing to object literal: " + getNodeText(ref.parent) + ".");
                    queue.push({ node: ref.parent.left, nodeFunc });
                    queue.push({ node: ref.parent.parent.parent, nodeFunc });
                }
                if (ref.parent && ref.parent.kind == kataw.SyntaxKind.ArrayLiteral) {
                    console.log(heapNodeText + " -> Detected passing to array literal: " + getNodeText(ref.parent) + ".");
                    queue.push({ node: ref.parent, nodeFunc });
                }
                if (ref.parent && ref.parent.kind == kataw.SyntaxKind.ParenthesizedExpression) {
                    console.log(heapNodeText + " -> Found parenthesized expression.");
                    queue.push({ node: ref.parent, nodeFunc });
                }

                if (ref.parent && ref.parent.kind == kataw.SyntaxKind.CallExpression) {
                    let call = <kataw.CallExpression>ref.parent;
                    if (kataw.isIdentifier(call.expression) && call.expression === ref) {
                        console.log(heapNodeText + " -> Found function call!");
                        if (topScope !== "main") {
                            let funcNode = findParentFunction(call);
                            topScope = funcNode && funcNode.start + 1 || "main";
                            let targetScope = nodeFunc && nodeFunc.start + 1 + "" || "none";
                            isSimple = false;
                            if (scopeTree[targetScope])
                                delete scopeTree[targetScope];
                            scopeTree[topScope] = targetScope;
                        }

                        if (isReturnStatement(call.parent) && !returned) {
                            let funcNode: kataw.SyntaxNode = parentNode;
                            if (isFunctionDeclaration(parentNode))
                                funcNode = parentNode.name;
                            queue.push({ node: funcNode, nodeFunc: parentNode });
                            console.log(heapNodeText + " -> Found variable returned from the function!");
                            returned = true;
                            isSimple = false;
                        }
                        else
                            this.addIfFoundInAssignment(heapNode, call, queue, nodeFunc);
                    } else if (call.expression === ref) {
                        console.log(heapNodeText + " -> Found function expression call!");
                        isSimple = false;
                        queue.push({ node: call, nodeFunc });
                    }
                }
                
                if (isCallArgument(ref)) {
                    const call = <kataw.CallExpression>ref.parent.parent;
                    const decl = kataw.isIdentifier(call.expression) && this.typeHelper.getDeclaration(call.expression);
                    if (!decl) {
                        let isStandardCall = isMaybeStandardCall(call) && this.standardCallHelper.isStandardCall(call);
                        let standardCallEscapeNode;

                        if (!isStandardCall) {
                            const symbol = this.symbolsHelper.getSymbolAtLocation(call.expression);
                            isStandardCall = symbol && symbol.resolver ? true : false;
                            if (isStandardCall)
                                standardCallEscapeNode = symbol.resolver.getEscapeNode(this.typeHelper, call);
                        } else
                            standardCallEscapeNode = this.standardCallHelper.getEscapeNode(<MaybeStandardCall>call)

                        if (isStandardCall) {
                            if (standardCallEscapeNode) {
                                console.log(heapNodeText + " escapes to '" + getNodeText(standardCallEscapeNode) + "' via standard call '" + getNodeText(call) + "'.");
                                queue.push({ node: standardCallEscapeNode, nodeFunc });
                            }
                        } else {
                            console.log(heapNodeText + " -> Detected passing to external function " + getNodeText(call.expression) + "." + (topScope != "main" ? "Scope changed to main." : ""));
                            topScope = "main";
                        }
                    }
                    else {
                        const funcDecl = decl.parent as kataw.FunctionDeclaration;
                        for (let i = 0; i < call.argumentList.elements.length; i++) {
                            if (call.argumentList.elements[i].start <= ref.start && call.argumentList.elements[i].end >= ref.end) {
                                if (funcDecl.start + 1 === topScope) {
                                    console.log(heapNodeText + " -> Found recursive call with parameter " + getNodeText(funcDecl.formalParameterList.formalParameters[i]));
                                    queue.push({ node: decl, nodeFunc });
                                } else {
                                    console.log(heapNodeText + " -> Found passing to function " + getNodeText(call.expression).trim() + " as parameter " + getNodeText(funcDecl.formalParameterList.formalParameters[i]));
                                    queue.push({ node: funcDecl.formalParameterList.formalParameters[i], nodeFunc });
                                }
                                isSimple = false;
                            }
                        }
                    }
                }

                if (isReturnStatement(ref.parent) && !returned) {
                    let funcNode: kataw.SyntaxNode = parentNode;
                    if (isFunctionDeclaration(parentNode))
                        funcNode = parentNode.name;
                    queue.push({ node: funcNode, nodeFunc: parentNode });
                    console.log(heapNodeText + " -> Found variable returned from the function!");
                    returned = true;
                    isSimple = false;
                }

                this.addIfFoundInAssignment(heapNode, ref, queue, nodeFunc);
            }

        }

        let type = this.typeHelper.getCType(heapNode);
        let varName: string;
        if (!isTemp && kataw.isIdentifier(heapNode))
            varName = heapNode.text;
        else if (isStringLiteral(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_string");
        else if (isNumericLiteral(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_number");
        else if (isArrayLiteral(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_array");
        else if (isObjectLiteral(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_obj");
        else if (isBinaryExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_result");
        else if (isUnaryExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_number");
        else if (isMaybeStandardCall(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, this.standardCallHelper.getTempVarName(heapNode));
        else if (kataw.isIdentifier(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, heapNode.text);
        else if (isFunction(heapNode)) {
            const suffix = options.subtype || "tmp";
            const maybePropertyName = isPropertyDefinition(heapNode.parent) && kataw.isIdentifier(heapNode.parent.left) ? heapNode.parent.left.text + "_" + suffix : suffix;
            const name = heapNode.name ? heapNode.name.text + "_" + suffix : maybePropertyName;
            varName = this.symbolsHelper.addTemp(findParentSourceFile(heapNode), name);
        } else
            varName = this.symbolsHelper.addTemp(heapNode, "tmp");

        let vnode = heapNode;
        let key = vnode.id;
        let arrayWithContents = false;
        if (this.originalNodes[key])
            vnode = this.originalNodes[key];
        if (isMaybeStandardCall(vnode) && vnode.expression.expression.text === 'match' && this.typeHelper.getCType(vnode.expression.member) === StringVarType)
            arrayWithContents = true;

        let foundScopes = topScope == "main" ? [topScope] : Object.keys(scopeTree);
        var scopeInfo = {
            node: heapNode,
            simple: isSimple,
            arrayWithContents: arrayWithContents,
            array: !arrayWithContents && type && type instanceof ArrayType && type.isDynamicArray || type === UniversalVarType && isArrayLiteral(heapNode),
            dict: type && type instanceof DictType || type === UniversalVarType && isObjectLiteral(heapNode),
            varName: varName,
            scopeId: foundScopes.join("_"),
            used: !isTemp
        };
        this.scopesOfVariables[heapNode.id] = scopeInfo;

        for (let sc of foundScopes) {
            this.scopes[sc] = this.scopes[sc] || [];
            this.scopes[sc].push(scopeInfo);
        }

    }

    private getStartNodesForTrekingFunctionScope(func: kataw.FunctionDeclaration | kataw.FunctionExpression) {
        // TODO: optimize
        // don't need to get all nodes before filtering them out
        const allNodesInFunc = getAllNodesInFunction(func);
        const startNodes = [];
        for (const node of allNodesInFunc) {
            const type = this.typeHelper.getCType(node);
            if (type instanceof FuncType && type.needsClosureStruct)
                startNodes.push(node);
        }

        return startNodes;
    }

    private addIfFoundInAssignment(varIdent: kataw.SyntaxNode, ref: kataw.SyntaxNode, queue: QueueItem[], nodeFunc: kataw.FunctionDeclaration | kataw.FunctionExpression): boolean {
        if (ref.parent && isVariableDeclaration(ref.parent)) {
            if (ref.parent.initializer && ref.parent.initializer === ref) {
                queue.push({ node: ref.parent.binding, nodeFunc });
                console.log(getNodeText(varIdent) + " -> Found initializer-assignment to variable " + getNodeText(ref.parent.binding).trim());
                return true;
            }
        }
        else if (isEqualsExpression(ref.parent) && ref.parent.right === ref) {
            queue.push({ node: ref.parent.left, nodeFunc });
            console.log(getNodeText(varIdent) + " -> Found assignment to variable " + getNodeText(ref.parent.left).trim());
            return true;
        }

        return false;
    }

    private isInsideLoop(node: kataw.SyntaxNode) {
        var parent = node;
        while (parent
            && parent.kind != kataw.SyntaxKind.ForInStatement
            && parent.kind != kataw.SyntaxKind.ForOfStatement
            && parent.kind != kataw.SyntaxKind.ForStatement
            && parent.kind != kataw.SyntaxKind.WhileStatement
            && parent.kind != kataw.SyntaxKind.DoWhileStatement) {
            parent = parent.parent;
        }
        return !!parent;
    }

}