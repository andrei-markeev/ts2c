(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ts2c = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var ctypes_1 = require("./types/ctypes");
var standard_1 = require("./standard");
var match_1 = require("./standard/string/match");
var utils_1 = require("./types/utils");
var MemoryManager = /** @class */ (function () {
    function MemoryManager(typeHelper, symbolsHelper) {
        this.typeHelper = typeHelper;
        this.symbolsHelper = symbolsHelper;
        this.scopes = {};
        this.scopesOfVariables = {};
        this.reusedVariables = {};
        this.originalNodes = {};
        this.references = {};
        this.needsGCMain = false;
    }
    MemoryManager.prototype.scheduleNodeDisposals = function (nodes) {
        var _this = this;
        nodes.filter(function (n) { return ts.isIdentifier(n); }).forEach(function (n) {
            var decl = _this.typeHelper.getDeclaration(n);
            if (decl) {
                _this.references[decl.pos] = _this.references[decl.pos] || [];
                _this.references[decl.pos].push(n);
            }
        });
        for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
            var node = nodes_1[_i];
            switch (node.kind) {
                case ts.SyntaxKind.ArrayLiteralExpression:
                    {
                        var type = this.typeHelper.getCType(node);
                        if (type && type instanceof ctypes_1.ArrayType && type.isDynamicArray || type === ctypes_1.UniversalVarType)
                            this.scheduleNodeDisposal(node, { canReuse: type !== ctypes_1.UniversalVarType });
                    }
                    break;
                case ts.SyntaxKind.ObjectLiteralExpression:
                    {
                        var type = this.typeHelper.getCType(node);
                        this.scheduleNodeDisposal(node, { canReuse: type !== ctypes_1.UniversalVarType });
                    }
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    {
                        var binExpr = node;
                        var leftType = this.typeHelper.getCType(binExpr.left);
                        var rightType = this.typeHelper.getCType(binExpr.right);
                        if (utils_1.isPlusOp(binExpr.operatorToken.kind)) {
                            if (leftType == ctypes_1.UniversalVarType || rightType == ctypes_1.UniversalVarType)
                                this.needsGCMain = true;
                            else {
                                var n = binExpr;
                                while (ts.isBinaryExpression(n.parent) && utils_1.isPlusOp(n.parent.operatorToken.kind))
                                    n = n.parent;
                                var isInConsoleLog = ts.isCallExpression(n.parent) && n.parent.expression.getText() == "console.log";
                                if (!isInConsoleLog && (utils_1.toPrimitive(leftType) == ctypes_1.StringVarType || utils_1.toPrimitive(rightType) == ctypes_1.StringVarType))
                                    this.scheduleNodeDisposal(binExpr, { canReuse: false });
                            }
                        }
                        if (binExpr.operatorToken.kind === ts.SyntaxKind.InKeyword
                            && !(rightType instanceof ctypes_1.ArrayType)
                            && (leftType === ctypes_1.UniversalVarType || leftType instanceof ctypes_1.ArrayType || leftType === ctypes_1.NumberVarType && !ts.isNumericLiteral(binExpr.left)))
                            this.needsGCMain = true;
                    }
                    break;
                case ts.SyntaxKind.CallExpression:
                    {
                        if (standard_1.StandardCallHelper.needsDisposal(this.typeHelper, node))
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
                        var type = this.typeHelper.getCType(node);
                        var parentFunc = utils_1.findParentFunction(node.parent);
                        if (parentFunc && type instanceof ctypes_1.FuncType && type.needsClosureStruct)
                            this.scheduleNodeDisposal(node, { subtype: "closure" });
                        else if (type instanceof ctypes_1.FuncType && type.scopeType)
                            this.scheduleNodeDisposal(node, { subtype: "scope", canReuse: false });
                    }
                    break;
            }
        }
    };
    MemoryManager.prototype.getGCVariablesForScope = function (node) {
        var parentDecl = utils_1.findParentFunction(node);
        var scopeId = parentDecl && parentDecl.pos + 1 + "" || "main";
        var realScopeId = this.scopes[scopeId] && this.scopes[scopeId].length && this.scopes[scopeId][0].scopeId;
        var gcVars = [];
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(function (v) { return !v.simple && !v.array && !v.dict && !v.arrayWithContents; }).length) {
            gcVars.push("gc_" + realScopeId);
        }
        if (scopeId == "main" && this.needsGCMain && gcVars[0] != "gc_main") {
            gcVars.push("gc_main");
        }
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(function (v) { return !v.simple && v.array; }).length) {
            gcVars.push("gc_" + realScopeId + "_arrays");
        }
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(function (v) { return !v.simple && v.arrayWithContents; }).length) {
            gcVars.push("gc_" + realScopeId + "_arrays_c");
        }
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(function (v) { return !v.simple && v.dict; }).length) {
            gcVars.push("gc_" + realScopeId + "_dicts");
        }
        return gcVars;
    };
    MemoryManager.prototype.getGCVariableForNode = function (node) {
        var key = node.pos + "_" + node.end;
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
    };
    MemoryManager.prototype.getDestructorsForScope = function (node) {
        var parentDecl = utils_1.findParentFunction(node);
        var scopeId = parentDecl && parentDecl.pos + 1 || "main";
        var destructors = [];
        if (this.scopes[scopeId]) {
            // string match allocates array of strings, and each of those strings should be also disposed
            for (var _i = 0, _a = this.scopes[scopeId].filter(function (v) { return v.simple && v.used; }); _i < _a.length; _i++) {
                var simpleVarScopeInfo = _a[_i];
                var type = this.typeHelper.getCType(simpleVarScopeInfo.node);
                destructors.push({
                    varName: simpleVarScopeInfo.varName,
                    array: simpleVarScopeInfo.array,
                    dict: simpleVarScopeInfo.dict,
                    string: type == ctypes_1.StringVarType,
                    arrayWithContents: simpleVarScopeInfo.arrayWithContents
                });
            }
        }
        return destructors;
    };
    MemoryManager.prototype.variableWasReused = function (node) {
        var key = node.pos + "_" + node.end;
        return !!this.reusedVariables[key];
    };
    /** Variables that need to be disposed are tracked by memory manager */
    MemoryManager.prototype.getReservedTemporaryVarName = function (node) {
        var key = node.pos + "_" + node.end;
        if (this.reusedVariables[key])
            key = this.reusedVariables[key];
        var scopeOfVar = this.scopesOfVariables[key];
        if (scopeOfVar) {
            scopeOfVar.used = true;
            return scopeOfVar.varName;
        }
        else
            return null;
    };
    /** Sometimes we can reuse existing variable instead of creating a temporary one. */
    MemoryManager.prototype.tryReuseExistingVariable = function (node) {
        if (ts.isBinaryExpression(node.parent) && ts.isIdentifier(node.parent.left) && node.parent.operatorToken.kind == ts.SyntaxKind.EqualsToken)
            return node.parent.left;
        if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name))
            return node.parent.name;
        return null;
    };
    MemoryManager.prototype.scheduleNodeDisposal = function (heapNode, options) {
        options = __assign({ canReuse: true, subtype: null }, options);
        var isTemp = true;
        if (options.canReuse) {
            var existingVariable = this.tryReuseExistingVariable(heapNode);
            isTemp = existingVariable == null;
            if (!isTemp) {
                this.reusedVariables[heapNode.pos + "_" + heapNode.end] = existingVariable.pos + "_" + existingVariable.end;
                this.originalNodes[existingVariable.pos + "_" + existingVariable.end] = heapNode;
                heapNode = existingVariable;
            }
        }
        var varFuncNode = utils_1.findParentFunction(heapNode);
        var topScope = varFuncNode && varFuncNode.pos + 1 || "main";
        var isSimple = true;
        if (this.isInsideLoop(heapNode))
            isSimple = false;
        var scopeTree = {};
        scopeTree[topScope] = true;
        var queue = [heapNode];
        if (options.subtype === "scope")
            queue = this.getStartNodesForTrekingFunctionScope(heapNode);
        var visited = {};
        while (queue.length > 0) {
            var node = queue.shift();
            if (visited[node.pos + "_" + node.end])
                continue;
            var refs = [node];
            if (node.kind == ts.SyntaxKind.Identifier) {
                var decl = this.typeHelper.getDeclaration(node);
                if (decl)
                    refs = this.references[decl.pos] || refs;
            }
            else if (ts.isFunctionDeclaration(node)) {
                refs = this.references[node.pos] || refs;
            }
            var returned = false;
            for (var _i = 0, refs_1 = refs; _i < refs_1.length; _i++) {
                var ref = refs_1[_i];
                visited[ref.pos + "_" + ref.end] = true;
                var parentNode = utils_1.findParentFunction(utils_1.isFunction(ref) ? ref.parent : ref);
                if (!parentNode)
                    topScope = "main";
                if (ref.kind == ts.SyntaxKind.PropertyAccessExpression) {
                    var elemAccess = ref;
                    while (elemAccess.expression.kind == ts.SyntaxKind.PropertyAccessExpression)
                        elemAccess = elemAccess.expression;
                    if (elemAccess.expression.kind == ts.SyntaxKind.Identifier) {
                        console.log(heapNode.getText() + " -> Tracking parent variable: " + elemAccess.expression.getText() + ".");
                        queue.push(elemAccess.expression);
                    }
                }
                if (ref.parent && ref.parent.kind == ts.SyntaxKind.BinaryExpression) {
                    var binaryExpr = ref.parent;
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
                if (ref.parent && ref.parent.kind == ts.SyntaxKind.ParenthesizedExpression) {
                    console.log(heapNode.getText() + " -> Found parenthesized expression.");
                    queue.push(ref.parent);
                }
                if (ref.parent && ref.parent.kind == ts.SyntaxKind.CallExpression) {
                    var call = ref.parent;
                    if (ts.isIdentifier(call.expression) && call.expression === ref) {
                        console.log(heapNode.getText() + " -> Found function call!");
                        if (topScope !== "main") {
                            var funcNode = utils_1.findParentFunction(call);
                            topScope = funcNode && funcNode.pos + 1 || "main";
                            var targetScope = node.parent.pos + 1 + "";
                            isSimple = false;
                            if (scopeTree[targetScope])
                                delete scopeTree[targetScope];
                            scopeTree[topScope] = targetScope;
                        }
                        this.addIfFoundInAssignment(heapNode, call, queue);
                    }
                    else if (call.expression === ref) {
                        console.log(heapNode.getText() + " -> Found function expression call!");
                        isSimple = false;
                        queue.push(call);
                    }
                    else {
                        var decl = this.typeHelper.getDeclaration(call.expression);
                        if (!decl) {
                            var isStandardCall = standard_1.StandardCallHelper.isStandardCall(this.typeHelper, call);
                            if (isStandardCall) {
                                var standardCallEscapeNode = standard_1.StandardCallHelper.getEscapeNode(this.typeHelper, call);
                                if (standardCallEscapeNode) {
                                    console.log(heapNode.getText() + " escapes to '" + standardCallEscapeNode.getText() + "' via standard call '" + call.getText() + "'.");
                                    queue.push(standardCallEscapeNode);
                                }
                            }
                            else {
                                console.log(heapNode.getText() + " -> Detected passing to external function " + call.expression.getText() + "." + (topScope != "main" ? "Scope changed to main." : ""));
                                topScope = "main";
                            }
                        }
                        else {
                            var funcDecl = decl;
                            for (var i_1 = 0; i_1 < call.arguments.length; i_1++) {
                                if (call.arguments[i_1].pos <= ref.pos && call.arguments[i_1].end >= ref.end) {
                                    if (funcDecl.pos + 1 == topScope) {
                                        console.log(heapNode.getText() + " -> Found recursive call with parameter " + funcDecl.parameters[i_1].name.getText());
                                        queue.push(funcDecl.name);
                                    }
                                    else {
                                        console.log(heapNode.getText() + " -> Found passing to function " + call.expression.getText() + " as parameter " + funcDecl.parameters[i_1].name.getText());
                                        queue.push(funcDecl.parameters[i_1].name);
                                    }
                                    isSimple = false;
                                }
                            }
                        }
                    }
                }
                else if (ref.parent && ref.parent.kind == ts.SyntaxKind.ReturnStatement && !returned) {
                    returned = true;
                    queue.push(ts.isFunctionExpression(parentNode) ? parentNode : parentNode.name);
                    console.log(heapNode.getText() + " -> Found variable returned from the function!");
                    isSimple = false;
                }
                else
                    this.addIfFoundInAssignment(heapNode, ref, queue);
            }
        }
        var type = this.typeHelper.getCType(heapNode);
        var varName;
        if (!isTemp)
            varName = heapNode.getText().replace(/\./g, '->');
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
            varName = this.symbolsHelper.addTemp(heapNode, standard_1.StandardCallHelper.getTempVarName(this.typeHelper, heapNode));
        else if (ts.isIdentifier(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, heapNode.text);
        else if (utils_1.isFunction(heapNode)) {
            var suffix = options.subtype || "tmp";
            var maybePropertyName = ts.isPropertyAssignment(heapNode.parent) && ts.isIdentifier(heapNode.parent.name) ? heapNode.parent.name.text + "_" + suffix : suffix;
            var name_1 = heapNode.name ? heapNode.name.text + "_" + suffix : maybePropertyName;
            varName = this.symbolsHelper.addTemp(utils_1.findParentSourceFile(heapNode), name_1);
        }
        else
            varName = this.symbolsHelper.addTemp(heapNode, "tmp");
        var vnode = heapNode;
        var key = vnode.pos + "_" + vnode.end;
        var arrayWithContents = false;
        if (this.originalNodes[key])
            vnode = this.originalNodes[key];
        if (vnode.kind == ts.SyntaxKind.CallExpression && new match_1.StringMatchResolver().matchesNode(this.typeHelper, vnode))
            arrayWithContents = true;
        var foundScopes = topScope == "main" ? [topScope] : Object.keys(scopeTree);
        var scopeInfo = {
            node: heapNode,
            simple: isSimple,
            arrayWithContents: arrayWithContents,
            array: !arrayWithContents && type && type instanceof ctypes_1.ArrayType && type.isDynamicArray || type === ctypes_1.UniversalVarType && ts.isArrayLiteralExpression(heapNode),
            dict: type && type instanceof ctypes_1.DictType || type === ctypes_1.UniversalVarType && ts.isObjectLiteralExpression(heapNode),
            varName: varName,
            scopeId: foundScopes.join("_"),
            used: !isTemp
        };
        this.scopesOfVariables[heapNode.pos + "_" + heapNode.end] = scopeInfo;
        for (var _a = 0, foundScopes_1 = foundScopes; _a < foundScopes_1.length; _a++) {
            var sc = foundScopes_1[_a];
            this.scopes[sc] = this.scopes[sc] || [];
            this.scopes[sc].push(scopeInfo);
        }
    };
    MemoryManager.prototype.getStartNodesForTrekingFunctionScope = function (func) {
        var allNodesInFunc = utils_1.getAllNodesInFunction(func);
        var startNodes = [];
        for (var _i = 0, allNodesInFunc_1 = allNodesInFunc; _i < allNodesInFunc_1.length; _i++) {
            var node = allNodesInFunc_1[_i];
            var type = this.typeHelper.getCType(node);
            if (type instanceof ctypes_1.FuncType && type.needsClosureStruct)
                startNodes.push(node);
        }
        return startNodes;
    };
    MemoryManager.prototype.addIfFoundInAssignment = function (varIdent, ref, queue) {
        if (ref.parent && ref.parent.kind == ts.SyntaxKind.VariableDeclaration) {
            var varDecl = ref.parent;
            if (varDecl.initializer && varDecl.initializer.pos == ref.pos) {
                queue.push(varDecl.name);
                console.log(varIdent.getText() + " -> Found initializer-assignment to variable " + varDecl.name.getText());
                return true;
            }
        }
        else if (ref.parent && ref.parent.kind == ts.SyntaxKind.BinaryExpression) {
            var binaryExpr = ref.parent;
            if (binaryExpr.operatorToken.kind == ts.SyntaxKind.FirstAssignment && binaryExpr.right.pos == ref.pos) {
                queue.push(binaryExpr.left);
                console.log(varIdent.getText() + " -> Found assignment to variable " + binaryExpr.left.getText());
                return true;
            }
        }
        return false;
    };
    MemoryManager.prototype.isInsideLoop = function (node) {
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
    };
    return MemoryManager;
}());
exports.MemoryManager = MemoryManager;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./standard":14,"./standard/string/match":37,"./types/ctypes":44,"./types/utils":49}],2:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../template");
var ctypes_1 = require("../types/ctypes");
var elementaccess_1 = require("./elementaccess");
var typeconvert_1 = require("./typeconvert");
var AssignmentHelper = /** @class */ (function () {
    function AssignmentHelper() {
    }
    AssignmentHelper.create = function (scope, left, right, inline) {
        if (inline === void 0) { inline = false; }
        var accessor;
        var varType;
        var argumentExpression;
        if (left.kind === ts.SyntaxKind.ElementAccessExpression) {
            var elemAccess = left;
            varType = scope.root.typeHelper.getCType(elemAccess.expression);
            if (elemAccess.expression.kind == ts.SyntaxKind.Identifier)
                accessor = elemAccess.expression.getText();
            else
                accessor = new elementaccess_1.CElementAccess(scope, elemAccess.expression);
            if (varType instanceof ctypes_1.StructType && elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                var ident = elemAccess.argumentExpression.getText().slice(1, -1);
                if (ident.search(/^[_A-Za-z][_A-Za-z0-9]*$/) > -1)
                    argumentExpression = ident;
                else
                    argumentExpression = template_1.CodeTemplateFactory.createForNode(scope, elemAccess.argumentExpression);
            }
            else
                argumentExpression = template_1.CodeTemplateFactory.createForNode(scope, elemAccess.argumentExpression);
        }
        else {
            varType = scope.root.typeHelper.getCType(left);
            accessor = new elementaccess_1.CElementAccess(scope, left);
            argumentExpression = null;
        }
        return new CAssignment(scope, accessor, argumentExpression, varType, right, inline);
    };
    return AssignmentHelper;
}());
exports.AssignmentHelper = AssignmentHelper;
var CAssignment = /** @class */ (function (_super) {
    __extends(CAssignment, _super);
    function CAssignment(scope, accessor, argumentExpression, type, right, inline) {
        if (inline === void 0) { inline = false; }
        var _this = _super.call(this) || this;
        _this.accessor = accessor;
        _this.argumentExpression = argumentExpression;
        _this.isObjLiteralAssignment = false;
        _this.isArrayLiteralAssignment = false;
        _this.isDynamicArray = false;
        _this.isStaticArray = false;
        _this.isStruct = false;
        _this.isDict = false;
        _this.isNewExpression = false;
        _this.isUniversalVar = false;
        _this.assignmentRemoved = false;
        _this.CR = inline ? "" : ";\n";
        _this.isNewExpression = right.kind === ts.SyntaxKind.NewExpression;
        _this.isDynamicArray = type instanceof ctypes_1.ArrayType && type.isDynamicArray;
        _this.isStaticArray = type instanceof ctypes_1.ArrayType && !type.isDynamicArray;
        _this.isDict = type instanceof ctypes_1.DictType;
        _this.isStruct = type instanceof ctypes_1.StructType;
        _this.isUniversalVar = type === ctypes_1.UniversalVarType;
        _this.nodeText = right.pos < 0 ? "(synthetized node)" : right.getText();
        var argType = type;
        var argAccessor = accessor;
        if (argumentExpression) {
            if (type instanceof ctypes_1.StructType && typeof argumentExpression === 'string')
                argType = type.properties[argumentExpression];
            else if (type instanceof ctypes_1.ArrayType || type instanceof ctypes_1.DictType)
                argType = type.elementType;
            argAccessor = new elementaccess_1.CSimpleElementAccess(scope, type, accessor, argumentExpression);
        }
        var isTempVar = !!scope.root.memoryManager.getReservedTemporaryVarName(right);
        if (right.kind == ts.SyntaxKind.ObjectLiteralExpression && !isTempVar) {
            _this.isObjLiteralAssignment = true;
            var objLiteral = right;
            _this.objInitializers = objLiteral.properties
                .filter(function (p) { return p.kind == ts.SyntaxKind.PropertyAssignment; })
                .map(function (p) { return p; })
                .map(function (p) {
                var propName = (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text;
                return new CAssignment_1(scope, argAccessor, _this.isDict ? '"' + propName + '"' : propName, argType, p.initializer);
            });
        }
        else if (right.kind == ts.SyntaxKind.ArrayLiteralExpression && !isTempVar) {
            _this.isArrayLiteralAssignment = true;
            var arrLiteral = right;
            _this.arrayLiteralSize = arrLiteral.elements.length;
            _this.arrInitializers = arrLiteral.elements.map(function (e, i) { return new CAssignment_1(scope, argAccessor, "" + i, argType, e); });
        }
        else if (!_this.isUniversalVar && argType == ctypes_1.UniversalVarType) {
            _this.expression = new typeconvert_1.CAsUniversalVar(scope, right);
        }
        else
            _this.expression = template_1.CodeTemplateFactory.createForNode(scope, right);
        if (_this.argumentExpression == null) {
            var expr = typeof _this.expression == "string" ? _this.expression : _this.expression && _this.expression["resolve"] && _this.expression["resolve"]();
            var acc = typeof _this.accessor == "string" ? _this.accessor : _this.accessor && _this.accessor["resolve"] && _this.accessor["resolve"]();
            if (expr == '' || acc == expr || "((void *)" + acc + ")" == expr)
                _this.assignmentRemoved = true;
        }
        return _this;
    }
    CAssignment_1 = CAssignment;
    CAssignment = CAssignment_1 = __decorate([
        template_1.CodeTemplate("\n{#if assignmentRemoved}\n{#elseif isNewExpression}\n    {expression}{CR}\n{#elseif isObjLiteralAssignment}\n    {objInitializers}\n{#elseif isArrayLiteralAssignment}\n    {arrInitializers}\n{#elseif isDynamicArray && argumentExpression == null}\n    {accessor} = ((void *){expression}){CR}\n{#elseif argumentExpression == null}\n    {accessor} = {expression}{CR}\n{#elseif isStruct}\n    {accessor}->{argumentExpression} = {expression}{CR}\n{#elseif isDict}\n    DICT_SET({accessor}, {argumentExpression}, {expression}){CR}\n{#elseif isDynamicArray}\n    {accessor}->data[{argumentExpression}] = {expression}{CR}\n{#elseif isStaticArray}\n    {accessor}[{argumentExpression}] = {expression}{CR}\n{#elseif isUniversalVar}\n    if ({accessor}.type == JS_VAR_DICT)\n        DICT_SET(((struct dict_js_var_t *){accessor}.data), {argumentExpression}, {expression})\n{#else}\n    /* Unsupported assignment {accessor}[{argumentExpression}] = {nodeText} */{CR}\n{/if}")
    ], CAssignment);
    return CAssignment;
    var CAssignment_1;
}(template_1.CTemplateBase));
exports.CAssignment = CAssignment;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":43,"../types/ctypes":44,"./elementaccess":4,"./typeconvert":10}],3:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var standard_1 = require("../standard");
var template_1 = require("../template");
var variable_1 = require("./variable");
var ctypes_1 = require("../types/ctypes");
var typeconvert_1 = require("./typeconvert");
var utils_1 = require("../types/utils");
var literals_1 = require("./literals");
var CCallExpression = /** @class */ (function (_super) {
    __extends(CCallExpression, _super);
    function CCallExpression(scope, call) {
        var _this = _super.call(this) || this;
        _this.funcName = null;
        _this.standardCall = null;
        _this.standardCall = standard_1.StandardCallHelper.createTemplate(scope, call);
        if (_this.standardCall)
            return _this;
        // calling function that uses "this"
        var funcType = scope.root.typeHelper.getCType(call.expression);
        if (!funcType || funcType.instanceType != null) {
            _this.nodeText = call.getText();
            return _this;
        }
        _this.funcName = template_1.CodeTemplateFactory.createForNode(scope, call.expression);
        _this.arguments = call.arguments.map(function (a, i) { return funcType.parameterTypes[i] === ctypes_1.UniversalVarType ? new typeconvert_1.CAsUniversalVar(scope, a) : template_1.CodeTemplateFactory.createForNode(scope, a); });
        if (funcType.needsClosureStruct) {
            _this.arguments.push(_this.funcName);
            _this.funcName = template_1.CodeTemplateFactory.templateToString(_this.funcName) + "->func";
        }
        else {
            var _loop_1 = function (p) {
                var parentFunc = utils_1.findParentFunction(call);
                var funcType_1 = scope.root.typeHelper.getCType(parentFunc);
                var closureVarName = funcType_1 && funcType_1.needsClosureStruct && scope.root.symbolsHelper.getClosureVarName(parentFunc);
                var value = p.node.text;
                if (closureVarName && funcType_1.closureParams.some(function (p) { return p.node.text === value; }))
                    value = closureVarName + "->scope->" + value;
                this_1.arguments.push((p.assigned ? "&" : "") + value);
            };
            var this_1 = this;
            for (var _i = 0, _a = funcType.closureParams; _i < _a.length; _i++) {
                var p = _a[_i];
                _loop_1(p);
            }
        }
        return _this;
    }
    CCallExpression = __decorate([
        template_1.CodeTemplate("\n{#if standardCall}\n    {standardCall}\n{#elseif funcName}\n    {funcName}({arguments {, }=> {this}})\n{#else}\n    /* Unsupported function call: {nodeText} */\n{/if}", ts.SyntaxKind.CallExpression)
    ], CCallExpression);
    return CCallExpression;
}(template_1.CTemplateBase));
exports.CCallExpression = CCallExpression;
var CNew = /** @class */ (function (_super) {
    __extends(CNew, _super);
    function CNew(scope, node) {
        var _this = _super.call(this) || this;
        _this.funcName = "";
        _this.allocator = "";
        _this.expression = "";
        var decl = scope.root.typeHelper.getDeclaration(node.expression);
        if (decl && ts.isIdentifier(node.expression)) {
            var funcType = scope.root.typeHelper.getCType(decl);
            _this.funcName = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
            _this.arguments = node.arguments.map(function (arg) { return template_1.CodeTemplateFactory.createForNode(scope, arg); });
            var varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.variables.push(new variable_1.CVariable(scope, varName, funcType.instanceType));
            _this.arguments.unshift(varName);
            _this.allocator = new variable_1.CVariableAllocation(scope, varName, funcType.instanceType, node);
        }
        else if (ts.isIdentifier(node.expression) && node.expression.text === "Object") {
            if (node.arguments.length === 0 || utils_1.isNullOrUndefined(node.arguments[0])) {
                var objLiteral = ts.createObjectLiteral();
                objLiteral.parent = node;
                scope.root.typeHelper.registerSyntheticNode(objLiteral, ctypes_1.PointerVarType);
                _this.expression = new literals_1.CObjectLiteralExpression(scope, objLiteral);
            }
        }
        _this.nodeText = node.getText();
        return _this;
    }
    CNew = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {allocator}\n{/statements}\n{#if funcName}\n    {funcName}({arguments {, }=> {this}})\n{#elseif expression}\n    {expression}\n{#else}\n    /* Unsupported 'new' expression {nodeText} */\n{/if}", ts.SyntaxKind.NewExpression)
    ], CNew);
    return CNew;
}(template_1.CTemplateBase));
exports.CNew = CNew;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../standard":14,"../template":43,"../types/ctypes":44,"../types/utils":49,"./literals":7,"./typeconvert":10,"./variable":11}],4:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../template");
var ctypes_1 = require("../types/ctypes");
var literals_1 = require("./literals");
var typeconvert_1 = require("./typeconvert");
var utils_1 = require("../types/utils");
var CElementAccess = /** @class */ (function (_super) {
    __extends(CElementAccess, _super);
    function CElementAccess(scope, node) {
        var _this = _super.call(this) || this;
        var type = null;
        var elementAccess = null;
        var argumentExpression = null;
        var isScopeVariable = false;
        if (ts.isIdentifier(node)) {
            type = scope.root.typeHelper.getCType(node);
            isScopeVariable = scope.root.typeHelper.isScopeVariable(node);
            elementAccess = node.text;
            if (utils_1.isInBoolContext(node) && type instanceof ctypes_1.ArrayType && !type.isDynamicArray) {
                argumentExpression = "0";
            }
            else if (type instanceof ctypes_1.FuncType && type.needsClosureStruct) {
                var decl = scope.root.typeHelper.getDeclaration(node);
                elementAccess = scope.root.memoryManager.getReservedTemporaryVarName(decl) || elementAccess;
            }
        }
        else if (node.kind == ts.SyntaxKind.PropertyAccessExpression) {
            var propAccess = node;
            type = scope.root.typeHelper.getCType(propAccess.expression);
            if (ts.isIdentifier(propAccess.expression)) {
                elementAccess = propAccess.expression.text;
                isScopeVariable = scope.root.typeHelper.isScopeVariable(propAccess.expression);
            }
            else
                elementAccess = new CElementAccess_1(scope, propAccess.expression);
            if (type === ctypes_1.UniversalVarType) {
                argumentExpression = 'js_var_from_str("' + propAccess.name.text + '")';
                scope.root.headerFlags.js_var_from_str = true;
            }
            else if (type instanceof ctypes_1.DictType)
                argumentExpression = '"' + propAccess.name.text + '"';
            else
                argumentExpression = propAccess.name.text;
        }
        else if (node.kind == ts.SyntaxKind.ElementAccessExpression) {
            var elemAccess = node;
            type = scope.root.typeHelper.getCType(elemAccess.expression);
            if (ts.isIdentifier(elemAccess.expression)) {
                elementAccess = elemAccess.expression.text;
                isScopeVariable = scope.root.typeHelper.isScopeVariable(elemAccess.expression);
            }
            else
                elementAccess = new CElementAccess_1(scope, elemAccess.expression);
            if (type === ctypes_1.UniversalVarType)
                argumentExpression = new typeconvert_1.CAsUniversalVar(scope, elemAccess.argumentExpression);
            else if (type instanceof ctypes_1.StructType && elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                var ident = elemAccess.argumentExpression.getText().slice(1, -1);
                if (ident.search(/^[_A-Za-z][_A-Za-z0-9]*$/) > -1)
                    argumentExpression = ident;
                else
                    argumentExpression = template_1.CodeTemplateFactory.createForNode(scope, elemAccess.argumentExpression);
            }
            else
                argumentExpression = template_1.CodeTemplateFactory.createForNode(scope, elemAccess.argumentExpression);
        }
        else {
            type = scope.root.typeHelper.getCType(node);
            elementAccess = template_1.CodeTemplateFactory.createForNode(scope, node);
        }
        var parentFunc = utils_1.findParentFunction(node);
        var parentFuncType = scope.root.typeHelper.getCType(parentFunc);
        if (parentFuncType && parentFuncType.needsClosureStruct && parentFuncType.closureParams.some(function (p) { return p.refs.some(function (r) { return r.pos === node.pos; }); }))
            elementAccess = scope.root.symbolsHelper.getClosureVarName(parentFunc) + "->scope->" + template_1.CodeTemplateFactory.templateToString(elementAccess);
        else if (parentFuncType && parentFuncType.closureParams.some(function (p) { return p.refs.some(function (r) { return r.pos === node.pos; }) && p.assigned; }))
            elementAccess = "*" + template_1.CodeTemplateFactory.templateToString(elementAccess);
        else if (isScopeVariable)
            elementAccess = scope.root.symbolsHelper.getScopeVarName(parentFunc) + "->" + template_1.CodeTemplateFactory.templateToString(elementAccess);
        _this.simpleAccessor = new CSimpleElementAccess(scope, type, elementAccess, argumentExpression);
        return _this;
    }
    CElementAccess_1 = CElementAccess;
    CElementAccess = CElementAccess_1 = __decorate([
        template_1.CodeTemplate("{simpleAccessor}", [ts.SyntaxKind.ElementAccessExpression, ts.SyntaxKind.PropertyAccessExpression, ts.SyntaxKind.Identifier])
    ], CElementAccess);
    return CElementAccess;
    var CElementAccess_1;
}(template_1.CTemplateBase));
exports.CElementAccess = CElementAccess;
var CSimpleElementAccess = /** @class */ (function (_super) {
    __extends(CSimpleElementAccess, _super);
    function CSimpleElementAccess(scope, type, elementAccess, argumentExpression) {
        var _this = _super.call(this) || this;
        _this.elementAccess = elementAccess;
        _this.argumentExpression = argumentExpression;
        _this.isDynamicArray = false;
        _this.isStaticArray = false;
        _this.isStruct = false;
        _this.isDict = false;
        _this.isString = false;
        _this.nullValue = "0";
        _this.isUniversalAccess = false;
        _this.isSimpleVar = typeof type === 'string' && type != ctypes_1.UniversalVarType && type != ctypes_1.PointerVarType;
        _this.isDynamicArray = type instanceof ctypes_1.ArrayType && type.isDynamicArray;
        _this.isStaticArray = type instanceof ctypes_1.ArrayType && !type.isDynamicArray;
        _this.arrayCapacity = type instanceof ctypes_1.ArrayType && !type.isDynamicArray && type.capacity + "";
        _this.isDict = type instanceof ctypes_1.DictType;
        _this.isStruct = type instanceof ctypes_1.StructType;
        if (type === ctypes_1.UniversalVarType && argumentExpression != null) {
            _this.isUniversalAccess = true;
            scope.root.headerFlags.js_var_get = true;
        }
        _this.isString = type === ctypes_1.StringVarType;
        if (argumentExpression != null && type instanceof ctypes_1.DictType && type.elementType === ctypes_1.UniversalVarType)
            _this.nullValue = new literals_1.CUndefined(scope);
        if (_this.isString && _this.argumentExpression == "length")
            scope.root.headerFlags.str_len = true;
        return _this;
    }
    CSimpleElementAccess = __decorate([
        template_1.CodeTemplate("\n{#if isString && argumentExpression == 'length'}\n    str_len({elementAccess})\n{#elseif isSimpleVar || argumentExpression == null}\n    {elementAccess}\n{#elseif isDynamicArray && argumentExpression == 'length'}\n    {elementAccess}->size\n{#elseif isDynamicArray}\n    {elementAccess}->data[{argumentExpression}]\n{#elseif isStaticArray && argumentExpression == 'length'}\n    {arrayCapacity}\n{#elseif isStaticArray}\n    {elementAccess}[{argumentExpression}]\n{#elseif isStruct}\n    {elementAccess}->{argumentExpression}\n{#elseif isDict}\n    DICT_GET({elementAccess}, {argumentExpression}, {nullValue})\n{#elseif isUniversalAccess}\n    js_var_get({elementAccess}, {argumentExpression})\n{#else}\n    /* Unsupported element access scenario: {elementAccess} {argumentExpression} */\n{/if}")
    ], CSimpleElementAccess);
    return CSimpleElementAccess;
}(template_1.CTemplateBase));
exports.CSimpleElementAccess = CSimpleElementAccess;
var CArraySize = /** @class */ (function (_super) {
    __extends(CArraySize, _super);
    function CArraySize(scope, varAccess, type) {
        var _this = _super.call(this) || this;
        _this.varAccess = varAccess;
        _this.type = type;
        _this.arrayCapacity = type.capacity + "";
        return _this;
    }
    CArraySize = __decorate([
        template_1.CodeTemplate("\n{#if type.isDynamicArray}\n    {varAccess}->size\n{#else}\n    {arrayCapacity}\n{/if}")
    ], CArraySize);
    return CArraySize;
}(template_1.CTemplateBase));
exports.CArraySize = CArraySize;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":43,"../types/ctypes":44,"../types/utils":49,"./literals":7,"./typeconvert":10}],5:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var assignment_1 = require("./assignment");
var template_1 = require("../template");
var ctypes_1 = require("../types/ctypes");
var variable_1 = require("./variable");
var regexfunc_1 = require("./regexfunc");
var literals_1 = require("./literals");
var typeconvert_1 = require("./typeconvert");
var utils_1 = require("../types/utils");
var elementaccess_1 = require("./elementaccess");
var standard_1 = require("../standard");
var CCondition = /** @class */ (function (_super) {
    __extends(CCondition, _super);
    function CCondition(scope, node) {
        var _this = _super.call(this) || this;
        _this.universalWrapper = false;
        _this.isString = false;
        _this.expressionIsIdentifier = false;
        _this.expression = template_1.CodeTemplateFactory.createForNode(scope, node);
        _this.expressionIsIdentifier = ts.isIdentifier(node);
        var type = scope.root.typeHelper.getCType(node);
        _this.isString = type == ctypes_1.StringVarType;
        if (type == ctypes_1.UniversalVarType) {
            _this.universalWrapper = true;
            scope.root.headerFlags.js_var_to_bool = true;
        }
        return _this;
    }
    CCondition = __decorate([
        template_1.CodeTemplate("\n{#if universalWrapper}\n    js_var_to_bool({expression})\n{#elseif isString && expressionIsIdentifier}\n    *{expression}\n{#elseif isString}\n    *({expression})\n{#else}\n    {expression}\n{/if}")
    ], CCondition);
    return CCondition;
}(template_1.CTemplateBase));
exports.CCondition = CCondition;
var CBinaryExpression = /** @class */ (function (_super) {
    __extends(CBinaryExpression, _super);
    function CBinaryExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.expression = null;
        if (node.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
            _this.expression = assignment_1.AssignmentHelper.create(scope, node.left, node.right, true);
            return _this;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.CommaToken) {
            var nodeAsStatement = ts.createNode(ts.SyntaxKind.ExpressionStatement);
            nodeAsStatement.expression = node.left;
            nodeAsStatement.parent = node.getSourceFile();
            scope.statements.push(template_1.CodeTemplateFactory.createForNode(scope, nodeAsStatement));
            _this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.right);
            return _this;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
            _this.expression = new CPlusExpression(scope, node);
            return _this;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.PlusEqualsToken) {
            var left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
            var right = new CPlusExpression(scope, node);
            _this.expression = "(" + template_1.CodeTemplateFactory.templateToString(left) + " = " + template_1.CodeTemplateFactory.templateToString(right) + ")";
        }
        if (utils_1.isNumberOp(node.operatorToken.kind) || utils_1.isIntegerOp(node.operatorToken.kind)) {
            _this.expression = new CArithmeticExpression(scope, node);
            return _this;
        }
        if (utils_1.isRelationalOp(node.operatorToken.kind)) {
            _this.expression = new CRelationalExpression(scope, node);
            return _this;
        }
        if (utils_1.isEqualityOp(node.operatorToken.kind)) {
            _this.expression = new CEqualityExpression(scope, node);
            return _this;
        }
        if (node.operatorToken.kind === ts.SyntaxKind.InKeyword) {
            _this.expression = new CInExpression(scope, node);
            return _this;
        }
        if (utils_1.isLogicOp(node.operatorToken.kind)) {
            _this.expression = new CLogicExpession(scope, node);
            return _this;
        }
        _this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
        return _this;
    }
    CBinaryExpression = __decorate([
        template_1.CodeTemplate("\n{#if expression}\n    {expression}\n{#else}\n    /* unsupported expression {nodeText} */\n{/if}", ts.SyntaxKind.BinaryExpression)
    ], CBinaryExpression);
    return CBinaryExpression;
}(template_1.CTemplateBase));
exports.CBinaryExpression = CBinaryExpression;
var CLogicExpession = /** @class */ (function (_super) {
    __extends(CLogicExpession, _super);
    function CLogicExpession(scope, node) {
        var _this = _super.call(this) || this;
        _this.leftVarName = "";
        _this.rightVarName = "";
        var type = scope.root.typeHelper.getCType(node);
        if (type === ctypes_1.UniversalVarType) {
            _this.left = new typeconvert_1.CAsUniversalVar(scope, node.left);
            _this.right = new typeconvert_1.CAsUniversalVar(scope, node.right);
        }
        else {
            _this.left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
            _this.right = template_1.CodeTemplateFactory.createForNode(scope, node.right);
        }
        _this.isBoolContext = utils_1.isInBoolContext(node) && type !== ctypes_1.UniversalVarType;
        var isOr = node.operatorToken.kind === ts.SyntaxKind.BarBarToken;
        if (_this.isBoolContext) {
            _this.operator = isOr ? "||" : "&&";
        }
        else {
            if (!utils_1.isSimpleNode(node.left)) {
                _this.leftVarName = scope.root.symbolsHelper.addTemp(node, "tmp1");
                scope.variables.push(new variable_1.CVariable(scope, _this.leftVarName, type));
            }
            if (!utils_1.isSimpleNode(node.right)) {
                _this.rightVarName = scope.root.symbolsHelper.addTemp(node, "tmp2");
                scope.variables.push(new variable_1.CVariable(scope, _this.rightVarName, type));
            }
            if (_this.leftVarName && type === ctypes_1.UniversalVarType) {
                _this.condition = "js_var_to_bool(" + _this.leftVarName + ")";
                scope.root.headerFlags.js_var_to_bool = true;
            }
            else
                _this.condition = _this.leftVarName || new CCondition(scope, node.left);
            if (isOr) {
                _this.whenTrue = _this.leftVarName || _this.left;
                _this.whenFalse = _this.rightVarName || _this.right;
            }
            else {
                _this.whenTrue = _this.rightVarName || _this.right;
                _this.whenFalse = _this.leftVarName || _this.left;
            }
        }
        return _this;
    }
    CLogicExpession = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if leftVarName}\n        {leftVarName} = {left};\n    {/if}\n    {#if rightVarName}\n        {rightVarName} = {right};\n    {/if}\n{/statements}\n{#if isBoolContext}\n    {left} {operator} {right}\n{#else}\n    {condition} ? {whenTrue} : {whenFalse}\n{/if}")
    ], CLogicExpession);
    return CLogicExpession;
}(template_1.CTemplateBase));
var CArithmeticExpression = /** @class */ (function (_super) {
    __extends(CArithmeticExpression, _super);
    function CArithmeticExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.operator = null;
        _this.computeOperation = null;
        var leftType = scope.root.typeHelper.getCType(node.left);
        var rightType = scope.root.typeHelper.getCType(node.right);
        _this.isCompoundAssignment = utils_1.isCompoundAssignment(node.operatorToken);
        if (utils_1.toNumberCanBeNaN(leftType) || utils_1.toNumberCanBeNaN(rightType)) {
            var js_var_operator_map = (_a = {},
                _a[ts.SyntaxKind.AsteriskToken] = "JS_VAR_ASTERISK",
                _a[ts.SyntaxKind.AsteriskEqualsToken] = "JS_VAR_ASTERISK",
                _a[ts.SyntaxKind.SlashToken] = "JS_VAR_SLASH",
                _a[ts.SyntaxKind.SlashEqualsToken] = "JS_VAR_SLASH",
                _a[ts.SyntaxKind.PercentToken] = "JS_VAR_PERCENT",
                _a[ts.SyntaxKind.PercentEqualsToken] = "JS_VAR_PERCENT",
                _a[ts.SyntaxKind.MinusToken] = "JS_VAR_MINUS",
                _a[ts.SyntaxKind.MinusEqualsToken] = "JS_VAR_MINUS",
                _a[ts.SyntaxKind.LessThanLessThanToken] = "JS_VAR_SHL",
                _a[ts.SyntaxKind.LessThanLessThanEqualsToken] = "JS_VAR_SHL",
                _a[ts.SyntaxKind.GreaterThanGreaterThanToken] = "JS_VAR_SHR",
                _a[ts.SyntaxKind.GreaterThanGreaterThanEqualsToken] = "JS_VAR_SHR",
                _a[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken] = "JS_VAR_USHR",
                _a[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken] = "JS_VAR_USHR",
                _a[ts.SyntaxKind.BarToken] = "JS_VAR_OR",
                _a[ts.SyntaxKind.BarEqualsToken] = "JS_VAR_OR",
                _a[ts.SyntaxKind.AmpersandToken] = "JS_VAR_AND",
                _a[ts.SyntaxKind.AmpersandEqualsToken] = "JS_VAR_AND",
                _a);
            _this.computeOperation = js_var_operator_map[node.operatorToken.kind];
            _this.left = new typeconvert_1.CAsUniversalVar(scope, node.left);
            _this.right = new typeconvert_1.CAsUniversalVar(scope, node.right);
            scope.root.headerFlags.js_var_compute = true;
        }
        else {
            _this.operator = node.operatorToken.getText();
            _this.left = new typeconvert_1.CAsNumber(scope, node.left);
            _this.right = new typeconvert_1.CAsNumber(scope, node.right);
            if (node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken
                || node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken) {
                _this.operator = ">>";
                var leftAsString = template_1.CodeTemplateFactory.templateToString(_this.left);
                _this.left = "((uint16_t)" + leftAsString + ")";
                if (node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken)
                    _this.left = leftAsString + " = " + _this.left;
                scope.root.headerFlags.uint16_t = true;
            }
        }
        _this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
        return _this;
        var _a;
    }
    CArithmeticExpression = __decorate([
        template_1.CodeTemplate("\n{#if operator}\n    {left} {operator} {right}\n{#elseif computeOperation && isCompoundAssignment}\n    {left} = js_var_compute({left}, {computeOperation}, {right})\n{#elseif computeOperation}\n    js_var_compute({left}, {computeOperation}, {right})\n{#else}\n    /* unsupported arithmetic expression {nodeText} */\n{/if}")
    ], CArithmeticExpression);
    return CArithmeticExpression;
}(template_1.CTemplateBase));
var CRelationalExpression = /** @class */ (function (_super) {
    __extends(CRelationalExpression, _super);
    function CRelationalExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.operator = null;
        _this.universalCondition = null;
        _this.stringCondition = null;
        var leftType = scope.root.typeHelper.getCType(node.left);
        var rightType = scope.root.typeHelper.getCType(node.right);
        if (leftType === ctypes_1.UniversalVarType || rightType === ctypes_1.UniversalVarType) {
            switch (node.operatorToken.kind) {
                case ts.SyntaxKind.LessThanToken:
                    _this.left = new typeconvert_1.CAsUniversalVar(scope, node.left);
                    _this.right = new typeconvert_1.CAsUniversalVar(scope, node.right);
                    _this.universalCondition = "> 0";
                    break;
                case ts.SyntaxKind.LessThanEqualsToken:
                    // notice operands are swapped
                    _this.left = new typeconvert_1.CAsUniversalVar(scope, node.right);
                    _this.right = new typeconvert_1.CAsUniversalVar(scope, node.left);
                    _this.universalCondition = "< 0";
                    break;
                case ts.SyntaxKind.GreaterThanToken:
                    // notice operands are swapped
                    _this.left = new typeconvert_1.CAsUniversalVar(scope, node.right);
                    _this.right = new typeconvert_1.CAsUniversalVar(scope, node.left);
                    _this.universalCondition = "> 0";
                    break;
                case ts.SyntaxKind.GreaterThanEqualsToken:
                    _this.left = new typeconvert_1.CAsUniversalVar(scope, node.left);
                    _this.right = new typeconvert_1.CAsUniversalVar(scope, node.right);
                    _this.universalCondition = "< 0";
                    break;
            }
            scope.root.headerFlags.js_var_lessthan = true;
        }
        else if (leftType === ctypes_1.StringVarType && rightType === ctypes_1.StringVarType) {
            _this.stringCondition = node.operatorToken.getText() + " 0";
            _this.left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
            _this.right = template_1.CodeTemplateFactory.createForNode(scope, node.right);
            scope.root.headerFlags.strings = true;
        }
        else {
            _this.operator = node.operatorToken.getText();
            _this.left = new typeconvert_1.CAsNumber(scope, node.left);
            _this.right = new typeconvert_1.CAsNumber(scope, node.right);
        }
        _this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
        return _this;
    }
    CRelationalExpression = __decorate([
        template_1.CodeTemplate("\n{#if operator}\n    {left} {operator} {right}\n{#elseif stringCondition}\n    strcmp({left}, {right}) {stringCondition}\n{#elseif universalCondition}\n    js_var_lessthan({left}, {right}) {universalCondition}\n{#else}\n    /* unsupported relational expression {nodeText} */\n{/if}")
    ], CRelationalExpression);
    return CRelationalExpression;
}(template_1.CTemplateBase));
var CEqualityExpression = /** @class */ (function (_super) {
    __extends(CEqualityExpression, _super);
    function CEqualityExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.expression = null;
        _this.operator = null;
        _this.stringCondition = null;
        _this.strNumCondition = null;
        _this.universalCondition = null;
        _this.strict = null;
        var leftType = scope.root.typeHelper.getCType(node.left);
        var rightType = scope.root.typeHelper.getCType(node.right);
        var notEquals = node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken;
        _this.strict = node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ? "TRUE" : "FALSE";
        _this.left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
        _this.right = template_1.CodeTemplateFactory.createForNode(scope, node.right);
        if ((leftType == ctypes_1.NumberVarType || leftType == ctypes_1.BooleanVarType) && (rightType == ctypes_1.NumberVarType || rightType == ctypes_1.BooleanVarType)) {
            _this.operator = notEquals ? "!=" : "==";
        }
        else if (leftType == ctypes_1.StringVarType && rightType == ctypes_1.StringVarType) {
            _this.stringCondition = notEquals ? "!= 0" : "== 0";
            scope.root.headerFlags.strings = true;
        }
        else if (leftType == ctypes_1.NumberVarType && rightType == ctypes_1.StringVarType
            || leftType == ctypes_1.StringVarType && rightType == ctypes_1.NumberVarType) {
            _this.strNumCondition = notEquals ? "!= 0" : "== 0";
            scope.root.headerFlags.str_int16_t_cmp = true;
            // str_int16_t_cmp expects certain order of arguments (string, number)
            if (leftType == ctypes_1.NumberVarType) {
                var tmp = _this.left;
                _this.left = _this.right;
                _this.right = tmp;
            }
        }
        else if (leftType == ctypes_1.UniversalVarType || rightType == ctypes_1.UniversalVarType) {
            _this.universalCondition = notEquals ? "== FALSE" : "== TRUE";
            _this.left = new typeconvert_1.CAsUniversalVar(scope, _this.left, leftType);
            _this.right = new typeconvert_1.CAsUniversalVar(scope, _this.right, rightType);
            scope.root.headerFlags.js_var_eq = true;
        }
        else if (leftType instanceof ctypes_1.StructType || leftType instanceof ctypes_1.ArrayType || leftType instanceof ctypes_1.DictType
            || rightType instanceof ctypes_1.StructType || rightType instanceof ctypes_1.ArrayType || rightType instanceof ctypes_1.DictType) {
            if (leftType != rightType) {
                _this.expression = notEquals ? "TRUE" : "FALSE";
                scope.root.headerFlags.bool = true;
            }
            else
                _this.operator = notEquals ? "!=" : "==";
        }
        _this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
        return _this;
    }
    CEqualityExpression = __decorate([
        template_1.CodeTemplate("\n{#if expression}\n    {expression}\n{#elseif operator}\n    {left} {operator} {right}\n{#elseif stringCondition}\n    strcmp({left}, {right}) {stringCondition}\n{#elseif strNumCondition}\n    str_int16_t_cmp({left}, {right}) {strNumCondition}\n{#elseif universalCondition}\n    js_var_eq({left}, {right}, {strict}) {universalCondition}\n{#else}\n    /* unsupported equality expression {nodeText} */\n{/if}")
    ], CEqualityExpression);
    return CEqualityExpression;
}(template_1.CTemplateBase));
var CPlusExpression = /** @class */ (function (_super) {
    __extends(CPlusExpression, _super);
    function CPlusExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.addNumbers = false;
        _this.isUniversalVar = false;
        _this.replacedWithVar = false;
        _this.replacementVarName = null;
        _this.gcVarName = null;
        var leftType = scope.root.typeHelper.getCType(node.left);
        _this.left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
        var rightType = scope.root.typeHelper.getCType(node.right);
        _this.right = template_1.CodeTemplateFactory.createForNode(scope, node.right);
        if (leftType == ctypes_1.RegexVarType) {
            leftType = ctypes_1.StringVarType;
            _this.left = new regexfunc_1.CRegexAsString(_this.left);
        }
        if (rightType == ctypes_1.RegexVarType) {
            rightType = ctypes_1.StringVarType;
            _this.right = new regexfunc_1.CRegexAsString(_this.right);
        }
        if ((leftType === ctypes_1.NumberVarType || leftType === ctypes_1.BooleanVarType) && (rightType === ctypes_1.NumberVarType || rightType === ctypes_1.BooleanVarType)) {
            _this.addNumbers = true;
        }
        else if (leftType === ctypes_1.UniversalVarType || rightType === ctypes_1.UniversalVarType) {
            _this.isUniversalVar = true;
            _this.left = new typeconvert_1.CAsUniversalVar(scope, _this.left, leftType);
            _this.right = new typeconvert_1.CAsUniversalVar(scope, _this.right, rightType);
            scope.root.headerFlags.js_var_plus = true;
        }
        else {
            var tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            scope.func.variables.push(new variable_1.CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
            _this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
            _this.replacedWithVar = true;
            _this.replacementVarName = tempVarName;
            _this.strlen_left = new typeconvert_1.CAsString_Length(scope, node.left, _this.left, leftType);
            _this.strlen_right = new typeconvert_1.CAsString_Length(scope, node.right, _this.right, rightType);
            _this.strcat_left = new typeconvert_1.CAsString_Concat(scope, node.left, tempVarName, _this.left, leftType);
            _this.strcat_right = new typeconvert_1.CAsString_Concat(scope, node.right, tempVarName, _this.right, rightType);
            scope.root.headerFlags.strings = true;
            scope.root.headerFlags.malloc = true;
            scope.root.headerFlags.str_int16_t_cat = true;
            if (_this.gcVarName) {
                scope.root.headerFlags.gc_iterator = true;
                scope.root.headerFlags.array = true;
            }
        }
        return _this;
    }
    CPlusExpression = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if replacedWithVar}\n        {replacementVarName} = malloc({strlen_left} + {strlen_right} + 1);\n        assert({replacementVarName} != NULL);\n        {replacementVarName}[0] = '\\0';\n        {strcat_left}\n        {strcat_right}\n    {/if}\n    {#if replacedWithVar && gcVarName}\n        ARRAY_PUSH({gcVarName}, {replacementVarName});\n    {/if}\n\n{/statements}\n{#if addNumbers}\n    {left} + {right}\n{#elseif replacedWithVar}\n    {replacementVarName}\n{#elseif isUniversalVar}\n    js_var_plus({left}, {right})\n{/if}")
    ], CPlusExpression);
    return CPlusExpression;
}(template_1.CTemplateBase));
var CInExpression = /** @class */ (function (_super) {
    __extends(CInExpression, _super);
    function CInExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.isArray = false;
        _this.isStruct = false;
        _this.isDict = false;
        _this.isUniversalVar = false;
        _this.result = null;
        _this.tmpVarName = null;
        var type = scope.root.typeHelper.getCType(node.right);
        _this.obj = template_1.CodeTemplateFactory.createForNode(scope, node.right);
        if (type instanceof ctypes_1.ArrayType) {
            _this.isArray = true;
            _this.arraySize = new elementaccess_1.CArraySize(scope, _this.obj, type);
            _this.key = new typeconvert_1.CAsNumber(scope, node.left);
            var keyType = scope.root.typeHelper.getCType(node.left);
            if (utils_1.toNumberCanBeNaN(keyType)) {
                _this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "tmp_key");
                scope.variables.push(new variable_1.CVariable(scope, _this.tmpVarName, ctypes_1.UniversalVarType));
            }
        }
        else {
            _this.key = new typeconvert_1.CAsString(scope, node.left);
        }
        if (type instanceof ctypes_1.StructType) {
            _this.isStruct = true;
            var propTypes = Object.keys(type.properties);
            if (propTypes.length == 0) {
                _this.result = "FALSE";
                scope.root.headerFlags.bool = true;
            }
            else {
                var initializer = "{ " + propTypes.sort().map(function (p) { return '"' + p + '"'; }).join(", ") + " }";
                _this.propertiesVarName = type.structName + "_props";
                _this.propertiesCount = propTypes.length + "";
                if (!scope.root.variables.some(function (v) { return v.name === _this.propertiesVarName; }))
                    scope.root.variables.push(new variable_1.CVariable(scope, _this.propertiesVarName, "const char *{var}[" + _this.propertiesCount + "]", { initializer: initializer }));
                scope.root.headerFlags.dict_find_pos = true;
            }
        }
        _this.isDict = type instanceof ctypes_1.DictType;
        _this.isUniversalVar = type === ctypes_1.UniversalVarType;
        if (ts.isStringLiteral(node.left)) {
            var ident_1 = ts.createIdentifier(node.left.text);
            var propAccess_1 = ts.createPropertyAccess(node.right, ident_1);
            var standardCall = ts.createCall(propAccess_1, [], []);
            ident_1.parent = propAccess_1;
            ident_1.getText = function () { return ident_1.text; };
            propAccess_1.parent = standardCall;
            propAccess_1.getText = function () { return "(" + node.right.getText() + ")." + ident_1.text; };
            standardCall.parent = node.parent;
            standardCall.getText = function () { return propAccess_1.getText() + "()"; };
            if (standard_1.StandardCallHelper.isStandardCall(scope.root.typeHelper, standardCall))
                _this.result = "TRUE";
        }
        if (_this.isArray && ts.isStringLiteral(node.left) && node.left.text === "length")
            _this.result = "TRUE";
        _this.nodeText = node.getText();
        return _this;
    }
    CInExpression = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if tmpVarName}\n        {tmpVarName} = {key};\n    {/if}\n{/statements}\n{#if result}\n    {result}\n{#elseif isArray && tmpVarName}\n    ({tmpVarName}.type != JS_VAR_NAN && {tmpVarName}.number >= 0 && {tmpVarName}.number < {arraySize})\n{#elseif isArray && !tmpVarName}\n    ({key} >= 0 && {key} < {arraySize})\n{#elseif isStruct}\n    dict_find_pos({propertiesVarName}, {propertiesCount}, {key}) > -1\n{#elseif isDict}\n    dict_find_pos({obj}->index->data, {obj}->index->size, {key}) > -1\n{#elseif isUniversalVar}\n    js_var_get({obj}, {key}).type != JS_VAR_UNDEFINED\n{#else}\n    /* unsupported 'in' expression {nodeText} */\n{/if}")
    ], CInExpression);
    return CInExpression;
}(template_1.CTemplateBase));
var CUnaryExpression = /** @class */ (function (_super) {
    __extends(CUnaryExpression, _super);
    function CUnaryExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.before = "";
        _this.after = "";
        _this.argumentExpr = null;
        _this.incrementBy = "";
        _this.isCompound = false;
        _this.isPostfix = ts.isPostfixUnaryExpression(node);
        var isTopExpressionOfStatement = ts.isExpressionStatement(node.parent);
        var type = scope.root.typeHelper.getCType(node.operand);
        if (node.operator === ts.SyntaxKind.PlusToken)
            _this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
        else if (node.operator === ts.SyntaxKind.MinusToken) {
            _this.before = "-";
            _this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
            if (utils_1.toNumberCanBeNaN(type)) {
                _this.before = "js_var_compute(js_var_from_int16_t(0), JS_VAR_MINUS, ";
                _this.after = ")";
                scope.root.headerFlags.js_var_compute = true;
                scope.root.headerFlags.js_var_from_int16_t = true;
            }
        }
        else if (node.operator === ts.SyntaxKind.TildeToken) {
            _this.before = "~";
            _this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
            if (utils_1.toNumberCanBeNaN(type))
                _this.after = ".number";
        }
        else if (node.operator === ts.SyntaxKind.ExclamationToken) {
            _this.before = "!";
            _this.operand = new CCondition(scope, node.operand);
        }
        else if (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) {
            var plus_1 = node.operator === ts.SyntaxKind.PlusPlusToken;
            var accessObj = null, isDict = false;
            if ((ts.isPropertyAccessExpression(node.operand) || ts.isElementAccessExpression(node.operand))) {
                _this.argumentExpr = template_1.CodeTemplateFactory.createForNode(scope, ts.isPropertyAccessExpression(node.operand) ? node.operand.name : node.operand.argumentExpression);
                accessObj = node.operand.expression;
                isDict = scope.root.typeHelper.getCType(accessObj) instanceof ctypes_1.DictType;
            }
            if (_this.isPostfix) {
                if (!isDict && (type === ctypes_1.NumberVarType || type === ctypes_1.BooleanVarType)) {
                    _this.operand = template_1.CodeTemplateFactory.createForNode(scope, node.operand);
                    _this.after = plus_1 ? "++" : "--";
                }
                else if (isDict) {
                    _this.operand = template_1.CodeTemplateFactory.createForNode(scope, accessObj);
                    _this.incrementBy = plus_1 ? "1" : "-1";
                    scope.root.headerFlags.js_var_dict_inc = true;
                }
                else if (type === ctypes_1.UniversalVarType) {
                    _this.before = "js_var_inc(&";
                    _this.operand = template_1.CodeTemplateFactory.createForNode(scope, node.operand);
                    _this.after = ", " + (plus_1 ? "1" : "-1") + ")";
                    scope.root.headerFlags.js_var_inc = true;
                }
                else {
                    _this.operand = "/* expression is not yet supported " + node.getText() + " */";
                }
            }
            else {
                if (!isDict && (type === ctypes_1.NumberVarType || type === ctypes_1.BooleanVarType)) {
                    _this.operand = template_1.CodeTemplateFactory.createForNode(scope, node.operand);
                    _this.before = plus_1 ? "++" : "--";
                }
                else if (!isDict && !utils_1.toNumberCanBeNaN(type)) {
                    _this.isCompound = true;
                    _this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
                    _this.after = plus_1 ? " + 1" : " - 1";
                }
                else if (isTopExpressionOfStatement) {
                    var applyOperation = plus_1 ? ts.createAdd : ts.createSubtract;
                    var binExpr = applyOperation(node.operand, ts.createNumericLiteral("1"));
                    binExpr.parent = node;
                    binExpr.getText = function () { return node.operand.getText() + (plus_1 ? "+" : "-") + "1"; };
                    binExpr.operatorToken.getText = function () { return plus_1 ? "+" : "-"; };
                    binExpr.right.getText = function () { return "1"; };
                    scope.root.typeHelper.registerSyntheticNode(binExpr, ctypes_1.UniversalVarType);
                    _this.operand = assignment_1.AssignmentHelper.create(scope, node.operand, binExpr);
                }
                else if (!isDict && plus_1) {
                    _this.isCompound = true;
                    _this.before = "js_var_plus(js_var_to_number(";
                    _this.operand = template_1.CodeTemplateFactory.createForNode(scope, node.operand);
                    _this.after = "), js_var_from_int16_t(1))";
                    scope.root.headerFlags.js_var_plus = true;
                    scope.root.headerFlags.js_var_from_int16_t = true;
                }
                else if (!isDict && !plus_1) {
                    _this.isCompound = true;
                    _this.before = "js_var_compute(js_var_to_number(";
                    _this.operand = template_1.CodeTemplateFactory.createForNode(scope, node.operand);
                    _this.after = "), JS_VAR_MINUS, js_var_from_int16_t(1))";
                    scope.root.headerFlags.js_var_compute = true;
                    scope.root.headerFlags.js_var_from_int16_t = true;
                }
                else {
                    _this.operand = template_1.CodeTemplateFactory.createForNode(scope, accessObj);
                    _this.incrementBy = plus_1 ? "1" : "-1";
                    scope.root.headerFlags.js_var_dict_inc = true;
                }
            }
        }
        else {
            _this.operand = "/* not supported unary expression " + node.getText() + " */";
        }
        return _this;
    }
    CUnaryExpression = __decorate([
        template_1.CodeTemplate("\n{#if isCompound}\n    ({operand} = {before}{operand}{after})\n{#elseif incrementBy && isPostfix}\n    js_var_dict_inc({operand}, {argumentExpr}, {incrementBy}, TRUE)\n{#elseif incrementBy}\n    js_var_dict_inc({operand}, {argumentExpr}, {incrementBy}, FALSE)\n{#else}\n    {before}{operand}{after}\n{/if}", [ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression])
    ], CUnaryExpression);
    return CUnaryExpression;
}(template_1.CTemplateBase));
var CTernaryExpression = /** @class */ (function (_super) {
    __extends(CTernaryExpression, _super);
    function CTernaryExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.condition = template_1.CodeTemplateFactory.createForNode(scope, node.condition);
        _this.whenTrue = template_1.CodeTemplateFactory.createForNode(scope, node.whenTrue);
        _this.whenFalse = template_1.CodeTemplateFactory.createForNode(scope, node.whenFalse);
        return _this;
    }
    CTernaryExpression = __decorate([
        template_1.CodeTemplate("{condition} ? {whenTrue} : {whenFalse}", ts.SyntaxKind.ConditionalExpression)
    ], CTernaryExpression);
    return CTernaryExpression;
}(template_1.CTemplateBase));
var CGroupingExpression = /** @class */ (function (_super) {
    __extends(CGroupingExpression, _super);
    function CGroupingExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        return _this;
    }
    CGroupingExpression = __decorate([
        template_1.CodeTemplate("({expression})", ts.SyntaxKind.ParenthesizedExpression)
    ], CGroupingExpression);
    return CGroupingExpression;
}(template_1.CTemplateBase));
var CTypeOf = /** @class */ (function (_super) {
    __extends(CTypeOf, _super);
    function CTypeOf(scope, node) {
        var _this = _super.call(this) || this;
        var type = scope.root.typeHelper.getCType(node.expression);
        _this.isUniversalVar = type === ctypes_1.UniversalVarType;
        _this.isString = type === ctypes_1.StringVarType;
        _this.isNumber = type === ctypes_1.NumberVarType;
        _this.isBoolean = type === ctypes_1.BooleanVarType;
        _this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        if (type == ctypes_1.UniversalVarType) {
            scope.root.headerFlags.js_var = true;
            scope.root.headerFlags.js_var_typeof = true;
        }
        return _this;
    }
    CTypeOf = __decorate([
        template_1.CodeTemplate("\n{#if isUniversalVar}\n    js_var_typeof({expression})\n{#elseif isString}\n    \"string\"\n{#elseif isNumber}\n    \"number\"\n{#elseif isBoolean}\n    \"number\"\n{#else}\n    \"object\"\n{/if}", ts.SyntaxKind.TypeOfExpression)
    ], CTypeOf);
    return CTypeOf;
}(template_1.CTemplateBase));
var CVoid = /** @class */ (function (_super) {
    __extends(CVoid, _super);
    function CVoid(scope, node) {
        var _this = _super.call(this) || this;
        _this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        scope.root.headerFlags.js_var = true;
        scope.root.headerFlags.js_var_to_undefined = true;
        return _this;
    }
    CVoid = __decorate([
        template_1.CodeTemplate("js_var_to_undefined({expression})", ts.SyntaxKind.VoidExpression)
    ], CVoid);
    return CVoid;
}(template_1.CTemplateBase));
var CDelete = /** @class */ (function (_super) {
    __extends(CDelete, _super);
    function CDelete(scope, node) {
        var _this = _super.call(this) || this;
        _this.topExpressionOfStatement = node.parent.kind == ts.SyntaxKind.ExpressionStatement;
        _this.dict = (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
            && template_1.CodeTemplateFactory.createForNode(scope, node.expression.expression);
        if (ts.isElementAccessExpression(node.expression))
            _this.argExpression = ts.isNumericLiteral(node.expression.argumentExpression)
                ? '"' + node.expression.argumentExpression.text + '"'
                : template_1.CodeTemplateFactory.createForNode(scope, node.expression.argumentExpression);
        else if (ts.isPropertyAccessExpression(node.expression))
            _this.argExpression = new literals_1.CString(scope, node.expression.name.text);
        _this.tempVarName = scope.root.symbolsHelper.addTemp(node, "tmp_dict_pos");
        scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, ctypes_1.NumberVarType));
        scope.root.headerFlags.bool = true;
        scope.root.headerFlags.array_remove = true;
        return _this;
    }
    CDelete = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {tempVarName} = dict_find_pos({dict}->index->data, {dict}->index->size, {argExpression});\n    if ({tempVarName} >= 0)\n    {\n        ARRAY_REMOVE({dict}->index, {tempVarName}, 1);\n        ARRAY_REMOVE({dict}->values, {tempVarName}, 1);\n    }\n{/statements}\n{#if !topExpressionOfStatement}\n    TRUE\n{/if}", ts.SyntaxKind.DeleteExpression)
    ], CDelete);
    return CDelete;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../standard":14,"../template":43,"../types/ctypes":44,"../types/utils":49,"./assignment":2,"./elementaccess":4,"./literals":7,"./regexfunc":8,"./typeconvert":10,"./variable":11}],6:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../template");
var variable_1 = require("./variable");
var ctypes_1 = require("../types/ctypes");
var standard_1 = require("../standard");
var utils_1 = require("../types/utils");
var CFunctionPrototype = /** @class */ (function (_super) {
    __extends(CFunctionPrototype, _super);
    function CFunctionPrototype(scope, node) {
        var _this = _super.call(this) || this;
        _this.parameters = [];
        var funcType = scope.root.typeHelper.getCType(node);
        _this.returnType = scope.root.typeHelper.getTypeString(funcType.returnType);
        _this.name = node.name.getText();
        _this.parameters = node.parameters.map(function (p, i) { return new variable_1.CVariable(scope, p.name.getText(), funcType.parameterTypes[i], { removeStorageSpecifier: true }); });
        if (funcType.instanceType)
            _this.parameters.unshift(new variable_1.CVariable(scope, "this", funcType.instanceType, { removeStorageSpecifier: true }));
        for (var _i = 0, _a = funcType.closureParams; _i < _a.length; _i++) {
            var p = _a[_i];
            _this.parameters.push(new variable_1.CVariable(scope, p.node.text, p.node, { removeStorageSpecifier: true }));
        }
        return _this;
    }
    CFunctionPrototype = __decorate([
        template_1.CodeTemplate("{returnType} {name}({parameters {, }=> {this}});")
    ], CFunctionPrototype);
    return CFunctionPrototype;
}(template_1.CTemplateBase));
exports.CFunctionPrototype = CFunctionPrototype;
var CFunction = /** @class */ (function (_super) {
    __extends(CFunction, _super);
    function CFunction(root, node) {
        var _this = _super.call(this) || this;
        _this.root = root;
        _this.func = _this;
        _this.parameters = [];
        _this.variables = [];
        _this.scopeVarAllocator = null;
        _this.statements = [];
        _this.parent = root;
        _this.name = node.name && node.name.text;
        if (!_this.name) {
            var funcExprName = "func";
            if (utils_1.isEqualsExpression(node.parent) && node.parent.right == node && ts.isIdentifier(node.parent.left))
                funcExprName = node.parent.left.text + "_func";
            if (ts.isVariableDeclaration(node.parent) && node.parent.initializer == node && ts.isIdentifier(node.parent.name))
                funcExprName = node.parent.name.text + "_func";
            if (ts.isPropertyAssignment(node.parent) && ts.isIdentifier(node.parent.name))
                funcExprName = node.parent.name.text + "_func";
            _this.name = root.symbolsHelper.addTemp(utils_1.findParentSourceFile(node), funcExprName);
        }
        var funcType = root.typeHelper.getCType(node);
        _this.funcDecl = new variable_1.CVariable(_this, _this.name, funcType.returnType, { removeStorageSpecifier: true, arraysToPointers: true });
        _this.parameters = node.parameters.map(function (p, i) {
            return new variable_1.CVariable(_this, p.name.text, funcType.parameterTypes[i], { removeStorageSpecifier: true });
        });
        if (funcType.instanceType)
            _this.parameters.unshift(new variable_1.CVariable(_this, "this", funcType.instanceType, { removeStorageSpecifier: true }));
        if (funcType.needsClosureStruct) {
            var closureParamVarName = root.symbolsHelper.getClosureVarName(node);
            _this.parameters.push(new variable_1.CVariable(_this, closureParamVarName, funcType));
        }
        else {
            for (var _i = 0, _a = funcType.closureParams; _i < _a.length; _i++) {
                var p = _a[_i];
                var type = root.typeHelper.getCType(p.node);
                var ptype = p.assigned ? ctypes_1.getTypeText(type) + "*" : type;
                _this.parameters.push(new variable_1.CVariable(_this, p.node.text, ptype, { removeStorageSpecifier: true }));
            }
        }
        if (funcType.scopeType) {
            var scopeVarName = root.symbolsHelper.getScopeVarName(node);
            _this.variables.push(new variable_1.CVariable(_this, scopeVarName, funcType.scopeType));
            _this.scopeVarAllocator = new variable_1.CVariableAllocation(_this, scopeVarName, funcType.scopeType, node);
        }
        _this.gcVarNames = root.memoryManager.getGCVariablesForScope(node);
        var _loop_1 = function (gcVarName) {
            if (root.variables.filter(function (v) { return v.name == gcVarName; }).length)
                return "continue";
            var gcType = gcVarName.indexOf("arrays") == -1 ? "ARRAY(void *)" : "ARRAY(ARRAY(void *))";
            root.variables.push(new variable_1.CVariable(root, gcVarName, gcType));
        };
        for (var _b = 0, _c = _this.gcVarNames; _b < _c.length; _b++) {
            var gcVarName = _c[_b];
            _loop_1(gcVarName);
        }
        node.body.statements.forEach(function (s) { return _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, s)); });
        if (node.body.statements.length > 0 && node.body.statements[node.body.statements.length - 1].kind != ts.SyntaxKind.ReturnStatement) {
            _this.destructors = new variable_1.CVariableDestructors(_this, node);
        }
        var nodesInFunction = utils_1.getAllNodesUnder(node);
        var declaredFunctionNames = root.functions.concat(root.functionPrototypes).map(function (f) { return f.name; });
        nodesInFunction.filter(function (n) { return ts.isCallExpression(n) && !standard_1.StandardCallHelper.isStandardCall(root.typeHelper, n); })
            .forEach(function (c) {
            if (ts.isIdentifier(c.expression) && declaredFunctionNames.indexOf(c.expression.text) === -1) {
                var decl = root.typeHelper.getDeclaration(c.expression);
                if (decl && decl !== node && ts.isFunctionDeclaration(decl)) {
                    root.functionPrototypes.push(new CFunctionPrototype(root, decl));
                    declaredFunctionNames.push(decl.name.text);
                }
            }
        });
        return _this;
    }
    CFunction = __decorate([
        template_1.CodeTemplate("\n{funcDecl}({parameters {, }=> {this}})\n{\n    {variables  {    }=> {this};\n}\n    {#if scopeVarAllocator != null}\n        {scopeVarAllocator}\n    {/if}\n    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}\n\n    {statements {    }=> {this}}\n\n    {destructors}\n}")
    ], CFunction);
    return CFunction;
}(template_1.CTemplateBase));
exports.CFunction = CFunction;
var CFunctionExpression = /** @class */ (function (_super) {
    __extends(CFunctionExpression, _super);
    function CFunctionExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.expression = '';
        _this.isClosureFunc = false;
        var type = scope.root.typeHelper.getCType(node);
        var parentFunc = utils_1.findParentFunction(node.parent);
        if (type instanceof ctypes_1.FuncType && type.needsClosureStruct && parentFunc) {
            var parentFuncType = scope.root.typeHelper.getCType(parentFunc);
            _this.isClosureFunc = true;
            _this.closureVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            scope.root.symbolsHelper.ensureClosureStruct(type, parentFuncType, _this.closureVarName);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.variables.push(new variable_1.CVariable(scope, _this.closureVarName, type));
            _this.allocator = new variable_1.CVariableAllocation(scope, _this.closureVarName, type, node);
            /** since we're anyway passing the whole scope object, probably a good idea to move this fragment into @see CFunction */
            _this.scopeVarName = parentFuncType && scope.root.symbolsHelper.getScopeVarName(node);
            var parentClosureVarName = parentFuncType && parentFuncType.needsClosureStruct && scope.root.symbolsHelper.getClosureVarName(parentFunc);
            var prefix_1 = parentClosureVarName ? parentClosureVarName + "->scope->" : "";
            var closureParamsFromParent = parentFuncType.closureParams.map(function (p) { return ({ key: p.node.text, value: prefix_1 + p.node.text }); });
            var paramsFromParent = type.closureParams.filter(function (p) { return scope.root.typeHelper.getDeclaration(p.node).parent === parentFunc; }).map(function (p) { return ({ key: p.node.text, value: p.node.text }); });
            _this.closureParams = closureParamsFromParent.concat(paramsFromParent);
        }
        var func = new CFunction(scope.root, node);
        scope.root.functions.push(func);
        _this.name = func.name;
        if (ts.isFunctionExpression(node))
            _this.expression = _this.closureVarName || func.name;
        return _this;
    }
    CFunctionExpression = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if isClosureFunc}\n        {closureParams => {scopeVarName}->{key} = {value};\n}\n        {allocator}\n        {closureVarName}->func = {name};\n        {closureVarName}->scope = {scopeVarName};\n    {/if}\n{/statements}\n{expression}", [ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.FunctionDeclaration])
    ], CFunctionExpression);
    return CFunctionExpression;
}(template_1.CTemplateBase));
exports.CFunctionExpression = CFunctionExpression;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../standard":14,"../template":43,"../types/ctypes":44,"../types/utils":49,"./variable":11}],7:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../template");
var ctypes_1 = require("../types/ctypes");
var variable_1 = require("./variable");
var assignment_1 = require("./assignment");
var regexfunc_1 = require("./regexfunc");
var typeconvert_1 = require("./typeconvert");
var CArrayLiteralExpression = /** @class */ (function (_super) {
    __extends(CArrayLiteralExpression, _super);
    function CArrayLiteralExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.universalWrapper = false;
        var arrSize = node.elements.length;
        var type = scope.root.typeHelper.getCType(node);
        if (type === ctypes_1.UniversalVarType) {
            type = new ctypes_1.ArrayType(ctypes_1.UniversalVarType, 0, true);
            _this.universalWrapper = true;
            scope.root.headerFlags.js_var_array = true;
        }
        if (type instanceof ctypes_1.ArrayType) {
            var varName = void 0;
            var canUseInitializerList = node.elements.every(function (e) { return e.kind == ts.SyntaxKind.NumericLiteral || e.kind == ts.SyntaxKind.StringLiteral; });
            if (!type.isDynamicArray && canUseInitializerList) {
                varName = scope.root.symbolsHelper.addTemp(node, "tmp_array");
                var s = "{ ";
                for (var i_1 = 0; i_1 < arrSize; i_1++) {
                    if (i_1 != 0)
                        s += ", ";
                    var cExpr = template_1.CodeTemplateFactory.createForNode(scope, node.elements[i_1]);
                    s += typeof cExpr === 'string' ? cExpr : cExpr.resolve();
                }
                s += " }";
                scope.variables.push(new variable_1.CVariable(scope, varName, type, { initializer: s }));
            }
            else {
                if (type.isDynamicArray) {
                    varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                    if (!scope.root.memoryManager.variableWasReused(node))
                        scope.func.variables.push(new variable_1.CVariable(scope, varName, type, { initializer: "NULL" }));
                    scope.root.headerFlags.array = true;
                    scope.statements.push("ARRAY_CREATE(" + varName + ", " + Math.max(arrSize, 2) + ", " + arrSize + ");\n");
                    var gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                    if (gcVarName) {
                        scope.statements.push("ARRAY_PUSH(" + gcVarName + ", (void *)" + varName + ");\n");
                        scope.root.headerFlags.gc_iterator = true;
                        scope.root.headerFlags.array = true;
                    }
                }
                else {
                    varName = scope.root.symbolsHelper.addTemp(node, "tmp_array");
                    scope.variables.push(new variable_1.CVariable(scope, varName, type));
                }
                for (var i_2 = 0; i_2 < arrSize; i_2++) {
                    var assignment = new assignment_1.CAssignment(scope, varName, i_2 + "", type, node.elements[i_2]);
                    scope.statements.push(assignment);
                }
            }
            _this.expression = varName;
        }
        else
            _this.expression = "/* Unsupported use of array literal expression */";
        return _this;
    }
    CArrayLiteralExpression = __decorate([
        template_1.CodeTemplate("\n{#if universalWrapper}\n    js_var_from_array({expression})\n{#else}\n    {expression}\n{/if}", ts.SyntaxKind.ArrayLiteralExpression)
    ], CArrayLiteralExpression);
    return CArrayLiteralExpression;
}(template_1.CTemplateBase));
var CObjectLiteralExpression = /** @class */ (function (_super) {
    __extends(CObjectLiteralExpression, _super);
    function CObjectLiteralExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.expression = '';
        _this.universalWrapper = false;
        var type = scope.root.typeHelper.getCType(node);
        if (type === ctypes_1.UniversalVarType) {
            type = new ctypes_1.DictType(ctypes_1.UniversalVarType);
            _this.universalWrapper = true;
            scope.root.headerFlags.js_var_dict = true;
        }
        _this.isStruct = type instanceof ctypes_1.StructType;
        _this.isDict = type instanceof ctypes_1.DictType;
        if (_this.isStruct || _this.isDict) {
            var varName_1 = scope.root.memoryManager.getReservedTemporaryVarName(node);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.func.variables.push(new variable_1.CVariable(scope, varName_1, type, { initializer: "NULL" }));
            _this.allocator = new variable_1.CVariableAllocation(scope, varName_1, type, node);
            _this.initializers = node.properties
                .filter(function (p) { return p.kind == ts.SyntaxKind.PropertyAssignment; })
                .map(function (p) { return p; })
                .map(function (p) {
                var propName = (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text;
                return new assignment_1.CAssignment(scope, varName_1, _this.isDict ? '"' + propName + '"' : propName, type, p.initializer);
            });
            _this.expression = varName_1;
        }
        else
            _this.expression = "/* Unsupported use of object literal expression */";
        return _this;
    }
    CObjectLiteralExpression = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if isStruct || isDict}\n        {allocator}\n        {initializers}\n    {/if}\n{/statements}\n{#if universalWrapper}\n    js_var_from_dict({expression})\n{#else}\n    {expression}\n{/if}", ts.SyntaxKind.ObjectLiteralExpression)
    ], CObjectLiteralExpression);
    return CObjectLiteralExpression;
}(template_1.CTemplateBase));
exports.CObjectLiteralExpression = CObjectLiteralExpression;
var regexNames = {};
var CRegexLiteralExpression = /** @class */ (function (_super) {
    __extends(CRegexLiteralExpression, _super);
    function CRegexLiteralExpression(scope, node) {
        var _this = _super.call(this) || this;
        _this.expression = '';
        var template = node.text;
        if (!regexNames[template]) {
            regexNames[template] = scope.root.symbolsHelper.addTemp(null, "regex");
            scope.root.functions.splice(scope.parent ? -2 : -1, 0, new regexfunc_1.CRegexSearchFunction(scope, template, regexNames[template]));
        }
        _this.expression = regexNames[template];
        scope.root.headerFlags.regex = true;
        return _this;
    }
    CRegexLiteralExpression = __decorate([
        template_1.CodeTemplate("{expression}", ts.SyntaxKind.RegularExpressionLiteral)
    ], CRegexLiteralExpression);
    return CRegexLiteralExpression;
}(template_1.CTemplateBase));
var CString = /** @class */ (function (_super) {
    __extends(CString, _super);
    function CString(scope, nodeOrString) {
        var _this = _super.call(this) || this;
        _this.universalWrapper = false;
        var s = typeof nodeOrString === 'string' ? '"' + nodeOrString + '"' : nodeOrString.getText();
        s = s.replace(/\\u([A-Fa-f0-9]{4})/g, function (match, g1) { return String.fromCharCode(parseInt(g1, 16)); });
        if (s.indexOf("'") == 0)
            _this.value = '"' + s.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            _this.value = s;
        if (typeof (nodeOrString) !== "string" && scope.root.typeHelper.getCType(nodeOrString) == ctypes_1.UniversalVarType)
            _this.value = new typeconvert_1.CAsUniversalVar(scope, _this.value, ctypes_1.StringVarType);
        return _this;
    }
    CString = __decorate([
        template_1.CodeTemplate("{value}", ts.SyntaxKind.StringLiteral)
    ], CString);
    return CString;
}(template_1.CTemplateBase));
exports.CString = CString;
var CNumber = /** @class */ (function () {
    function CNumber(scope, node) {
        this.universalWrapper = false;
        this.value = node.getText();
        if (scope.root.typeHelper.getCType(node) == ctypes_1.UniversalVarType)
            this.value = new typeconvert_1.CAsUniversalVar(scope, this.value, ctypes_1.NumberVarType);
    }
    CNumber = __decorate([
        template_1.CodeTemplate("{value}", ts.SyntaxKind.NumericLiteral)
    ], CNumber);
    return CNumber;
}());
exports.CNumber = CNumber;
var CBoolean = /** @class */ (function (_super) {
    __extends(CBoolean, _super);
    function CBoolean(scope, node) {
        var _this = _super.call(this) || this;
        _this.value = node.kind == ts.SyntaxKind.TrueKeyword ? "TRUE" : "FALSE";
        scope.root.headerFlags.bool = true;
        if (scope.root.typeHelper.getCType(node) == ctypes_1.UniversalVarType)
            _this.value = new typeconvert_1.CAsUniversalVar(scope, _this.value, ctypes_1.BooleanVarType);
        return _this;
    }
    CBoolean = __decorate([
        template_1.CodeTemplate("{value}", [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword])
    ], CBoolean);
    return CBoolean;
}(template_1.CTemplateBase));
exports.CBoolean = CBoolean;
var CNull = /** @class */ (function (_super) {
    __extends(CNull, _super);
    function CNull(scope) {
        var _this = _super.call(this) || this;
        scope.root.headerFlags.js_var_from = true;
        return _this;
    }
    CNull = __decorate([
        template_1.CodeTemplate("js_var_from(JS_VAR_NULL)", ts.SyntaxKind.NullKeyword)
    ], CNull);
    return CNull;
}(template_1.CTemplateBase));
exports.CNull = CNull;
var CUndefined = /** @class */ (function (_super) {
    __extends(CUndefined, _super);
    function CUndefined(scope) {
        var _this = _super.call(this) || this;
        scope.root.headerFlags.js_var_from = true;
        return _this;
    }
    CUndefined = __decorate([
        template_1.CodeTemplate("js_var_from(JS_VAR_UNDEFINED)", ts.SyntaxKind.UndefinedKeyword)
    ], CUndefined);
    return CUndefined;
}(template_1.CTemplateBase));
exports.CUndefined = CUndefined;
var CNaN = /** @class */ (function (_super) {
    __extends(CNaN, _super);
    function CNaN(scope, node) {
        var _this = _super.call(this) || this;
        scope.root.headerFlags.js_var_from = true;
        return _this;
    }
    CNaN = __decorate([
        template_1.CodeTemplate("js_var_from(JS_VAR_NAN)", ts.SyntaxKind.Count + 1)
    ], CNaN);
    return CNaN;
}(template_1.CTemplateBase));
exports.CNaN = CNaN;
var CThis = /** @class */ (function (_super) {
    __extends(CThis, _super);
    function CThis(scope, node) {
        return _super.call(this) || this;
    }
    CThis = __decorate([
        template_1.CodeTemplate("this", ts.SyntaxKind.ThisKeyword)
    ], CThis);
    return CThis;
}(template_1.CTemplateBase));
exports.CThis = CThis;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":43,"../types/ctypes":44,"./assignment":2,"./regexfunc":8,"./typeconvert":10,"./variable":11}],8:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var template_1 = require("../template");
var literals_1 = require("./literals");
var regex_1 = require("../regex");
var CRegexSearchFunction = /** @class */ (function (_super) {
    __extends(CRegexSearchFunction, _super);
    function CRegexSearchFunction(scope, template, regexName, regexMachine) {
        if (regexMachine === void 0) { regexMachine = null; }
        var _this = _super.call(this) || this;
        _this.regexName = regexName;
        _this.stateBlocks = [];
        _this.groupNumber = 0;
        _this.templateString = new literals_1.CString(scope, template.replace(/\\/g, '\\\\').replace(/"/g, '\\"'));
        if (/\/[a-z]+$/.test(template))
            throw new Error("Flags not supported in regex literals yet (" + template + ").");
        regexMachine = regexMachine || regex_1.RegexBuilder.build(template.slice(1, -1));
        var max = function (arr, func) { return arr && arr.reduce(function (acc, t) { return Math.max(acc, func(t), 0); }, 0) || 0; };
        _this.groupNumber = max(regexMachine.states, function (s) { return max(s.transitions, function (t) { return max(t.startGroup, function (g) { return g; }); }); });
        _this.hasChars = regexMachine.states.filter(function (s) { return s && s.transitions.filter(function (c) { return typeof c.condition == "string" || regex_1.isRangeCondition(c.condition) || c.condition.tokens.length > 0; }); }).length > 0;
        for (var s = 0; s < regexMachine.states.length; s++) {
            if (regexMachine.states[s] == null || regexMachine.states[s].transitions.length == 0)
                continue;
            _this.stateBlocks.push(new CStateBlock(scope, s + "", regexMachine.states[s], _this.groupNumber));
        }
        _this.finals = regexMachine.states.length > 0 ? regexMachine.states.map(function (s, i) { return s.final ? i : -1; }).filter(function (f) { return f > -1; }).map(function (f) { return f + ""; }) : ["-1"];
        if (_this.groupNumber > 0)
            scope.root.headerFlags.malloc = true;
        scope.root.headerFlags.strings = true;
        scope.root.headerFlags.bool = true;
        return _this;
    }
    CRegexSearchFunction = __decorate([
        template_1.CodeTemplate("\nstruct regex_match_struct_t {regexName}_search(const char *str, int16_t capture) {\n    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;\n    struct regex_match_struct_t result;\n{#if hasChars}\n        char ch;\n{/if}\n{#if groupNumber}\n        int16_t started[{groupNumber}];\n        if (capture) {\n            result.matches = malloc({groupNumber} * sizeof(*result.matches));\n            assert(result.matches != NULL);\n            regex_clear_matches(&result, {groupNumber});\n            memset(started, 0, sizeof started);\n        }\n{/if}\n    for (iterator = 0; iterator < len; iterator++) {\n{#if hasChars}\n            ch = str[iterator];\n{/if}\n\n{stateBlocks}\n\n        if (next == -1) {\n            if ({finals { || }=> state == {this}})\n                break;\n            iterator = index;\n            index++;\n            state = 0;\n            end = -1;\n{#if groupNumber}\n                if (capture) {\n                    regex_clear_matches(&result, {groupNumber});\n                    memset(started, 0, sizeof started);\n                }\n{/if}\n        } else {\n            state = next;\n            next = -1;\n        }\n\n        if (iterator == len-1 && index < len-1 && {finals { && }=> state != {this}}) {\n            if (end > -1)\n                break;\n            iterator = index;\n            index++;\n            state = 0;\n{#if groupNumber}\n                if (capture) {\n                    regex_clear_matches(&result, {groupNumber});\n                    memset(started, 0, sizeof started);\n                }\n{/if}\n        }\n    }\n    if (end == -1 && {finals { && }=> state != {this}})\n        index = -1;\n    result.index = index;\n    result.end = end == -1 ? iterator : end;\n    result.matches_count = {groupNumber};\n    return result;\n}\nstruct regex_struct_t {regexName} = { {templateString}, {regexName}_search };\n")
    ], CRegexSearchFunction);
    return CRegexSearchFunction;
}(template_1.CTemplateBase));
exports.CRegexSearchFunction = CRegexSearchFunction;
var CStateBlock = /** @class */ (function (_super) {
    __extends(CStateBlock, _super);
    function CStateBlock(scope, stateNumber, state, groupNumber) {
        var _this = _super.call(this) || this;
        _this.stateNumber = stateNumber;
        _this.groupNumber = groupNumber;
        _this.conditions = [];
        _this.groupsToReset = [];
        _this.final = state.final;
        var allGroups = [];
        state.transitions.forEach(function (t) { return allGroups = allGroups.concat(t.startGroup || []).concat(t.endGroup || []); });
        for (var i = 0; i < groupNumber; i++)
            if (allGroups.indexOf(i + 1) == -1)
                _this.groupsToReset.push(i + "");
        for (var _i = 0, _a = state.transitions; _i < _a.length; _i++) {
            var tr = _a[_i];
            _this.conditions.push(new CharCondition(tr, groupNumber));
        }
        return _this;
    }
    CStateBlock = __decorate([
        template_1.CodeTemplate("\n        if (state == {stateNumber}) {\n{#if final}\n                end = iterator;\n{/if}\n{conditions {\n}=> {this}}\n{#if groupNumber && groupsToReset.length}\n                if (capture && next == -1) {\n                    {groupsToReset {\n                    }=> started[{this}] = 0;}\n                }\n{/if}\n        }\n")
    ], CStateBlock);
    return CStateBlock;
}(template_1.CTemplateBase));
var CharCondition = /** @class */ (function (_super) {
    __extends(CharCondition, _super);
    function CharCondition(tr, groupN) {
        var _this = _super.call(this) || this;
        _this.anyCharExcept = false;
        _this.anyChar = false;
        _this.charClass = false;
        _this.fixedConditions = '';
        if (tr.fixedStart)
            _this.fixedConditions = " && iterator == 0";
        else if (tr.fixedEnd)
            _this.fixedConditions = " && iterator == len - 1";
        if (typeof tr.condition === "string")
            _this.ch = tr.condition.replace('\\', '\\\\').replace("'", "\\'");
        else if (regex_1.isRangeCondition(tr.condition)) {
            _this.charClass = true;
            _this.chFrom = tr.condition.fromChar;
            _this.ch = tr.condition.toChar;
        }
        else if (tr.condition.tokens.length) {
            _this.anyCharExcept = true;
            _this.except = tr.condition.tokens.map(function (ch) { return ch.replace('\\', '\\\\').replace("'", "\\'"); });
        }
        else
            _this.anyChar = true;
        var groupCaptureCode = '';
        for (var _i = 0, _a = tr.startGroup || []; _i < _a.length; _i++) {
            var g = _a[_i];
            groupCaptureCode += " if (capture && (!started[" + (g - 1) + "] || iterator > result.matches[" + (g - 1) + "].end)) { started[" + (g - 1) + "] = 1; result.matches[" + (g - 1) + "].index = iterator; }";
        }
        for (var _b = 0, _c = tr.endGroup || []; _b < _c.length; _b++) {
            var g = _c[_b];
            groupCaptureCode += " if (capture && started[" + (g - 1) + "]) result.matches[" + (g - 1) + "].end = iterator + 1;";
        }
        _this.nextCode = "next = " + tr.next + ";";
        if (groupCaptureCode)
            _this.nextCode = "{ " + _this.nextCode + groupCaptureCode + " }";
        return _this;
    }
    CharCondition = __decorate([
        template_1.CodeTemplate("\n{#if anyCharExcept}\n                if (next == -1 && {except { && }=> ch != '{this}'}{fixedConditions}) {nextCode}\n{#elseif anyChar}\n                if (next == -1{fixedConditions}) {nextCode}\n{#elseif charClass}\n                if (ch >= '{chFrom}' && ch <= '{ch}'{fixedConditions}) {nextCode}\n{#else}\n                if (ch == '{ch}'{fixedConditions}) {nextCode}\n{/if}")
    ], CharCondition);
    return CharCondition;
}(template_1.CTemplateBase));
var CRegexAsString = /** @class */ (function (_super) {
    __extends(CRegexAsString, _super);
    function CRegexAsString(expression) {
        var _this = _super.call(this) || this;
        _this.expression = expression;
        return _this;
    }
    CRegexAsString = __decorate([
        template_1.CodeTemplate("{expression}.str")
    ], CRegexAsString);
    return CRegexAsString;
}(template_1.CTemplateBase));
exports.CRegexAsString = CRegexAsString;

},{"../regex":13,"../template":43,"./literals":7}],9:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../template");
var ctypes_1 = require("../types/ctypes");
var variable_1 = require("./variable");
var expressions_1 = require("./expressions");
var elementaccess_1 = require("./elementaccess");
var assignment_1 = require("./assignment");
var utils_1 = require("../types/utils");
var CLabeledStatement = /** @class */ (function (_super) {
    __extends(CLabeledStatement, _super);
    function CLabeledStatement(scope, node) {
        var _this = _super.call(this) || this;
        var nodes = utils_1.getAllNodesUnder(node);
        _this.breakLabel = nodes.some(function (n) { return ts.isBreakStatement(n) && n.label.text === node.label.text; })
            ? " " + node.label.text + "_break:"
            : "";
        var hasContinue = nodes.some(function (n) { return ts.isContinueStatement(n) && n.label.text === node.label.text; });
        if (hasContinue) {
            if (ts.isForStatement(node.statement))
                _this.statement = new CForStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isForOfStatement(node.statement))
                _this.statement = new CForOfStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isWhileStatement(node.statement))
                _this.statement = new CWhileStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isDoStatement(node.statement))
                _this.statement = new CDoWhileStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isForInStatement(node.statement))
                _this.statement = new CForInStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else
                _this.statement = "/* Unsupported labeled statement " + node.getText() + " */";
        }
        else
            _this.statement = template_1.CodeTemplateFactory.createForNode(scope, node.statement);
        return _this;
    }
    CLabeledStatement = __decorate([
        template_1.CodeTemplate("{statement}{breakLabel}", ts.SyntaxKind.LabeledStatement)
    ], CLabeledStatement);
    return CLabeledStatement;
}(template_1.CTemplateBase));
exports.CLabeledStatement = CLabeledStatement;
var CBreakStatement = /** @class */ (function (_super) {
    __extends(CBreakStatement, _super);
    function CBreakStatement(scope, node) {
        var _this = _super.call(this) || this;
        _this.label = node.label && node.label.text + "_break";
        return _this;
    }
    CBreakStatement = __decorate([
        template_1.CodeTemplate("\n{#if label}\n    goto {label};\n{#else}\n    break;\n{/if}\n", ts.SyntaxKind.BreakStatement)
    ], CBreakStatement);
    return CBreakStatement;
}(template_1.CTemplateBase));
exports.CBreakStatement = CBreakStatement;
var CContinueStatement = /** @class */ (function (_super) {
    __extends(CContinueStatement, _super);
    function CContinueStatement(scope, node) {
        var _this = _super.call(this) || this;
        _this.label = node.label && node.label.text + "_continue";
        return _this;
    }
    CContinueStatement = __decorate([
        template_1.CodeTemplate("\n{#if label}\n    goto {label};\n{#else}\n    continue;\n{/if}\n", ts.SyntaxKind.ContinueStatement)
    ], CContinueStatement);
    return CContinueStatement;
}(template_1.CTemplateBase));
exports.CContinueStatement = CContinueStatement;
var CEmptyStatement = /** @class */ (function () {
    function CEmptyStatement(scope, node) {
    }
    CEmptyStatement = __decorate([
        template_1.CodeTemplate(";\n", ts.SyntaxKind.EmptyStatement)
    ], CEmptyStatement);
    return CEmptyStatement;
}());
exports.CEmptyStatement = CEmptyStatement;
var CReturnStatement = /** @class */ (function (_super) {
    __extends(CReturnStatement, _super);
    function CReturnStatement(scope, node) {
        var _this = _super.call(this) || this;
        _this.retVarName = null;
        _this.closureParams = [];
        _this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        _this.destructors = new variable_1.CVariableDestructors(scope, node);
        return _this;
    }
    CReturnStatement = __decorate([
        template_1.CodeTemplate("\n{destructors}\nreturn {expression};\n", ts.SyntaxKind.ReturnStatement)
    ], CReturnStatement);
    return CReturnStatement;
}(template_1.CTemplateBase));
exports.CReturnStatement = CReturnStatement;
var CIfStatement = /** @class */ (function (_super) {
    __extends(CIfStatement, _super);
    function CIfStatement(scope, node) {
        var _this = _super.call(this) || this;
        _this.condition = new expressions_1.CCondition(scope, node.expression);
        _this.thenBlock = new CBlock(scope, node.thenStatement);
        _this.hasElseBlock = !!node.elseStatement;
        _this.elseBlock = _this.hasElseBlock && new CBlock(scope, node.elseStatement);
        return _this;
    }
    CIfStatement = __decorate([
        template_1.CodeTemplate("\nif ({condition})\n{thenBlock}\n{#if hasElseBlock}\n    else\n    {elseBlock}\n{/if}\n", ts.SyntaxKind.IfStatement)
    ], CIfStatement);
    return CIfStatement;
}(template_1.CTemplateBase));
exports.CIfStatement = CIfStatement;
var CSwitchStatement = /** @class */ (function (_super) {
    __extends(CSwitchStatement, _super);
    function CSwitchStatement(scope, node) {
        var _this = _super.call(this) || this;
        var exprType = scope.root.typeHelper.getCType(node.expression);
        _this.nonIntegral = exprType != ctypes_1.NumberVarType;
        _this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        _this.cases = node.caseBlock.clauses.map(function (clause, index) { return new CSwitchCaseClause(scope, clause, _this.nonIntegral ? index : null); });
        if (_this.nonIntegral) {
            var tempVarName = scope.root.symbolsHelper.addTemp(node, "tmp_switch");
            scope.variables.push(new variable_1.CVariable(scope, tempVarName, ctypes_1.NumberVarType));
            _this.values = node.caseBlock.clauses.filter(function (c) { return ts.isCaseClause(c); }).map(function (clause, index) { return new CSwitchCaseCompare(scope, _this.expression, clause, index); });
            _this.switch = tempVarName;
        }
        else
            _this.switch = _this.expression;
        return _this;
    }
    CSwitchStatement = __decorate([
        template_1.CodeTemplate("\n{#if nonIntegral}\n    {switch} = {values {\n        : }=> {this}}\n        : -1;\n{/if}\nswitch ({switch}) {\n    {cases {    }=> {this}\n}\n}\n", ts.SyntaxKind.SwitchStatement)
    ], CSwitchStatement);
    return CSwitchStatement;
}(template_1.CTemplateBase));
exports.CSwitchStatement = CSwitchStatement;
var CSwitchCaseClause = /** @class */ (function (_super) {
    __extends(CSwitchCaseClause, _super);
    function CSwitchCaseClause(scope, clause, index) {
        var _this = _super.call(this) || this;
        _this.variables = [];
        _this.statements = [];
        _this.parent = scope;
        _this.func = scope.func;
        _this.root = scope.root;
        _this.defaultClause = clause.kind === ts.SyntaxKind.DefaultClause;
        if (index != null)
            _this.value = "" + index;
        else if (ts.isCaseClause(clause))
            _this.value = template_1.CodeTemplateFactory.createForNode(scope, clause.expression);
        for (var _i = 0, _a = clause.statements; _i < _a.length; _i++) {
            var s = _a[_i];
            var statement = template_1.CodeTemplateFactory.createForNode(_this, s);
            _this.statements.push(statement);
        }
        return _this;
    }
    CSwitchCaseClause = __decorate([
        template_1.CodeTemplate("\n{#if !defaultClause}\n    case {value}:\n{#else}\n    default:\n{/if}\n        {statements {        }=> {this}}\n")
    ], CSwitchCaseClause);
    return CSwitchCaseClause;
}(template_1.CTemplateBase));
var CSwitchCaseCompare = /** @class */ (function (_super) {
    __extends(CSwitchCaseCompare, _super);
    function CSwitchCaseCompare(scope, expression, clause, index) {
        var _this = _super.call(this) || this;
        _this.expression = expression;
        _this.index = index;
        _this.value = template_1.CodeTemplateFactory.createForNode(scope, clause.expression);
        return _this;
    }
    CSwitchCaseCompare = __decorate([
        template_1.CodeTemplate("!strcmp({expression}, {value}) ? {index}")
    ], CSwitchCaseCompare);
    return CSwitchCaseCompare;
}(template_1.CTemplateBase));
var CWhileStatement = /** @class */ (function (_super) {
    __extends(CWhileStatement, _super);
    function CWhileStatement(scope, node, continueLabel) {
        var _this = _super.call(this) || this;
        _this.continueLabel = continueLabel;
        _this.variables = [];
        _this.statements = [];
        _this.block = new CBlock(scope, node.statement);
        _this.variables = _this.block.variables;
        _this.statements = _this.block.statements;
        _this.condition = new expressions_1.CCondition(scope, node.expression);
        return _this;
    }
    CWhileStatement = __decorate([
        template_1.CodeTemplate("\n{#if continueLabel}\n    while({condition}) {\n        {variables {    }=> {this};\n}\n        {statements {    }=> {this}}\n        {continueLabel}: ;\n    }\n{#else}\n    while ({condition})\n    {block}\n{/if}", ts.SyntaxKind.WhileStatement)
    ], CWhileStatement);
    return CWhileStatement;
}(template_1.CTemplateBase));
exports.CWhileStatement = CWhileStatement;
var CDoWhileStatement = /** @class */ (function (_super) {
    __extends(CDoWhileStatement, _super);
    function CDoWhileStatement(scope, node, continueLabel) {
        var _this = _super.call(this) || this;
        _this.continueLabel = continueLabel;
        _this.variables = [];
        _this.statements = [];
        _this.block = new CBlock(scope, node.statement);
        _this.variables = _this.block.variables;
        _this.statements = _this.block.statements;
        _this.condition = new expressions_1.CCondition(scope, node.expression);
        return _this;
    }
    CDoWhileStatement = __decorate([
        template_1.CodeTemplate("\n{#if continueLabel}\n    do {\n        {variables {    }=> {this};\n}\n        {statements {    }=> {this}}\n        {continueLabel}: ;\n    } while ({condition});\n{#else}\n    do\n    {block}\n    while ({condition});\n{/if}", ts.SyntaxKind.DoStatement)
    ], CDoWhileStatement);
    return CDoWhileStatement;
}(template_1.CTemplateBase));
exports.CDoWhileStatement = CDoWhileStatement;
var CForStatement = /** @class */ (function (_super) {
    __extends(CForStatement, _super);
    function CForStatement(scope, node, continueLabel) {
        var _this = _super.call(this) || this;
        _this.continueLabel = continueLabel;
        _this.variables = [];
        _this.statements = [];
        _this.varDecl = null;
        _this.block = new CBlock(scope, node.statement);
        _this.variables = _this.block.variables;
        _this.statements = _this.block.statements;
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            var declList = node.initializer;
            _this.varDecl = new variable_1.CVariableDeclaration(scope, declList.declarations[0]);
            _this.init = "";
        }
        else
            _this.init = template_1.CodeTemplateFactory.createForNode(scope, node.initializer);
        _this.condition = new expressions_1.CCondition(scope, node.condition);
        _this.increment = node.incrementor ? template_1.CodeTemplateFactory.createForNode(scope, node.incrementor) : "";
        return _this;
    }
    CForStatement = __decorate([
        template_1.CodeTemplate("\n{#if varDecl}\n    {varDecl}\n{/if}\n{#if continueLabel}\n    {init};\n    while({condition}) {\n        {variables {    }=> {this};\n}\n        {statements {    }=> {this}}\n        {continueLabel}:\n        {increment};\n    }\n{#else}\n    for ({init};{condition};{increment})\n    {block}\n{/if}", ts.SyntaxKind.ForStatement)
    ], CForStatement);
    return CForStatement;
}(template_1.CTemplateBase));
exports.CForStatement = CForStatement;
var CForOfStatement = /** @class */ (function (_super) {
    __extends(CForOfStatement, _super);
    function CForOfStatement(scope, node, continueLabel) {
        var _this = _super.call(this) || this;
        _this.continueLabel = continueLabel;
        _this.variables = [];
        _this.statements = [];
        _this.cast = "";
        _this.parent = scope;
        _this.func = scope.func;
        _this.root = scope.root;
        _this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
        var arrType = scope.root.typeHelper.getCType(node.expression);
        var varAccess = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        _this.elementAccess = new elementaccess_1.CSimpleElementAccess(scope, arrType, varAccess, _this.iteratorVarName);
        _this.arraySize = new elementaccess_1.CArraySize(scope, varAccess, arrType);
        if (arrType && arrType instanceof ctypes_1.ArrayType && arrType.elementType instanceof ctypes_1.ArrayType && arrType.elementType.isDynamicArray)
            _this.cast = "(void *)";
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            var declInit = node.initializer.declarations[0];
            scope.variables.push(new variable_1.CVariable(scope, declInit.name.getText(), declInit.name));
            _this.init = declInit.name.getText();
        }
        else
            _this.init = new elementaccess_1.CElementAccess(scope, node.initializer);
        _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, node.statement));
        scope.variables = scope.variables.concat(_this.variables);
        _this.variables = [];
        return _this;
    }
    CForOfStatement = __decorate([
        template_1.CodeTemplate("\n{#if continueLabel}\n    {iteratorVarName} = 0;\n    while ({iteratorVarName} < {arraySize}) {\n        {variables {    }=> {this};\n}\n        {init} = {cast}{elementAccess};\n    {statements {    }=> {this}}\n        {continueLabel}:\n        {iteratorVarName}++;\n    }\n{#else}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)\n    {\n        {variables {    }=> {this};\n}\n        {init} = {cast}{elementAccess};\n        {statements {    }=> {this}}\n    }\n{/if}\n", ts.SyntaxKind.ForOfStatement)
    ], CForOfStatement);
    return CForOfStatement;
}(template_1.CTemplateBase));
exports.CForOfStatement = CForOfStatement;
var CForInStatement = /** @class */ (function (_super) {
    __extends(CForInStatement, _super);
    function CForInStatement(scope, node, continueLabel) {
        var _this = _super.call(this) || this;
        _this.continueLabel = continueLabel;
        _this.variables = [];
        _this.statements = [];
        _this.parent = scope;
        _this.func = scope.func;
        _this.root = scope.root;
        _this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
        _this.varAccess = new elementaccess_1.CElementAccess(scope, node.expression);
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            var declInit = node.initializer.declarations[0];
            scope.variables.push(new variable_1.CVariable(scope, declInit.name.getText(), declInit.name));
            _this.init = declInit.name.getText();
        }
        else
            _this.init = new elementaccess_1.CElementAccess(scope, node.initializer);
        if (node.statement.kind == ts.SyntaxKind.Block) {
            var block = node.statement;
            for (var _i = 0, _a = block.statements; _i < _a.length; _i++) {
                var s = _a[_i];
                _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, s));
            }
        }
        else
            _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, node.statement));
        scope.variables = scope.variables.concat(_this.variables);
        _this.variables = [];
        return _this;
    }
    CForInStatement = __decorate([
        template_1.CodeTemplate("\n{#if continueLabel}\n    {iteratorVarName} = 0;\n    while ({iteratorVarName} < {varAccess}->index->size) {\n        {variables {    }=> {this};\n}\n        {init} = {varAccess}->index->data[{iteratorVarName}];\n        {statements {    }=> {this}}\n        {continueLabel}:\n        {iteratorVarName}++;\n    }\n{#else}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->index->size; {iteratorVarName}++)\n    {\n        {variables {    }=> {this};\n}\n        {init} = {varAccess}->index->data[{iteratorVarName}];\n        {statements {    }=> {this}}\n    }\n{/if}\n", ts.SyntaxKind.ForInStatement)
    ], CForInStatement);
    return CForInStatement;
}(template_1.CTemplateBase));
exports.CForInStatement = CForInStatement;
var CExpressionStatement = /** @class */ (function (_super) {
    __extends(CExpressionStatement, _super);
    function CExpressionStatement(scope, node) {
        var _this = _super.call(this) || this;
        _this.SemicolonCR = ';\n';
        if (node.expression.kind == ts.SyntaxKind.BinaryExpression) {
            var binExpr = node.expression;
            if (binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                _this.expression = assignment_1.AssignmentHelper.create(scope, binExpr.left, binExpr.right);
                ;
                _this.SemicolonCR = '';
            }
        }
        if (!_this.expression)
            _this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        return _this;
    }
    CExpressionStatement = __decorate([
        template_1.CodeTemplate("{expression}{SemicolonCR}", ts.SyntaxKind.ExpressionStatement)
    ], CExpressionStatement);
    return CExpressionStatement;
}(template_1.CTemplateBase));
exports.CExpressionStatement = CExpressionStatement;
var CBlock = /** @class */ (function (_super) {
    __extends(CBlock, _super);
    function CBlock(scope, node) {
        var _this = _super.call(this) || this;
        _this.variables = [];
        _this.statements = [];
        _this.parent = scope;
        _this.func = scope.func;
        _this.root = scope.root;
        if (ts.isBlock(node)) {
            node.statements.forEach(function (s) { return _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, s)); });
        }
        else
            _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, node));
        return _this;
    }
    CBlock = __decorate([
        template_1.CodeTemplate("\n{#if statements.length > 1 || variables.length > 0}\n    {\n        {variables {    }=> {this};\n}\n        {statements {    }=> {this}}\n    }\n{/if}\n{#if statements.length == 1 && variables.length == 0}\n        {statements}\n{/if}\n{#if statements.length == 0 && variables.length == 0}\n        /* no statements */;\n{/if}", ts.SyntaxKind.Block)
    ], CBlock);
    return CBlock;
}(template_1.CTemplateBase));
exports.CBlock = CBlock;
var CImport = /** @class */ (function (_super) {
    __extends(CImport, _super);
    function CImport(scope, node) {
        var _this = _super.call(this) || this;
        var moduleName = node.moduleSpecifier.text;
        _this.externalInclude = moduleName.indexOf('ts2c-target') == 0;
        if (_this.externalInclude) {
            moduleName = moduleName.split('/').slice(1).join('/');
            if (moduleName.slice(-6) == "/index")
                moduleName = moduleName.slice(0, -6);
            if (scope.root.includes.indexOf(moduleName) == -1)
                scope.root.includes.push(moduleName);
        }
        _this.nodeText = node.getText();
        return _this;
    }
    CImport = __decorate([
        template_1.CodeTemplate("", ts.SyntaxKind.ImportDeclaration)
    ], CImport);
    return CImport;
}(template_1.CTemplateBase));
exports.CImport = CImport;
var CTryStatement = /** @class */ (function (_super) {
    __extends(CTryStatement, _super);
    function CTryStatement(scope, node) {
        var _this = _super.call(this) || this;
        _this.tryBlock = new CBlock(scope, node.tryBlock);
        _this.catchBlock = node.catchClause ? new CBlock(scope, node.catchClause.block) : "";
        _this.finallyBlock = node.finallyBlock ? new CBlock(scope, node.finallyBlock) : "";
        _this.catchVarName = node.catchClause && node.catchClause.variableDeclaration && node.catchClause.variableDeclaration.name.getText();
        if (_this.catchVarName)
            scope.variables.push(new variable_1.CVariable(scope, _this.catchVarName, ctypes_1.StringVarType));
        scope.root.headerFlags.try_catch = true;
        return _this;
    }
    CTryStatement = __decorate([
        template_1.CodeTemplate("\nTRY\n{tryBlock}\nCATCH\n{#if catchVarName}\n        {catchVarName} = err_defs->data[err_val - 1];\n{/if}\n{catchBlock}\n{finallyBlock}\nEND_TRY\n", ts.SyntaxKind.TryStatement)
    ], CTryStatement);
    return CTryStatement;
}(template_1.CTemplateBase));
exports.CTryStatement = CTryStatement;
var CThrowStatement = /** @class */ (function (_super) {
    __extends(CThrowStatement, _super);
    function CThrowStatement(scope, node) {
        var _this = _super.call(this) || this;
        _this.value = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        scope.root.headerFlags.try_catch = true;
        return _this;
    }
    CThrowStatement = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    ARRAY_PUSH(err_defs, {value});\n{/statements}\nTHROW(err_defs->size);\n", ts.SyntaxKind.ThrowStatement)
    ], CThrowStatement);
    return CThrowStatement;
}(template_1.CTemplateBase));
exports.CThrowStatement = CThrowStatement;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":43,"../types/ctypes":44,"../types/utils":49,"./assignment":2,"./elementaccess":4,"./expressions":5,"./variable":11}],10:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var ctypes_1 = require("../types/ctypes");
var template_1 = require("../template");
var utils_1 = require("../types/utils");
var elementaccess_1 = require("./elementaccess");
var variable_1 = require("./variable");
var CAsUniversalVar = /** @class */ (function (_super) {
    __extends(CAsUniversalVar, _super);
    function CAsUniversalVar(scope, expr, type) {
        var _this = _super.call(this) || this;
        _this.expression = utils_1.isNode(expr) ? template_1.CodeTemplateFactory.createForNode(scope, expr) : expr;
        type = type || utils_1.isNode(expr) && scope.root.typeHelper.getCType(expr);
        _this.isUniversalVar = type === ctypes_1.UniversalVarType;
        _this.isString = type === ctypes_1.StringVarType;
        _this.isNumber = type === ctypes_1.NumberVarType;
        _this.isBoolean = type === ctypes_1.BooleanVarType;
        _this.isArray = type instanceof ctypes_1.ArrayType;
        _this.isDict = type instanceof ctypes_1.StructType || type instanceof ctypes_1.DictType;
        if (type === ctypes_1.StringVarType)
            scope.root.headerFlags.js_var_from_str = true;
        if (type === ctypes_1.NumberVarType)
            scope.root.headerFlags.js_var_from_int16_t = true;
        if (type === ctypes_1.BooleanVarType)
            scope.root.headerFlags.js_var_from_uint8_t = true;
        if (type instanceof ctypes_1.ArrayType)
            scope.root.headerFlags.js_var_array = true;
        if (type instanceof ctypes_1.StructType || type instanceof ctypes_1.DictType)
            scope.root.headerFlags.js_var_dict = true;
        scope.root.headerFlags.js_var = true;
        return _this;
    }
    CAsUniversalVar = __decorate([
        template_1.CodeTemplate("\n{#if isUniversalVar}\n    {expression}\n{#elseif isString}\n    js_var_from_str({expression})\n{#elseif isNumber}\n    js_var_from_int16_t({expression})\n{#elseif isBoolean}\n    js_var_from_uint8_t({expression})\n{#elseif isArray}\n    js_var_from_array({expression})\n{#elseif isDict}\n    js_var_from_dict({expression})\n{#else}\n    /** converting {expression} to js_var is not supported yet */\n{/if}")
    ], CAsUniversalVar);
    return CAsUniversalVar;
}(template_1.CTemplateBase));
exports.CAsUniversalVar = CAsUniversalVar;
var CAsNumber = /** @class */ (function (_super) {
    __extends(CAsNumber, _super);
    function CAsNumber(scope, expr, type) {
        var _this = _super.call(this) || this;
        _this.type = type;
        _this.isSingleElementStaticArray = false;
        _this.expression = utils_1.isNode(expr) ? template_1.CodeTemplateFactory.createForNode(scope, expr) : expr;
        type = type || utils_1.isNode(expr) && scope.root.typeHelper.getCType(expr);
        _this.isNumber = type === ctypes_1.NumberVarType;
        _this.isString = type === ctypes_1.StringVarType;
        _this.isBoolean = type === ctypes_1.BooleanVarType;
        _this.isUniversalVar = type === ctypes_1.UniversalVarType;
        if (type instanceof ctypes_1.ArrayType && !type.isDynamicArray && type.capacity === 1) {
            _this.isSingleElementStaticArray = true;
            _this.arrayFirstElementAsNumber = new CAsNumber_1(scope, new elementaccess_1.CSimpleElementAccess(scope, type, _this.expression, "0"), type.elementType);
        }
        if (_this.isString)
            scope.root.headerFlags.str_to_int16_t = true;
        if (_this.isUniversalVar)
            scope.root.headerFlags.js_var_to_number = true;
        if (!_this.isNumber && !_this.isBoolean && !_this.isString && !_this.isUniversalVar && !_this.isSingleElementStaticArray)
            scope.root.headerFlags.js_var_from = true;
        return _this;
    }
    CAsNumber_1 = CAsNumber;
    CAsNumber = CAsNumber_1 = __decorate([
        template_1.CodeTemplate("\n{#if isNumber || isBoolean}\n    {expression}\n{#elseif isString}\n    str_to_int16_t({expression})\n{#elseif isUniversalVar}\n    js_var_to_number({expression})\n{#elseif isSingleElementStaticArray}\n    {arrayFirstElementAsNumber}\n{#else}\n    js_var_from(JS_VAR_NAN)\n{/if}")
    ], CAsNumber);
    return CAsNumber;
    var CAsNumber_1;
}(template_1.CTemplateBase));
exports.CAsNumber = CAsNumber;
var CAsString = /** @class */ (function (_super) {
    __extends(CAsString, _super);
    function CAsString(scope, node) {
        var _this = _super.call(this) || this;
        var type = scope.root.typeHelper.getCType(node);
        _this.arg = template_1.CodeTemplateFactory.createForNode(scope, node);
        _this.isNumberLiteral = ts.isNumericLiteral(node);
        _this.isNumber = !_this.isNumberLiteral && type === ctypes_1.NumberVarType;
        _this.isString = type === ctypes_1.StringVarType;
        _this.isBoolean = type === ctypes_1.BooleanVarType;
        _this.isUniversalVar = type === ctypes_1.UniversalVarType;
        _this.isArray = type instanceof ctypes_1.ArrayType;
        if (_this.isNumber || _this.isArray || _this.isUniversalVar) {
            _this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "buf");
            scope.variables.push(new variable_1.CVariable(scope, _this.tmpVarName, "char *"));
            scope.root.headerFlags.gc_iterator = true;
        }
        if (_this.isNumber)
            scope.root.headerFlags.str_int16_t_buflen = true;
        if (type instanceof ctypes_1.ArrayType) {
            _this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
            scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
            var arrayElement = new elementaccess_1.CSimpleElementAccess(scope, type, _this.arg, _this.iteratorVarName);
            _this.arrayElementCat = new CAsString_Concat(scope, node, _this.tmpVarName, arrayElement, type.elementType);
            _this.arraySize = new elementaccess_1.CArraySize(scope, _this.arg, type);
            _this.arrayStrLen = new CAsString_Length(scope, node, _this.arg, type);
        }
        return _this;
    }
    CAsString = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if isNumber}\n        {tmpVarName} = malloc(STR_INT16_T_BUFLEN);\n        assert({tmpVarName} != NULL);\n        sprintf({tmpVarName}, \"%d\", {arg});\n        ARRAY_PUSH(gc_main, (void *){tmpVarName});\n    {#elseif isUniversalVar}\n        {tmpVarName} = js_var_to_str({arg}, &{needDisposeVarName});\n        if ({needDisposeVarName})\n            ARRAY_PUSH(gc_main, (void *){tmpVarName});\n    {#elseif isArray}\n        {tmpVarName} = malloc({arrayStrLen});\n        assert({tmpVarName} != NULL);\n        {tmpVarName}[0] = '\\0';\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n            if ({iteratorVarName} != 0)\n                strcat({tmpVarName}, \",\");\n            {arrayElementCat}\n        }\n        ARRAY_PUSH(gc_main, (void *){tmpVarName});\n    {/if}\n{/statements}\n{#if isNumberLiteral}\n    \"{arg}\"\n{#elseif isString}\n    {arg}\n{#elseif isBoolean}\n    ({arg} ? \"true\" : \"false\")\n{#elseif isUniversalVar || isArray || isNumber}\n    {tmpVarName}\n{#else}\n    \"[object Object]\"\n{/if}")
    ], CAsString);
    return CAsString;
}(template_1.CTemplateBase));
exports.CAsString = CAsString;
var CAsString_Length = /** @class */ (function (_super) {
    __extends(CAsString_Length, _super);
    function CAsString_Length(scope, node, arg, type) {
        var _this = _super.call(this) || this;
        _this.arg = arg;
        _this.type = type;
        _this.isNumber = type === ctypes_1.NumberVarType;
        _this.isString = type === ctypes_1.StringVarType;
        _this.isBoolean = type === ctypes_1.BooleanVarType;
        _this.isArrayOfString = type instanceof ctypes_1.ArrayType && type.elementType === ctypes_1.StringVarType;
        _this.isArrayOfNumber = type instanceof ctypes_1.ArrayType && type.elementType === ctypes_1.NumberVarType;
        _this.isArrayOfBoolean = type instanceof ctypes_1.ArrayType && type.elementType === ctypes_1.BooleanVarType;
        _this.isArrayOfUniversalVar = type instanceof ctypes_1.ArrayType && type.elementType === ctypes_1.UniversalVarType;
        _this.isArrayOfArray = type instanceof ctypes_1.ArrayType && type.elementType instanceof Array;
        _this.isArrayOfObj = type instanceof ctypes_1.ArrayType && (type.elementType instanceof ctypes_1.DictType || type.elementType instanceof ctypes_1.StructType);
        _this.arraySize = type instanceof ctypes_1.ArrayType && new elementaccess_1.CArraySize(scope, arg, type);
        if (_this.isArrayOfString || _this.isArrayOfUniversalVar) {
            _this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
            scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
            _this.arrayElement = new elementaccess_1.CSimpleElementAccess(scope, type, arg, _this.iteratorVarName);
            _this.lengthVarName = scope.root.symbolsHelper.addTemp(node, "len");
            scope.variables.push(new variable_1.CVariable(scope, _this.lengthVarName, ctypes_1.NumberVarType));
            scope.root.headerFlags.strings = true;
        }
        if (_this.isArrayOfUniversalVar) {
            _this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "tmp", false);
            _this.needDisposeVarName = scope.root.symbolsHelper.addTemp(node, "need_dispose", false);
            if (!scope.variables.some(function (v) { return v.name == _this.tmpVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, _this.tmpVarName, ctypes_1.StringVarType));
            if (!scope.variables.some(function (v) { return v.name == _this.needDisposeVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, _this.needDisposeVarName, ctypes_1.BooleanVarType));
            scope.root.headerFlags.js_var_to_str = true;
        }
        return _this;
    }
    CAsString_Length = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if isArrayOfString}\n        {lengthVarName} = {arraySize};\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)\n            {lengthVarName} += strlen({arrayElement});\n    {#elseif isArrayOfUniversalVar}\n        {lengthVarName} = {arraySize};\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n            {lengthVarName} += strlen({tmpVarName} = js_var_to_str({arrayElement}, &{needDisposeVarName}));\n            if ({needDisposeVarName})\n                free((void *){tmpVarName});\n        }\n    {/if}\n{/statements}\n{#if isNumber}\n    STR_INT16_T_BUFLEN\n{#elseif isString}\n    strlen({arg})\n{#elseif isBoolean}\n    (5-{arg})\n{#elseif isArrayOfNumber}\n    (STR_INT16_T_BUFLEN + 1) * {arraySize}\n{#elseif isArrayOfBoolean}\n    6 * {arraySize}\n{#elseif isArrayOfObj}\n    16 * {arraySize}\n{#elseif isArrayOfString || isArrayOfUniversalVar}\n    {lengthVarName}\n{#elseif isArrayOfArray}\n    /* determining string length of array {arg} is not supported yet */\n{#else}\n    15\n{/if}")
    ], CAsString_Length);
    return CAsString_Length;
}(template_1.CTemplateBase));
exports.CAsString_Length = CAsString_Length;
var CAsString_Concat = /** @class */ (function (_super) {
    __extends(CAsString_Concat, _super);
    function CAsString_Concat(scope, node, buf, arg, type) {
        var _this = _super.call(this) || this;
        _this.buf = buf;
        _this.arg = arg;
        _this.type = type;
        _this.isArray = false;
        _this.isNumber = type === ctypes_1.NumberVarType;
        _this.isString = type === ctypes_1.StringVarType;
        _this.isBoolean = type === ctypes_1.BooleanVarType;
        _this.isUniversalVar = type === ctypes_1.UniversalVarType;
        if (_this.isNumber)
            scope.root.headerFlags.str_int16_t_cat = true;
        if (_this.isUniversalVar) {
            _this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "tmp", false);
            _this.needDisposeVarName = scope.root.symbolsHelper.addTemp(node, "need_dispose", false);
            if (!scope.variables.some(function (v) { return v.name == _this.tmpVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, _this.tmpVarName, ctypes_1.StringVarType));
            if (!scope.variables.some(function (v) { return v.name == _this.needDisposeVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, _this.needDisposeVarName, ctypes_1.BooleanVarType));
            scope.root.headerFlags.js_var_to_str = true;
        }
        if (type instanceof ctypes_1.ArrayType) {
            _this.isArray = true;
            _this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
            scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
            var arrayElement = new elementaccess_1.CSimpleElementAccess(scope, type, arg, _this.iteratorVarName);
            _this.arrayElementCat = new CAsString_Concat_1(scope, node, buf, arrayElement, type.elementType);
            _this.arraySize = new elementaccess_1.CArraySize(scope, arg, type);
        }
        return _this;
    }
    CAsString_Concat_1 = CAsString_Concat;
    CAsString_Concat = CAsString_Concat_1 = __decorate([
        template_1.CodeTemplate("\n{#if isNumber}\n    str_int16_t_cat({buf}, {arg});\n{#elseif isString}\n    strcat({buf}, {arg});\n{#elseif isBoolean}\n    strcat({buf}, {arg} ? \"true\" : \"false\");\n{#elseif isUniversalVar}\n    strcat({buf}, ({tmpVarName} = js_var_to_str({arg}, &{needDisposeVarName})));\n    if ({needDisposeVarName})\n        free((void *){tmpVarName});\n{#elseif isArray}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n        if ({iteratorVarName} != 0)\n            strcat({buf}, \",\");\n        {arrayElementCat}\n    }\n{#else}\n    strcat({buf}, \"[object Object]\");\n{/if}\n")
    ], CAsString_Concat);
    return CAsString_Concat;
    var CAsString_Concat_1;
}(template_1.CTemplateBase));
exports.CAsString_Concat = CAsString_Concat;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":43,"../types/ctypes":44,"../types/utils":49,"./elementaccess":4,"./variable":11}],11:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../template");
var ctypes_1 = require("../types/ctypes");
var assignment_1 = require("./assignment");
var utils_1 = require("../types/utils");
var CVariableStatement = /** @class */ (function (_super) {
    __extends(CVariableStatement, _super);
    function CVariableStatement(scope, node) {
        var _this = _super.call(this) || this;
        _this.declarations = node.declarationList.declarations.map(function (d) { return template_1.CodeTemplateFactory.createForNode(scope, d); });
        return _this;
    }
    CVariableStatement = __decorate([
        template_1.CodeTemplate("{declarations}", ts.SyntaxKind.VariableStatement)
    ], CVariableStatement);
    return CVariableStatement;
}(template_1.CTemplateBase));
exports.CVariableStatement = CVariableStatement;
var CVariableDeclarationList = /** @class */ (function (_super) {
    __extends(CVariableDeclarationList, _super);
    function CVariableDeclarationList(scope, node) {
        var _this = _super.call(this) || this;
        _this.declarations = node.declarations.map(function (d) { return template_1.CodeTemplateFactory.createForNode(scope, d); });
        return _this;
    }
    CVariableDeclarationList = __decorate([
        template_1.CodeTemplate("{declarations}", ts.SyntaxKind.VariableDeclarationList)
    ], CVariableDeclarationList);
    return CVariableDeclarationList;
}(template_1.CTemplateBase));
exports.CVariableDeclarationList = CVariableDeclarationList;
var CVariableDeclaration = /** @class */ (function (_super) {
    __extends(CVariableDeclaration, _super);
    function CVariableDeclaration(scope, varDecl) {
        var _this = _super.call(this) || this;
        _this.allocator = '';
        _this.initializer = '';
        var name = varDecl.name.getText();
        var type = scope.root.typeHelper.getCType(varDecl.name);
        var scopeVar = scope.root.typeHelper.isScopeVariableDeclaration(varDecl);
        if (type instanceof ctypes_1.ArrayType && !type.isDynamicArray && ts.isArrayLiteralExpression(varDecl.initializer) && !scopeVar) {
            var canUseInitializerList = varDecl.initializer.elements.every(function (e) { return e.kind == ts.SyntaxKind.NumericLiteral || e.kind == ts.SyntaxKind.StringLiteral; });
            if (canUseInitializerList) {
                var s = "{ ";
                for (var i_1 = 0; i_1 < type.capacity; i_1++) {
                    if (i_1 != 0)
                        s += ", ";
                    var cExpr = template_1.CodeTemplateFactory.createForNode(scope, varDecl.initializer.elements[i_1]);
                    s += typeof cExpr === 'string' ? cExpr : cExpr.resolve();
                }
                s += " }";
                scope.variables.push(new CVariable(scope, name, type, { initializer: s }));
                return _this;
            }
        }
        if (!scope.variables.some(function (v) { return v.name === name; }) && !scopeVar)
            scope.variables.push(new CVariable(scope, name, type));
        if (varDecl.initializer)
            _this.initializer = assignment_1.AssignmentHelper.create(scope, varDecl.name, varDecl.initializer);
        return _this;
    }
    CVariableDeclaration = __decorate([
        template_1.CodeTemplate("{initializer}", ts.SyntaxKind.VariableDeclaration)
    ], CVariableDeclaration);
    return CVariableDeclaration;
}(template_1.CTemplateBase));
exports.CVariableDeclaration = CVariableDeclaration;
var CVariableAllocation = /** @class */ (function (_super) {
    __extends(CVariableAllocation, _super);
    function CVariableAllocation(scope, varName, varType, refNode) {
        var _this = _super.call(this) || this;
        _this.varName = varName;
        _this.needAllocateArray = varType instanceof ctypes_1.ArrayType && varType.isDynamicArray;
        _this.needAllocateStruct = varType instanceof ctypes_1.StructType || varType instanceof ctypes_1.FuncType && varType.needsClosureStruct;
        _this.needAllocateDict = varType instanceof ctypes_1.DictType;
        _this.initialCapacity = 4;
        _this.gcVarName = scope.root.memoryManager.getGCVariableForNode(refNode);
        if (varType instanceof ctypes_1.ArrayType) {
            _this.initialCapacity = Math.max(varType.capacity * 2, 4);
            _this.size = varType.capacity;
        }
        if (_this.needAllocateStruct || _this.needAllocateArray || _this.needAllocateDict)
            scope.root.headerFlags.malloc = true;
        if (_this.gcVarName || _this.needAllocateArray)
            scope.root.headerFlags.array = true;
        if (varType instanceof ctypes_1.ArrayType && varType.elementType == ctypes_1.UniversalVarType)
            scope.root.headerFlags.js_var_array = true;
        if (varType instanceof ctypes_1.DictType && varType.elementType == ctypes_1.UniversalVarType)
            scope.root.headerFlags.js_var_dict = true;
        else if (_this.needAllocateDict)
            scope.root.headerFlags.dict = true;
        if (_this.gcVarName)
            scope.root.headerFlags.gc_iterator = true;
        return _this;
    }
    CVariableAllocation = __decorate([
        template_1.CodeTemplate("\n{#if needAllocateArray}\n    ARRAY_CREATE({varName}, {initialCapacity}, {size});\n{#elseif needAllocateDict}\n    DICT_CREATE({varName}, {initialCapacity});\n{#elseif needAllocateStruct}\n    {varName} = malloc(sizeof(*{varName}));\n    assert({varName} != NULL);\n{/if}\n{#if gcVarName && (needAllocateStruct || needAllocateArray || needAllocateDict)}\n    ARRAY_PUSH({gcVarName}, (void *){varName});\n{/if}\n")
    ], CVariableAllocation);
    return CVariableAllocation;
}(template_1.CTemplateBase));
exports.CVariableAllocation = CVariableAllocation;
var CVariableDestructors = /** @class */ (function (_super) {
    __extends(CVariableDestructors, _super);
    function CVariableDestructors(scope, node) {
        var _this = _super.call(this) || this;
        _this.gcVarName = null;
        _this.gcArraysVarName = null;
        _this.gcArraysCVarName = null;
        _this.gcDictsVarName = null;
        _this.arrayDestructors = [];
        var gcVarNames = scope.root.memoryManager.getGCVariablesForScope(node);
        for (var _i = 0, gcVarNames_1 = gcVarNames; _i < gcVarNames_1.length; _i++) {
            var gc = gcVarNames_1[_i];
            if (gc.indexOf("_arrays_c") > -1)
                _this.gcArraysCVarName = gc;
            else if (gc.indexOf("_dicts") > -1)
                _this.gcDictsVarName = gc;
            else if (gc.indexOf("_arrays") > -1)
                _this.gcArraysVarName = gc;
            else
                _this.gcVarName = gc;
        }
        _this.destructors = [];
        scope.root.memoryManager.getDestructorsForScope(node)
            .forEach(function (r) {
            if (r.array) {
                _this.destructors.push(r.varName + "->data");
                _this.destructors.push(r.varName);
            }
            else if (r.arrayWithContents) {
                scope.root.headerFlags.gc_iterator2 = true;
                _this.arrayDestructors.push(r.varName);
                _this.destructors.push(r.varName + " ? " + r.varName + "->data : NULL");
                _this.destructors.push(r.varName);
            }
            else if (r.dict) {
                _this.destructors.push(r.varName + "->index->data");
                _this.destructors.push(r.varName + "->index");
                _this.destructors.push(r.varName + "->values->data");
                _this.destructors.push(r.varName + "->values");
                _this.destructors.push(r.varName);
            }
            else if (r.string) {
                _this.destructors.push("(char *)" + r.varName);
            }
            else
                _this.destructors.push(r.varName);
        });
        return _this;
    }
    CVariableDestructors = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {arrayDestructors => for (gc_i = 0; gc_i < ({this} ? {this}->size : 0); gc_i++) free((void*){this}->data[gc_i]);\n}\n    {destructors => free({this});\n}\n    {#if gcArraysCVarName}\n        for (gc_i = 0; gc_i < {gcArraysCVarName}->size; gc_i++) {\n            for (gc_j = 0; gc_j < ({gcArraysCVarName}->data[gc_i] ? {gcArraysCVarName}->data[gc_i]->size : 0); gc_j++)\n                free((void*){gcArraysCVarName}->data[gc_i]->data[gc_j]);\n\n            free({gcArraysCVarName}->data[gc_i] ? {gcArraysCVarName}->data[gc_i]->data : NULL);\n            free({gcArraysCVarName}->data[gc_i]);\n        }\n        free({gcArraysCVarName}->data);\n        free({gcArraysCVarName});\n    {/if}\n    {#if gcArraysVarName}\n        for (gc_i = 0; gc_i < {gcArraysVarName}->size; gc_i++) {\n            free({gcArraysVarName}->data[gc_i]->data);\n            free({gcArraysVarName}->data[gc_i]);\n        }\n        free({gcArraysVarName}->data);\n        free({gcArraysVarName});\n    {/if}\n    {#if gcDictsVarName}\n        for (gc_i = 0; gc_i < {gcDictsVarName}->size; gc_i++) {\n            free({gcDictsVarName}->data[gc_i]->index->data);\n            free({gcDictsVarName}->data[gc_i]->index);\n            free({gcDictsVarName}->data[gc_i]->values->data);\n            free({gcDictsVarName}->data[gc_i]->values);\n            free({gcDictsVarName}->data[gc_i]);\n        }\n        free({gcDictsVarName}->data);\n        free({gcDictsVarName});\n    {/if}\n    {#if gcVarName}\n        for (gc_i = 0; gc_i < {gcVarName}->size; gc_i++)\n            free({gcVarName}->data[gc_i]);\n        free({gcVarName}->data);\n        free({gcVarName});\n    {/if}\n{/statements}")
    ], CVariableDestructors);
    return CVariableDestructors;
}(template_1.CTemplateBase));
exports.CVariableDestructors = CVariableDestructors;
var CVariable = /** @class */ (function (_super) {
    __extends(CVariable, _super);
    function CVariable(scope, name, typeSource, options) {
        var _this = _super.call(this) || this;
        _this.name = name;
        var type = utils_1.isNode(typeSource) ? scope.root.typeHelper.getCType(typeSource) : typeSource;
        if (type instanceof ctypes_1.StructType)
            scope.root.symbolsHelper.ensureStruct(type, name);
        else if (type instanceof ctypes_1.ArrayType && type.isDynamicArray)
            scope.root.symbolsHelper.ensureArrayStruct(type.elementType);
        if (_this.typeHasNumber(type))
            scope.root.headerFlags.int16_t = true;
        if (type == ctypes_1.BooleanVarType)
            scope.root.headerFlags.bool = true;
        if (type instanceof ctypes_1.ArrayType && type.elementType == ctypes_1.UniversalVarType)
            scope.root.headerFlags.js_var_dict = true;
        if (type instanceof ctypes_1.DictType && type.elementType == ctypes_1.UniversalVarType)
            scope.root.headerFlags.js_var_dict = true;
        // root scope, make variables file-scoped by default
        if (scope.parent == null)
            _this.static = true;
        if (options && options.removeStorageSpecifier)
            _this.static = false;
        _this.arraysToPointers = options && options.arraysToPointers;
        if (options && options.initializer)
            _this.initializer = options.initializer;
        _this.type = type;
        _this.typeHelper = scope.root.typeHelper;
        return _this;
    }
    CVariable.prototype.typeHasNumber = function (type) {
        var _this = this;
        return type == ctypes_1.NumberVarType
            || type instanceof ctypes_1.ArrayType && this.typeHasNumber(type.elementType)
            || type instanceof ctypes_1.ArrayType && type.isDynamicArray
            || type instanceof ctypes_1.StructType && Object.keys(type.properties).some(function (k) { return _this.typeHasNumber(type.properties[k]); })
            || type instanceof ctypes_1.DictType;
    };
    CVariable.prototype.resolve = function () {
        var varString = this.typeHelper.getTypeString(this.type);
        if (this.arraysToPointers)
            varString = varString.replace(/ \{var\}\[\d+\]/g, "* {var}");
        if (varString.indexOf('{var}') > -1)
            varString = varString.replace('{var}', this.name);
        else
            varString = varString + " " + this.name;
        if (this.static && varString.indexOf('static') != 0)
            varString = 'static ' + varString;
        else if (!this.static)
            varString = varString.replace(/^static /, '');
        if (this.initializer)
            varString += " = " + this.initializer;
        return varString;
    };
    return CVariable;
}(template_1.CTemplateBase));
exports.CVariable = CVariable;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":43,"../types/ctypes":44,"../types/utils":49,"./assignment":2}],12:[function(require,module,exports){
(function (global){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var utils_1 = require("./types/utils");
var typehelper_1 = require("./types/typehelper");
var symbols_1 = require("./symbols");
var memory_1 = require("./memory");
var template_1 = require("./template");
var variable_1 = require("./nodes/variable");
// these imports are here only because it is necessary to run decorators
require("./nodes/statements");
require("./nodes/expressions");
require("./nodes/call");
require("./nodes/literals");
require("./nodes/function");
require("./standard/global/parseInt");
require("./standard/global/isNaN");
require("./standard/array/forEach");
require("./standard/array/push");
require("./standard/array/pop");
require("./standard/array/unshift");
require("./standard/array/shift");
require("./standard/array/splice");
require("./standard/array/slice");
require("./standard/array/concat");
require("./standard/array/join");
require("./standard/array/indexOf");
require("./standard/array/lastIndexOf");
require("./standard/array/sort");
require("./standard/array/reverse");
require("./standard/string/search");
require("./standard/string/charCodeAt");
require("./standard/string/charAt");
require("./standard/string/concat");
require("./standard/string/substring");
require("./standard/string/slice");
require("./standard/string/toString");
require("./standard/string/indexOf");
require("./standard/string/lastIndexOf");
require("./standard/string/match");
require("./standard/number/number");
require("./standard/console/log");
var HeaderFlags = /** @class */ (function () {
    function HeaderFlags() {
        this.strings = false;
        this.printf = false;
        this.malloc = false;
        this.bool = false;
        this.int16_t = false;
        this.uint16_t = false;
        this.js_var = false;
        this.js_var_array = false;
        this.js_var_dict = false;
        this.js_var_from = false;
        this.js_var_from_str = false;
        this.js_var_from_int16_t = false;
        this.js_var_from_uint8_t = false;
        this.js_var_to_str = false;
        this.js_var_to_number = false;
        this.js_var_to_undefined = false;
        this.js_var_to_bool = false;
        this.js_var_typeof = false;
        this.js_var_eq = false;
        this.js_var_lessthan = false;
        this.js_var_plus = false;
        this.js_var_compute = false;
        this.js_var_get = false;
        this.js_var_isnan = false;
        this.js_var_dict_inc = false;
        this.js_var_inc = false;
        this.array = false;
        this.array_pop = false;
        this.array_insert = false;
        this.array_remove = false;
        this.array_string_t = false;
        this.array_int16_t_cmp = false;
        this.array_str_cmp = false;
        this.gc_main = false;
        this.gc_iterator = false;
        this.gc_iterator2 = false;
        this.dict = false;
        this.dict_find_pos = false;
        this.str_int16_t_buflen = false;
        this.str_int16_t_cmp = false;
        this.str_int16_t_cat = false;
        this.str_pos = false;
        this.str_rpos = false;
        this.str_len = false;
        this.str_char_code_at = false;
        this.str_substring = false;
        this.str_slice = false;
        this.str_to_int16_t = false;
        this.parse_int16_t = false;
        this.regex = false;
        this.regex_match = false;
        this.try_catch = false;
    }
    return HeaderFlags;
}());
var CProgram = /** @class */ (function () {
    function CProgram(tsProgram) {
        var _this = this;
        this.parent = null;
        this.root = this;
        this.func = this;
        this.includes = [];
        this.variables = [];
        this.statements = [];
        this.functions = [];
        this.functionPrototypes = [];
        this.headerFlags = new HeaderFlags();
        var tsTypeChecker = tsProgram.getTypeChecker();
        var sources = tsProgram.getSourceFiles().filter(function (s) { return !s.isDeclarationFile; });
        var nodes = [];
        for (var _i = 0, sources_1 = sources; _i < sources_1.length; _i++) {
            var source = sources_1[_i];
            var i_1 = nodes.length;
            nodes = nodes.concat(source.getChildren());
            while (i_1 < nodes.length)
                nodes.push.apply(nodes, nodes[i_1++].getChildren());
        }
        nodes.sort(function (a, b) { return a.pos - b.pos; });
        // Post processing TypeScript AST
        for (var _a = 0, nodes_1 = nodes; _a < nodes_1.length; _a++) {
            var n = nodes_1[_a];
            if (ts.isIdentifier(n)) {
                var symbol = tsTypeChecker.getSymbolAtLocation(n);
                if (!symbol && n.text == "NaN" && !ts.isPropertyAssignment(n)) {
                    if (ts.isElementAccessExpression(n.parent) || ts.isPropertyAccessExpression(n.parent)) {
                        if (ts.isIdentifier(n.parent.expression) && n.parent.expression.text == "Number")
                            n.parent.kind = utils_1.SyntaxKind_NaNKeyword;
                    }
                    else
                        n.kind = utils_1.SyntaxKind_NaNKeyword;
                }
                if (symbol) {
                    if (tsTypeChecker.isUndefinedSymbol(symbol))
                        n.kind = ts.SyntaxKind.UndefinedKeyword;
                }
            }
        }
        this.typeHelper = new typehelper_1.TypeHelper(tsTypeChecker, nodes);
        this.symbolsHelper = new symbols_1.SymbolsHelper(tsTypeChecker, this.typeHelper);
        this.memoryManager = new memory_1.MemoryManager(this.typeHelper, this.symbolsHelper);
        this.typeHelper.inferTypes();
        this.memoryManager.scheduleNodeDisposals(nodes);
        this.gcVarNames = this.memoryManager.getGCVariablesForScope(null);
        for (var _b = 0, _c = this.gcVarNames; _b < _c.length; _b++) {
            var gcVarName = _c[_b];
            this.headerFlags.array = true;
            if (gcVarName == "gc_main") {
                this.headerFlags.gc_main = true;
                continue;
            }
            var gcType = "ARRAY(void *)";
            if (gcVarName.indexOf("_arrays") > -1)
                gcType = "ARRAY(ARRAY(void *))";
            if (gcVarName.indexOf("_arrays_c") > -1)
                gcType = "ARRAY(ARRAY(ARRAY(void *)))";
            this.variables.push(new variable_1.CVariable(this, gcVarName, gcType));
        }
        for (var _d = 0, sources_2 = sources; _d < sources_2.length; _d++) {
            var source = sources_2[_d];
            for (var _e = 0, _f = source.statements; _e < _f.length; _e++) {
                var s = _f[_e];
                this.statements.push(template_1.CodeTemplateFactory.createForNode(this, s));
            }
        }
        var structs = this.symbolsHelper.getStructsAndFunctionPrototypes()[0];
        this.headerFlags.array_string_t = this.headerFlags.array_string_t || structs.filter(function (s) { return s.name == "array_string_t"; }).length > 0;
        this.headerFlags.js_var_array = this.headerFlags.js_var_array || structs.filter(function (s) { return s.name == "array_js_var_t"; }).length > 0;
        this.headerFlags.js_var_dict = this.headerFlags.js_var_dict || structs.filter(function (s) { return s.name == "dict_js_var_t"; }).length > 0;
        this.userStructs = structs.filter(function (s) { return ["array_string_t", "array_js_var_t", "dict_js_var_t"].indexOf(s.name) == -1; }).map(function (s) { return ({
            name: s.name,
            properties: s.properties.map(function (p) { return new variable_1.CVariable(_this, p.name, p.type, { removeStorageSpecifier: true }); })
        }); });
        this.destructors = new variable_1.CVariableDestructors(this, null);
    }
    CProgram = __decorate([
        template_1.CodeTemplate("\n{#if headerFlags.strings || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat\n    || headerFlags.str_pos || headerFlags.str_rpos || headerFlags.array_str_cmp\n    || headerFlags.str_substring || headerFlags.dict_find_pos\n    || headerFlags.array_insert || headerFlags.array_remove || headerFlags.dict || headerFlags.js_var_dict\n    || headerFlags.js_var_from_str || headerFlags.js_var_to_str || headerFlags.js_var_eq || headerFlags.js_var_plus\n    || headerFlags.js_var_lessthan || headerFlags.dict_find_pos}\n    #include <string.h>\n{/if}\n{#if headerFlags.malloc || headerFlags.array || headerFlags.str_substring || headerFlags.str_slice\n    || headerFlags.str_to_int16_t || headerFlags.js_var_to_number || headerFlags.js_var_plus\n    || headerFlags.js_var_from_str || headerFlags.js_var_get || headerFlags.try_catch\n    || headerFlags.js_var_dict_inc}\n    #include <stdlib.h>\n{/if}\n{#if headerFlags.malloc || headerFlags.array || headerFlags.str_substring || headerFlags.str_slice\n    || headerFlags.str_to_int16_t || headerFlags.js_var_to_number || headerFlags.js_var_plus \n    || headerFlags.js_var_from_str || headerFlags.js_var_get || headerFlags.try_catch\n    || headerFlags.js_var_dict_inc}\n    #include <assert.h>\n{/if}\n{#if headerFlags.printf || headerFlags.parse_int16_t}\n    #include <stdio.h>\n{/if}\n{#if headerFlags.str_int16_t_buflen || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat || headerFlags.js_var_to_str || headerFlags.js_var_plus || headerFlags.js_var_lessthan}\n    #include <limits.h>\n{/if}\n{#if headerFlags.str_to_int16_t || headerFlags.js_var_get || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_lessthan}\n    #include <ctype.h>\n{/if}\n{#if headerFlags.try_catch || headerFlags.js_var_get}\n    #include <setjmp.h>\n{/if}\n\n{#if includes.length}\n    {includes => #include <{this}>\n}\n{/if}\n\n{#if headerFlags.bool || headerFlags.js_var_to_bool || headerFlags.js_var_eq || headerFlags.dict_remove || headerFlags.js_var_dict_inc }\n    #define TRUE 1\n    #define FALSE 0\n{/if}\n{#if headerFlags.bool || headerFlags.js_var || headerFlags.str_to_int16_t || headerFlags.js_var_isnan || headerFlags.js_var_dict_inc}\n    typedef unsigned char uint8_t;\n{/if}\n{#if headerFlags.int16_t || headerFlags.js_var || headerFlags.array ||\n     headerFlags.str_int16_t_cmp || headerFlags.str_pos || headerFlags.str_len ||\n     headerFlags.str_char_code_at || headerFlags.str_substring || headerFlags.str_slice ||\n     headerFlags.regex || headerFlags.str_to_int16_t || headerFlags.array_string_t ||\n     headerFlags.try_catch || headerFlags.parse_int16_t || headerFlags.js_var_from  ||\n     headerFlags.str_int16_t_cat || headerFlags.js_var_isnan}\n    typedef short int16_t;\n{/if}\n{#if headerFlags.uint16_t || headerFlags.js_var_compute}\n    typedef unsigned short uint16_t;\n{/if}\n{#if headerFlags.regex}\n    struct regex_indices_struct_t {\n        int16_t index;\n        int16_t end;\n    };\n    struct regex_match_struct_t {\n        int16_t index;\n        int16_t end;\n        struct regex_indices_struct_t *matches;\n        int16_t matches_count;\n    };\n    typedef struct regex_match_struct_t regex_func_t(const char*, int16_t);\n    struct regex_struct_t {\n        const char * str;\n        regex_func_t * func;\n    };\n{/if}\n\n{#if headerFlags.gc_iterator || headerFlags.gc_iterator2 || headerFlags.dict || headerFlags.js_var_plus || headerFlags.js_var_get}\n    #define ARRAY(T) struct {\\\n        int16_t size;\\\n        int16_t capacity;\\\n        T *data;\\\n    } *\n{/if}\n\n{#if headerFlags.array || headerFlags.dict || headerFlags.js_var_dict || headerFlags.js_var_plus || headerFlags.try_catch || headerFlags.js_var_get}\n    #define ARRAY_CREATE(array, init_capacity, init_size) {\\\n        array = malloc(sizeof(*array)); \\\n        array->data = malloc((init_capacity) * sizeof(*array->data)); \\\n        assert(array->data != NULL); \\\n        array->capacity = init_capacity; \\\n        array->size = init_size; \\\n    }\n    #define ARRAY_PUSH(array, item) {\\\n        if (array->size == array->capacity) {  \\\n            array->capacity *= 2;  \\\n            array->data = realloc(array->data, array->capacity * sizeof(*array->data)); \\\n            assert(array->data != NULL); \\\n        }  \\\n        array->data[array->size++] = item; \\\n    }\n{/if}\n{#if headerFlags.array_pop}\n\t#define ARRAY_POP(a) (a->size != 0 ? a->data[--a->size] : 0)\n{/if}\n{#if headerFlags.array_insert || headerFlags.dict || headerFlags.js_var_dict}\n    #define ARRAY_INSERT(array, pos, item) {\\\n        ARRAY_PUSH(array, item); \\\n        if (pos < array->size - 1) {\\\n            memmove(&(array->data[(pos) + 1]), &(array->data[pos]), (array->size - (pos) - 1) * sizeof(*array->data)); \\\n            array->data[pos] = item; \\\n        } \\\n    }\n{/if}\n{#if headerFlags.array_remove}\n    #define ARRAY_REMOVE(array, pos, num) {\\\n        memmove(&(array->data[pos]), &(array->data[(pos) + num]), (array->size - (pos) - num) * sizeof(*array->data)); \\\n        array->size -= num; \\\n    }\n{/if}\n\n{#if headerFlags.dict}\n    #define DICT(T) struct { \\\n        ARRAY(const char *) index; \\\n        ARRAY(T) values; \\\n    } *\n{/if}\n\n{#if headerFlags.dict || headerFlags.js_var_dict || headerFlags.dict_find_pos}\n    int16_t dict_find_pos(const char ** keys, int16_t keys_size, const char * key) {\n        int16_t low = 0;\n        int16_t high = keys_size - 1;\n\n        if (keys_size == 0 || key == NULL)\n            return -1;\n\n        while (low <= high)\n        {\n            int mid = (low + high) / 2;\n            int res = strcmp(keys[mid], key);\n\n            if (res == 0)\n                return mid;\n            else if (res < 0)\n                low = mid + 1;\n            else\n                high = mid - 1;\n        }\n\n        return -1 - low;\n    }\n{/if}\n\n{#if headerFlags.dict || headerFlags.js_var_dict}\n    #define DICT_CREATE(dict, init_capacity) { \\\n        dict = malloc(sizeof(*dict)); \\\n        ARRAY_CREATE(dict->index, init_capacity, 0); \\\n        ARRAY_CREATE(dict->values, init_capacity, 0); \\\n    }\n    \n    int16_t tmp_dict_pos;\n    #define DICT_GET(dict, prop, default) ((tmp_dict_pos = dict_find_pos(dict->index->data, dict->index->size, prop)) < 0 ? default : dict->values->data[tmp_dict_pos])\n\n    int16_t tmp_dict_pos2;\n    #define DICT_SET(dict, prop, value) { \\\n        tmp_dict_pos2 = dict_find_pos(dict->index->data, dict->index->size, prop); \\\n        if (tmp_dict_pos2 < 0) { \\\n            tmp_dict_pos2 = -tmp_dict_pos2 - 1; \\\n            ARRAY_INSERT(dict->index, tmp_dict_pos2, prop); \\\n            ARRAY_INSERT(dict->values, tmp_dict_pos2, value); \\\n        } else \\\n            dict->values->data[tmp_dict_pos2] = value; \\\n    }\n\n{/if}\n\n{#if headerFlags.str_int16_t_buflen || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_to_str || headerFlags.js_var_lessthan}\n    #define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)\n{/if}\n{#if headerFlags.str_int16_t_cmp}\n    int str_int16_t_cmp(const char * str, int16_t num) {\n        char numstr[STR_INT16_T_BUFLEN];\n        sprintf(numstr, \"%d\", num);\n        return strcmp(str, numstr);\n    }\n{/if}\n{#if headerFlags.str_pos}\n    int16_t str_pos(const char * str, const char *search) {\n        int16_t i;\n        const char * found = strstr(str, search);\n        int16_t pos = 0;\n        if (found == 0)\n            return -1;\n        while (*str && str < found) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        return pos;\n    }\n{/if}\n{#if headerFlags.str_rpos}\n    int16_t str_rpos(const char * str, const char *search) {\n        int16_t i;\n        const char * found = strstr(str, search);\n        int16_t pos = 0;\n        const char * end = str + (strlen(str) - strlen(search));\n        if (found == 0)\n            return -1;\n        found = 0;\n        while (end > str && found == 0)\n            found = strstr(end--, search);\n        while (*str && str < found) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        return pos;\n    }\n{/if}\n{#if headerFlags.str_len || headerFlags.str_substring || headerFlags.str_slice}\n    int16_t str_len(const char * str) {\n        int16_t len = 0;\n        int16_t i = 0;\n        while (*str) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            len += i == 4 ? 2 : 1;\n        }\n        return len;\n    }\n{/if}\n{#if headerFlags.str_char_code_at}\n    int16_t str_char_code_at(const char * str, int16_t pos) {\n        int16_t i, res = 0;\n        while (*str) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            if (pos == 0) {\n                res += (unsigned char)*str++;\n                if (i > 1) {\n                    res <<= 6; res -= 0x3080;\n                    res += (unsigned char)*str++;\n                }\n                return res;\n            }\n            str += i;\n            pos -= i == 4 ? 2 : 1;\n        }\n        return -1;\n    }\n{/if}\n{#if headerFlags.str_substring || headerFlags.str_slice}\n    const char * str_substring(const char * str, int16_t start, int16_t end) {\n        int16_t i, tmp, pos, len = str_len(str), byte_start = -1;\n        char *p, *buf;\n        start = start < 0 ? 0 : (start > len ? len : start);\n        end = end < 0 ? 0 : (end > len ? len : end);\n        if (end < start) {\n            tmp = start;\n            start = end;\n            end = tmp;\n        }\n        i = 0;\n        pos = 0;\n        p = (char *)str;\n        while (*p) {\n            if (start == pos)\n                byte_start = p - str;\n            if (end == pos)\n                break;\n            i = 1;\n            if ((*p & 0xE0) == 0xC0) i=2;\n            else if ((*p & 0xF0) == 0xE0) i=3;\n            else if ((*p & 0xF8) == 0xF0) i=4;\n            p += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        len = byte_start == -1 ? 0 : p - str - byte_start;\n        buf = malloc(len + 1);\n        assert(buf != NULL);\n        memcpy(buf, str + byte_start, len);\n        buf[len] = '\\0';\n        return buf;\n    }\n{/if}\n{#if headerFlags.str_slice}\n    const char * str_slice(const char * str, int16_t start, int16_t end) {\n        int16_t len = str_len(str);\n        start = start < 0 ? len + start : start;\n        end = end < 0 ? len + end : end;\n        if (end - start < 0)\n            end = start;\n        return str_substring(str, start, end);\n    }\n{/if}\n{#if headerFlags.str_int16_t_cat}\n    void str_int16_t_cat(char *str, int16_t num) {\n        char numstr[STR_INT16_T_BUFLEN];\n        sprintf(numstr, \"%d\", num);\n        strcat(str, numstr);\n    }\n{/if}\n\n{#if headerFlags.array_int16_t_cmp}\n    int array_int16_t_cmp(const void* a, const void* b) {\n        return ( *(int16_t*)a - *(int16_t*)b );\n    }\n{/if}\n{#if headerFlags.array_str_cmp}\n    int array_str_cmp(const void* a, const void* b) { \n        return strcmp(*(const char **)a, *(const char **)b);\n    }\n{/if}\n\n{#if headerFlags.parse_int16_t}\n    int16_t parse_int16_t(const char * str) {\n        int r;\n        sscanf(str, \"%d\", &r);\n        return (int16_t) r;\n    }\n{/if}\n\n{#if headerFlags.js_var || headerFlags.str_to_int16_t || headerFlags.js_var_from || headerFlags.js_var_isnan || headerFlags.js_var_dict_inc}\n    enum js_var_type {JS_VAR_NULL, JS_VAR_UNDEFINED, JS_VAR_NAN, JS_VAR_BOOL, JS_VAR_INT16, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_DICT};\n    struct js_var {\n        enum js_var_type type;\n        int16_t number;\n        void *data;\n    };\n{/if}\n\n{#if headerFlags.js_var_array || headerFlags.js_var_dict || headerFlags.js_var_dict_inc || headerFlags.js_var_to_str || headerFlags.js_var_plus || headerFlags.js_var_lessthan || headerFlags.js_var_to_number}\n    struct array_js_var_t {\n        int16_t size;\n        int16_t capacity;\n        struct js_var *data;\n    };\n{/if}\n\n{#if headerFlags.array_string_t || headerFlags.js_var_dict || headerFlags.js_var_dict_inc || headerFlags.js_var_get || headerFlags.try_catch}\n    struct array_string_t {\n        int16_t size;\n        int16_t capacity;\n        const char ** data;\n    };\n{/if}\n\n{#if headerFlags.js_var_dict || headerFlags.js_var_dict_inc}\n    struct dict_js_var_t {\n        struct array_string_t *index;\n        struct array_js_var_t *values;\n    };\n{/if}\n\n{#if headerFlags.js_var_from || headerFlags.js_var_get || headerFlags.js_var_dict_inc}\n    struct js_var js_var_from(enum js_var_type type) {\n        struct js_var v;\n        v.type = type;\n        v.data = NULL;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_from_uint8_t}\n    struct js_var js_var_from_uint8_t(uint8_t b) {\n        struct js_var v;\n        v.type = JS_VAR_BOOL;\n        v.number = b;\n        v.data = NULL;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_from_int16_t || headerFlags.js_var_dict_inc}\n    struct js_var js_var_from_int16_t(int16_t n) {\n        struct js_var v;\n        v.type = JS_VAR_INT16;\n        v.number = n;\n        v.data = NULL;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_from_str}\n    struct js_var js_var_from_str(const char *s) {\n        struct js_var v;\n        v.type = JS_VAR_STRING;\n        v.data = (void *)s;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_array}\n    struct js_var js_var_from_array(struct array_js_var_t *arr) {\n        struct js_var v;\n        v.type = JS_VAR_ARRAY;\n        v.data = (void *)arr;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_dict}\n    struct js_var js_var_from_dict(struct dict_js_var_t *dict) {\n        struct js_var v;\n        v.type = JS_VAR_DICT;\n        v.data = (void *)dict;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.str_to_int16_t || headerFlags.js_var_to_number || headerFlags.js_var_get || headerFlags.js_var_eq || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_lessthan || headerFlags.js_var_dict_inc}\n    struct js_var str_to_int16_t(const char * str) {\n        struct js_var v;\n        const char *p = str;\n        int r;\n\n        v.data = NULL;\n\n        while (*p && isspace(*p))\n            p++;\n\n        if (*p == 0)\n            str = \"0\";\n\n        if (*p == '-' && *(p+1))\n            p++;\n\n        while (*p) {\n            if (!isdigit(*p)) {\n                v.type = JS_VAR_NAN;\n                return v;\n            }\n            p++;\n        }\n\n        sscanf(str, \"%d\", &r);\n        v.type = JS_VAR_INT16;\n        v.number = (int16_t)r;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_to_str || headerFlags.js_var_plus || headerFlags.js_var_lessthan}\n    const char * js_var_to_str(struct js_var v, uint8_t *need_dispose)\n    {\n        char *buf;\n        int16_t i;\n        *need_dispose = 0;\n\n        if (v.type == JS_VAR_INT16) {\n            buf = malloc(STR_INT16_T_BUFLEN);\n            assert(buf != NULL);\n            *need_dispose = 1;\n            sprintf(buf, \"%d\", v.number);\n            return buf;\n        } else if (v.type == JS_VAR_BOOL)\n            return v.number ? \"true\" : \"false\";\n        else if (v.type == JS_VAR_STRING)\n            return (const char *)v.data;\n        else if (v.type == JS_VAR_ARRAY) {\n            struct array_js_var_t * arr = (struct array_js_var_t *)v.data;\n            uint8_t dispose_elem = 0;\n            buf = malloc(1);\n            assert(buf != NULL);\n            *need_dispose = 1;\n            buf[0] = 0;\n            for (i = 0; i < arr->size; i++) {\n                const char * elem = js_var_to_str(arr->data[i], &dispose_elem);\n                buf = realloc(buf, strlen(buf) + strlen(elem) + 1 + (i != 0 ? 1 : 0));\n                assert(buf != NULL);\n                if (i != 0)\n                    strcat(buf, \",\");\n                strcat(buf, elem);\n                if (dispose_elem)\n                    free((void *)elem);\n            }\n            return buf;\n        }\n        else if (v.type == JS_VAR_DICT)\n            return \"[object Object]\";\n        else if (v.type == JS_VAR_NAN)\n            return \"NaN\";\n        else if (v.type == JS_VAR_NULL)\n            return \"null\";\n        else if (v.type == JS_VAR_UNDEFINED)\n            return \"undefined\";\n\n        return NULL;\n    }\n{/if}\n\n{#if headerFlags.js_var_to_number || headerFlags.js_var_get || headerFlags.js_var_eq || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_lessthan || headerFlags.js_var_dict_inc}\n\n    struct js_var js_var_to_number(struct js_var v)\n    {\n        struct js_var result;\n        result.type = JS_VAR_INT16;\n        result.number = 0;\n\n        if (v.type == JS_VAR_INT16)\n            result.number = v.number;\n        else if (v.type == JS_VAR_BOOL)\n            result.number = v.number;\n        else if (v.type == JS_VAR_STRING)\n            return str_to_int16_t((const char *)v.data);\n        else if (v.type == JS_VAR_ARRAY) {\n            struct array_js_var_t * arr = (struct array_js_var_t *)v.data;\n            if (arr->size == 0)\n                result.number = 0;\n            else if (arr->size > 1)\n                result.type = JS_VAR_NAN;\n            else\n                result = js_var_to_number(arr->data[0]);\n        } else if (v.type != JS_VAR_NULL)\n            result.type = JS_VAR_NAN;\n\n        return result;\n    }\n\n{/if}\n\n{#if headerFlags.js_var_to_bool}\n\n    uint8_t js_var_to_bool(struct js_var v)\n    {\n        if (v.type == JS_VAR_INT16)\n            return v.number != 0;\n        else if (v.type == JS_VAR_BOOL)\n            return v.number;\n        else if (v.type == JS_VAR_STRING)\n            return *((const char *)v.data) != 0;\n        else if (v.type == JS_VAR_NULL || v.type == JS_VAR_UNDEFINED || v.type == JS_VAR_NAN)\n            return FALSE;\n        else\n            return TRUE;\n    }\n\n{/if}\n\n{#if headerFlags.js_var_to_undefined}\n    struct js_var js_var_to_undefined(void *value) {\n        struct js_var v;\n        v.type = JS_VAR_UNDEFINED;\n        v.data = NULL;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_typeof}\n\n    const char * js_var_typeof(struct js_var v)\n    {\n        if (v.type == JS_VAR_INT16 || v.type == JS_VAR_NAN)\n            return \"number\";\n        else if (v.type == JS_VAR_BOOL)\n            return \"boolean\";\n        else if (v.type == JS_VAR_STRING)\n            return \"string\";\n        else if (v.type == JS_VAR_UNDEFINED)\n            return \"undefined\";\n        else\n            return \"object\";\n    }\n\n{/if}\n\n{#if headerFlags.try_catch || headerFlags.js_var_get}\n    int err_i = 0;\n    jmp_buf err_jmp[10];\n    #define TRY { int err_val = setjmp(err_jmp[err_i++]); if (!err_val) {\n    #define CATCH } else {\n    #define THROW(x) longjmp(err_jmp[--err_i], x)\n    struct array_string_t * err_defs;\n    #define END_TRY err_defs->size--; } }\n{/if}\n\n{#if headerFlags.js_var_dict_inc}\n    struct js_var js_var_dict_inc(struct dict_js_var_t * dict, const char * key, int16_t by, uint8_t is_postfix) {\n        struct js_var value;\n        int16_t pos;\n\n        pos = dict_find_pos(dict->index->data, dict->index->size, key);\n        if (pos < 0) {\n            pos = -pos - 1;\n            ARRAY_INSERT(dict->index, pos, key);\n            ARRAY_INSERT(dict->values, pos, js_var_from(JS_VAR_NAN));\n            return js_var_from(JS_VAR_NAN);\n        } else {\n            value = js_var_to_number(dict->values->data[pos]);\n            if (value.type == JS_VAR_NAN) {\n                dict->values->data[pos] = value;\n                return value;\n            } else {\n                value.number += by;\n                dict->values->data[pos] = value;\n                if (is_postfix)\n                    value.number -= by;\n                return value;\n            }\n        }\n    }\n{/if}\n\n{#if headerFlags.js_var_inc}\n    struct js_var js_var_inc(struct js_var * v, int16_t by) {\n        struct js_var result;\n\n        result = js_var_to_number(*v);\n        if (result.type == JS_VAR_INT16) {\n            (*v).type = JS_VAR_INT16;\n            (*v).number = result.number + by;\n            (*v).data = NULL;\n        } else\n            (*v).type = JS_VAR_NAN;\n        return result;\n    }\n{/if}\n\n{#if headerFlags.js_var_get}\n    struct js_var js_var_get(struct js_var v, struct js_var arg) {\n        struct js_var tmp;\n        const char *key;\n        uint8_t need_dispose = 0;\n\n        if (v.type == JS_VAR_ARRAY) {\n            tmp = js_var_to_number(arg);\n            if (tmp.type == JS_VAR_NAN)\n                return js_var_from(JS_VAR_UNDEFINED);\n            else\n                return ((struct array_js_var_t *)v.data)->data[tmp.number];\n        } else if (v.type == JS_VAR_DICT) {\n            key = js_var_to_str(arg, &need_dispose);\n            tmp = DICT_GET(((struct dict_js_var_t *)v.data), key, js_var_from(JS_VAR_UNDEFINED));\n            if (need_dispose)\n                free((void *)key);\n            return tmp;\n        } else if (v.type == JS_VAR_NULL || v.type == JS_VAR_UNDEFINED) {\n            ARRAY_PUSH(err_defs, \"TypeError: Cannot read property of null or undefined.\");\n            THROW(err_defs->size);\n        } else\n            return js_var_from(JS_VAR_UNDEFINED);\n    }\n{/if}\n\n{#if headerFlags.js_var_eq}\n    uint8_t js_var_eq(struct js_var left, struct js_var right, uint8_t strict)\n    {\n        if (left.type == right.type) {\n            if (left.type == JS_VAR_NULL || left.type == JS_VAR_UNDEFINED)\n                return TRUE;\n            else if (left.type == JS_VAR_NAN)\n                return FALSE;\n            else if (left.type == JS_VAR_INT16 || left.type == JS_VAR_BOOL)\n                return left.number == right.number ? TRUE : FALSE;\n            else if (left.type == JS_VAR_STRING)\n                return !strcmp((const char *)left.data, (const char *)right.data) ? TRUE : FALSE;\n            else\n                return left.data == right.data;\n        } else if (!strict) {\n            if ((left.type == JS_VAR_NULL && right.type == JS_VAR_UNDEFINED) || (left.type == JS_VAR_UNDEFINED && right.type == JS_VAR_NULL))\n                return TRUE;\n            else if ((left.type == JS_VAR_INT16 && right.type == JS_VAR_STRING) || (left.type == JS_VAR_STRING && right.type == JS_VAR_INT16))\n                return js_var_eq(js_var_to_number(left), js_var_to_number(right), strict);\n            else if (left.type == JS_VAR_BOOL)\n                return js_var_eq(js_var_to_number(left), right, strict);\n            else if (right.type == JS_VAR_BOOL)\n                return js_var_eq(left, js_var_to_number(right), strict);\n            else\n                return FALSE;\n        } else\n            return FALSE;\n    }\n{/if}\n\n{#if headerFlags.js_var_lessthan}\n    int16_t js_var_lessthan(struct js_var left, struct js_var right)\n    {\n        struct js_var left_to_number, right_to_number;\n        const char *left_as_string, *right_as_string;\n        uint8_t need_dispose_left, need_dispose_right;\n        int16_t result;\n\n        if ((left.type == JS_VAR_STRING || left.type == JS_VAR_ARRAY || left.type == JS_VAR_DICT)\n            && (right.type == JS_VAR_STRING || right.type == JS_VAR_ARRAY || right.type == JS_VAR_DICT))\n        {\n            left_as_string = js_var_to_str(left, &need_dispose_left);\n            right_as_string = js_var_to_str(right, &need_dispose_right);\n            \n            result = strcmp(left_as_string, right_as_string) < 0 ? 1 : -1;\n\n            if (need_dispose_left)\n                free((void *)left_as_string);\n            if (need_dispose_right)\n                free((void *)right_as_string);\n            return result;\n        } else {\n            left_to_number = js_var_to_number(left);\n            right_to_number = js_var_to_number(right);\n\n            if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN)\n                return 0;\n            if (left_to_number.number == 0 && right_to_number.number == 0)\n                return -1;\n            return left_to_number.number < right_to_number.number ? 1 : -1;\n        }\n    }\n{/if}\n\n{#if headerFlags.gc_main || headerFlags.js_var_plus}\n    static ARRAY(void *) gc_main;\n{/if}\n\n{#if headerFlags.js_var_plus}\n\n    struct js_var js_var_plus(struct js_var left, struct js_var right)\n    {\n        struct js_var result, left_to_number, right_to_number;\n        const char *left_as_string, *right_as_string;\n        uint8_t need_dispose_left, need_dispose_right;\n        result.data = NULL;\n\n        if (left.type == JS_VAR_STRING || right.type == JS_VAR_STRING \n            || left.type == JS_VAR_ARRAY || right.type == JS_VAR_ARRAY\n            || left.type == JS_VAR_DICT || right.type == JS_VAR_DICT)\n        {\n            left_as_string = js_var_to_str(left, &need_dispose_left);\n            right_as_string = js_var_to_str(right, &need_dispose_right);\n            \n            result.type = JS_VAR_STRING;\n            result.data = malloc(strlen(left_as_string) + strlen(right_as_string) + 1);\n            assert(result.data != NULL);\n            ARRAY_PUSH(gc_main, result.data);\n\n            strcpy(result.data, left_as_string);\n            strcat(result.data, right_as_string);\n\n            if (need_dispose_left)\n                free((void *)left_as_string);\n            if (need_dispose_right)\n                free((void *)right_as_string);\n            return result;\n        }\n\n        left_to_number = js_var_to_number(left);\n        right_to_number = js_var_to_number(right);\n\n        if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN) {\n            result.type = JS_VAR_NAN;\n            return result;\n        }\n\n        result.type = JS_VAR_INT16;\n        result.number = left_to_number.number + right_to_number.number;\n        return result;\n    }\n\n{/if}\n\n{#if headerFlags.js_var_compute}\n\n    enum js_var_op {JS_VAR_MINUS, JS_VAR_ASTERISK, JS_VAR_SLASH, JS_VAR_PERCENT, JS_VAR_SHL, JS_VAR_SHR, JS_VAR_USHR, JS_VAR_OR, JS_VAR_AND};\n    struct js_var js_var_compute(struct js_var left, enum js_var_op op, struct js_var right)\n    {\n        struct js_var result, left_to_number, right_to_number;\n        result.data = NULL;\n\n        left_to_number = js_var_to_number(left);\n        right_to_number = js_var_to_number(right);\n\n        if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN) {\n            if (op == JS_VAR_MINUS || op == JS_VAR_ASTERISK || op == JS_VAR_SLASH || op == JS_VAR_PERCENT) {\n                result.type = JS_VAR_NAN;\n                return result;\n            }\n        }\n        \n        result.type = JS_VAR_INT16;\n        switch (op) {\n            case JS_VAR_MINUS:\n                result.number = left_to_number.number - right_to_number.number;\n                break;\n            case JS_VAR_ASTERISK:\n                result.number = left_to_number.number * right_to_number.number;\n                break;\n            case JS_VAR_SLASH:\n                result.number = left_to_number.number / right_to_number.number;\n                break;\n            case JS_VAR_PERCENT:\n                result.number = left_to_number.number % right_to_number.number;\n                break;\n            case JS_VAR_SHL:\n                result.number = left_to_number.number << right_to_number.number;\n                break;\n            case JS_VAR_SHR:\n                result.number = left_to_number.number >> right_to_number.number;\n                break;\n            case JS_VAR_USHR:\n                result.number = ((uint16_t)left_to_number.number) >> right_to_number.number;\n                break;\n            case JS_VAR_AND:\n                result.number = left_to_number.number & right_to_number.number;\n                break;\n            case JS_VAR_OR:\n                result.number = left_to_number.number | right_to_number.number;\n                break;\n        }\n        return result;\n    }\n\n{/if}\n\n{#if headerFlags.js_var_isnan}\n    uint8_t js_var_isnan(struct js_var v) {\n        return js_var_to_number(v).type == JS_VAR_NAN;\n    }\n{/if}\n\n{userStructs => struct {name} {\n    {properties {    }=> {this};\n}};\n}\n\n{#if headerFlags.regex}\n    void regex_clear_matches(struct regex_match_struct_t *match_info, int16_t groupN) {\n        int16_t i;\n        for (i = 0; i < groupN; i++) {\n            match_info->matches[i].index = -1;\n            match_info->matches[i].end = -1;\n        }\n    }\n{/if}\n\n{#if headerFlags.regex_match}\n    struct array_string_t *regex_match(struct regex_struct_t regex, const char * s) {\n        struct regex_match_struct_t match_info;\n        struct array_string_t *match_array = NULL;\n        int16_t i;\n\n        match_info = regex.func(s, TRUE);\n        if (match_info.index != -1) {\n            ARRAY_CREATE(match_array, match_info.matches_count + 1, match_info.matches_count + 1);\n            match_array->data[0] = str_substring(s, match_info.index, match_info.end);\n            for (i = 0;i < match_info.matches_count; i++) {\n                if (match_info.matches[i].index != -1 && match_info.matches[i].end != -1)\n                    match_array->data[i + 1] = str_substring(s, match_info.matches[i].index, match_info.matches[i].end);\n                else\n                    match_array->data[i + 1] = str_substring(s, 0, 0);\n            }\n        }\n        if (match_info.matches_count)\n            free(match_info.matches);\n\n        return match_array;\n    }\n{/if}\n\n{#if headerFlags.gc_iterator || headerFlags.js_var_plus}\n    int16_t gc_i;\n{/if}\n{#if headerFlags.gc_iterator2}\n    int16_t gc_j;\n{/if}\n\n{variables => {this};\n}\n\n{functionPrototypes => {this}\n}\n\n{functions => {this}\n}\n\nint main(void) {\n    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}\n    {#if headerFlags.try_catch || headerFlags.js_var_get}\n        ARRAY_CREATE(err_defs, 2, 0);\n    {/if}\n\n    {statements {    }=> {this}}\n\n    {destructors}\n    return 0;\n}\n")
    ], CProgram);
    return CProgram;
}());
exports.CProgram = CProgram;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./memory":1,"./nodes/call":3,"./nodes/expressions":5,"./nodes/function":6,"./nodes/literals":7,"./nodes/statements":9,"./nodes/variable":11,"./standard/array/concat":15,"./standard/array/forEach":16,"./standard/array/indexOf":17,"./standard/array/join":18,"./standard/array/lastIndexOf":19,"./standard/array/pop":20,"./standard/array/push":21,"./standard/array/reverse":22,"./standard/array/shift":23,"./standard/array/slice":24,"./standard/array/sort":25,"./standard/array/splice":26,"./standard/array/unshift":27,"./standard/console/log":28,"./standard/global/isNaN":29,"./standard/global/parseInt":30,"./standard/number/number":31,"./standard/string/charAt":32,"./standard/string/charCodeAt":33,"./standard/string/concat":34,"./standard/string/indexOf":35,"./standard/string/lastIndexOf":36,"./standard/string/match":37,"./standard/string/search":38,"./standard/string/slice":39,"./standard/string/substring":40,"./standard/string/toString":41,"./symbols":42,"./template":43,"./types/typehelper":48,"./types/utils":49}],13:[function(require,module,exports){
"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var NOTHING = { nothing: true };
var FIXED_START = { fixedStart: true };
var FIXED_END = { fixedEnd: true };
Array.prototype["removeDuplicates"] = function () {
    return this.filter(function (item, pos, self) { return self.indexOf(item) == pos; });
};
function isStartGroup(t) { return t && !!t.startGroup || false; }
function isEndGroup(t) { return t && !!t.endGroup || false; }
function isRangeCondition(t) { return t && !!t.fromChar && !!t.toChar || false; }
exports.isRangeCondition = isRangeCondition;
;
var RegexParser = /** @class */ (function () {
    function RegexParser() {
    }
    RegexParser.parseEscaped = function (c) {
        if (c == 'd')
            return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        else if (c == 'w')
            return [
                'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
                'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'W', 'Z',
                'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
                'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'w', 'z',
                '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '_'
            ];
        else if (c == 'n')
            return ['\n'];
        else if (c == 's')
            return ['\t', ' '];
        else
            return [c];
    };
    RegexParser.parseChars = function (template, i, mode) {
        var token = { tokens: [] };
        token[mode] = true;
        while (template[i] != ']') {
            if (template[i] == '\\')
                i++ && (token.tokens = token.tokens.concat(this.parseEscaped(template[i])));
            else if (template[i + 1] == '-' && template[i + 2] != ']') {
                var ch = template[i];
                i++;
                i++;
                while (ch.charCodeAt(0) <= template[i].charCodeAt(0)) {
                    token.tokens.push(ch);
                    ch = String.fromCharCode(ch.charCodeAt(0) + 1);
                }
            }
            else
                token.tokens.push(template[i]);
            i++;
        }
        return [token.tokens.length ? token : null, i];
    };
    RegexParser.parse = function (template, isGroup, group) {
        if (isGroup === void 0) { isGroup = false; }
        if (group === void 0) { group = 0; }
        var rootToken = { tokens: [] };
        var tokens = [];
        var lastToken = function () { return tokens.slice(-1)[0]; };
        var tok = null;
        var i = 0;
        while (i < template.length) {
            var last = lastToken();
            if (template[i] == '^' && tokens.length == 0)
                tokens.push(FIXED_START);
            else if (template[i] == '$' && i == template.length - 1 || template.slice(i, i + 2) == '$)' || template.slice(i, i + 2) == '$|')
                tokens.push(FIXED_END);
            else if (template[i] == '\\')
                i++, tokens.push({ anyOf: true, tokens: this.parseEscaped(template[i]) });
            else if (template[i] == '.')
                tokens.push({ anyCharExcept: true, tokens: [] });
            else if (template[i] == '*') {
                tokens.pop();
                if (typeof last === "string")
                    tokens.push({ anyOf: true, tokens: [NOTHING, { tokens: [last], oneOrMore: true }] });
                else
                    tokens.push({ anyOf: true, tokens: [NOTHING, __assign({}, last, { oneOrMore: true })] });
            }
            else if (template[i] == '?')
                tokens.push({ anyOf: true, tokens: [NOTHING, tokens.pop()] });
            else if (template[i] == '+')
                if (typeof last === "string")
                    tokens.push({ oneOrMore: true, tokens: [tokens.pop()] });
                else
                    last.oneOrMore = true;
            else if (template[i] == '|') {
                rootToken.tokens.push(tokens.length ? { tokens: tokens } : NOTHING);
                rootToken.anyOf = true;
                tokens = [];
            }
            else if (template.slice(i, i + 3) == '(?:')
                i += 3, (_a = this.parse(template.slice(i), true, group), group = _a.group, tok = _a.tokenTree, _a) && tok && tokens.push(tok) && (i += tok.template.length);
            else if (template[i] == '(') {
                var nextGroup = void 0;
                i++, group++;
                (_b = this.parse(template.slice(i), true, group), nextGroup = _b.group, tok = _b.tokenTree);
                tok && tokens.push({ tokens: [{ startGroup: group }, tok, { endGroup: group }] }) && (i += tok.template.length);
                group = nextGroup;
            }
            else if (template[i] == ')' && isGroup)
                break;
            else if (template.slice(i, i + 2) == '[^')
                i += 2, (_c = this.parseChars(template, i, 'anyCharExcept'), tok = _c[0], i = _c[1], _c) && tok && tokens.push(tok);
            else if (template[i] == '[')
                i++, (_d = this.parseChars(template, i, 'anyOf'), tok = _d[0], i = _d[1], _d) && tok && tokens.push(tok);
            else
                tokens.push(template[i]);
            i++;
        }
        if (rootToken.anyOf)
            rootToken.tokens.push(tokens.length ? { tokens: tokens } : NOTHING);
        else
            rootToken.tokens = tokens;
        rootToken.template = template.slice(0, i);
        return { group: group, tokenTree: isGroup && rootToken.tokens.length == 0 ? null : rootToken };
        var _a, _b, _c, _d;
    };
    return RegexParser;
}());
var RegexBuilder = /** @class */ (function () {
    function RegexBuilder() {
    }
    RegexBuilder.convert = function (token, transitions, firstFromState, finalState) {
        if (transitions === void 0) { transitions = []; }
        if (firstFromState === void 0) { firstFromState = 0; }
        if (finalState === void 0) { finalState = 0; }
        var nextFromState = [firstFromState];
        if (typeof token == "string" || token.anyCharExcept) {
            transitions.push({ token: token, fromState: firstFromState, toState: ++finalState });
            nextFromState = [finalState];
        }
        else if (token.anyOf) {
            var lastTransitions = [];
            if (token.tokens.indexOf(NOTHING) > -1)
                nextFromState = [firstFromState];
            else
                nextFromState = [];
            for (var _i = 0, _a = token.tokens.filter(function (t) { return t != NOTHING && t != FIXED_START && t != FIXED_END && !isStartGroup(t) && !isEndGroup(t); }); _i < _a.length; _i++) {
                var tok = _a[_i];
                var l = transitions.length;
                var result = this.convert(tok, transitions, firstFromState, finalState);
                finalState = result.finalState;
                if (result.nextFromState.length > 1)
                    nextFromState = nextFromState.concat(result.nextFromState.filter(function (n) { return n != finalState; }));
                lastTransitions = lastTransitions.concat(transitions.slice(l).filter(function (t) { return t.toState == finalState; }));
            }
            nextFromState = nextFromState.concat(finalState).removeDuplicates();
            lastTransitions.forEach(function (ls) { return ls.toState = finalState; });
        }
        else {
            for (var _b = 0, _c = token.tokens.filter(function (t) { return t != FIXED_START && t != FIXED_END && !isStartGroup(t) && !isEndGroup(t); }); _b < _c.length; _b++) {
                var tok = _c[_b];
                var results = [];
                var lastTransitions = [];
                var _loop_1 = function (fromState) {
                    var l = transitions.length;
                    var result = this_1.convert(tok, transitions, fromState, finalState);
                    lastTransitions = lastTransitions.concat(transitions.slice(l).filter(function (t) { return t.toState == result.finalState; }));
                    results.push(result);
                };
                var this_1 = this;
                for (var _d = 0, nextFromState_1 = nextFromState; _d < nextFromState_1.length; _d++) {
                    var fromState = nextFromState_1[_d];
                    _loop_1(fromState);
                }
                nextFromState = [].concat.apply([], results.map(function (r) { return r.nextFromState; })).removeDuplicates();
                finalState = results.map(function (r) { return r.finalState; }).reduce(function (a, b) { return Math.max(a, b); }, 0);
            }
        }
        if (typeof token != "string" && token.oneOrMore) {
            for (var _e = 0, _f = transitions.filter(function (t) { return t.toState == finalState; }); _e < _f.length; _e++) {
                var tr = _f[_e];
                transitions.push(__assign({}, tr, { toState: firstFromState }));
            }
        }
        if (typeof token != "string" && token.tokens[0] == FIXED_START) {
            transitions.filter(function (t) { return t.fromState == firstFromState; }).forEach(function (t) { return t.fixedStart = true; });
        }
        if (typeof token != "string" && token.tokens[token.tokens.length - 1] == FIXED_END) {
            transitions.filter(function (t) { return t.toState == finalState; }).forEach(function (t) { return t.fixedEnd = true; });
        }
        var groupTok;
        if (typeof token != "string" && isStartGroup(groupTok = token.tokens[0])) {
            transitions.filter(function (t) { return t.fromState == firstFromState; }).forEach(function (t) {
                t.startGroup = t.startGroup || [];
                if (t.startGroup.indexOf(groupTok.startGroup) == -1)
                    t.startGroup.push(groupTok.startGroup);
            });
        }
        if (typeof token != "string" && isEndGroup(groupTok = token.tokens[token.tokens.length - 1])) {
            transitions.filter(function (t) { return t.toState == finalState; }).forEach(function (t) {
                t.endGroup = t.endGroup || [];
                if (t.endGroup.indexOf(groupTok.endGroup) == -1)
                    t.endGroup.push(groupTok.endGroup);
            });
        }
        return { transitions: transitions, nextFromState: nextFromState, finalState: finalState };
    };
    RegexBuilder.normalize = function (transitions, finalStates) {
        if (!transitions.length)
            return [];
        var states = [];
        var _loop_2 = function (finalState) {
            if (transitions.map(function (t) { return t.fromState; }).indexOf(finalState) == -1) {
                transitions.push({ fromState: finalState, final: true });
            }
            else
                transitions.filter(function (t) { return t.fromState == finalState; }).forEach(function (t) { return t.final = true; });
        };
        for (var _i = 0, finalStates_1 = finalStates; _i < finalStates_1.length; _i++) {
            var finalState = finalStates_1[_i];
            _loop_2(finalState);
        }
        // split anyChar transitions
        var addedTransitions = [];
        var charTransitions = transitions.filter(function (t) { return typeof t.token == "string"; });
        var anyCharTransitions = transitions.filter(function (t) { return typeof t.token != "string" && t.token != null; });
        var _loop_3 = function (anyCharT) {
            var _loop_4 = function (charT) {
                var anyCharT_token = anyCharT.token;
                if (charT.fromState == anyCharT.fromState && anyCharT.toState != charT.toState && anyCharT_token.tokens.indexOf(charT.token) == -1) {
                    if (transitions.filter(function (t) { return t.fromState == anyCharT.fromState && t.toState == anyCharT.toState && t.token == charT.token; }).length == 0)
                        addedTransitions.push({ fromState: anyCharT.fromState, toState: anyCharT.toState, token: charT.token, startGroup: anyCharT.startGroup, endGroup: anyCharT.endGroup });
                }
            };
            for (var _i = 0, charTransitions_1 = charTransitions; _i < charTransitions_1.length; _i++) {
                var charT = charTransitions_1[_i];
                _loop_4(charT);
            }
        };
        for (var _a = 0, anyCharTransitions_1 = anyCharTransitions; _a < anyCharTransitions_1.length; _a++) {
            var anyCharT = anyCharTransitions_1[_a];
            _loop_3(anyCharT);
        }
        transitions = transitions.concat(addedTransitions);
        var stateIndices = {};
        var processed = {};
        var ensureId = function (tt) {
            var id = tt.map(function (t) { return t.fromState; }).removeDuplicates().sort().join(",");
            if (stateIndices[id] == null) {
                stateIndices[id] = Object.keys(stateIndices).length;
            }
            return stateIndices[id];
        };
        var queue = [transitions.filter(function (t) { return t.fromState == 0; })];
        var _loop_5 = function () {
            var trgroup = queue.pop();
            var id = ensureId(trgroup);
            if (processed[id])
                return "continue";
            states.push({ transitions: [] });
            if (trgroup.filter(function (t) { return t.final; }).length > 0)
                states[states.length - 1].final = true;
            processed[id] = true;
            var processedTr = [];
            var _loop_6 = function (tr) {
                var group = trgroup.filter(function (t) { return JSON.stringify(tr.token) === JSON.stringify(t.token) && processedTr.indexOf(t) == -1; });
                if (!group.length)
                    return "continue";
                group.forEach(function (g) { return processedTr.push(g); });
                var reachableStates = group.map(function (g) { return g.toState; });
                var closure = transitions.filter(function (t) { return reachableStates.indexOf(t.fromState) > -1; });
                var closureId = ensureId(closure);
                var sameTokenTransactions = trgroup.filter(function (t) { return JSON.stringify(tr.token) === JSON.stringify(t.token); });
                var startGr = sameTokenTransactions.map(function (t) { return t.startGroup; }).reduce(function (a, c) { return c == null ? a : a.concat(c); }, []).reduce(function (a, c) { a.indexOf(c) == -1 && a.push(c); return a; }, []);
                var endGr = sameTokenTransactions.map(function (t) { return t.endGroup; }).reduce(function (a, c) { return c == null ? a : a.concat(c); }, []).reduce(function (a, c) { a.indexOf(c) == -1 && a.push(c); return a; }, []);
                states[id].transitions.push({ condition: tr.token, next: closureId, fixedStart: tr.fixedStart, fixedEnd: tr.fixedEnd, startGroup: startGr, endGroup: endGr });
                //console.log("FROM: ", id, "----", tr.fixedStart ? "(start of line)" : "", tr.token, tr.fixedEnd ? "(end of line)" : "", "---> ", closureId);
                queue.unshift(closure);
            };
            for (var _i = 0, _a = trgroup.filter(function (t) { return !!t.token; }); _i < _a.length; _i++) {
                var tr = _a[_i];
                _loop_6(tr);
            }
        };
        while (queue.length) {
            _loop_5();
        }
        for (var _b = 0, states_1 = states; _b < states_1.length; _b++) {
            var state = states_1[_b];
            var charTransitions_2 = state.transitions.filter(function (t) { return typeof t.condition == "string"; }).sort(function (a, b) { return a.condition > b.condition ? 1 : -1; });
            if (charTransitions_2.length > 1) {
                var classTransitions = [];
                var condition = { fromChar: charTransitions_2[0].condition, toChar: charTransitions_2[0].condition };
                for (var i_1 = 1; i_1 <= charTransitions_2.length; i_1++) {
                    if (i_1 < charTransitions_2.length
                        && charTransitions_2[i_1].condition.charCodeAt(0) == charTransitions_2[i_1 - 1].condition.charCodeAt(0) + 1
                        && charTransitions_2[i_1].next == charTransitions_2[i_1 - 1].next
                        && charTransitions_2[i_1].fixedStart == charTransitions_2[i_1 - 1].fixedStart
                        && charTransitions_2[i_1].fixedEnd == charTransitions_2[i_1 - 1].fixedEnd
                        && charTransitions_2[i_1].final == charTransitions_2[i_1 - 1].final
                        && JSON.stringify(charTransitions_2[i_1].startGroup) == JSON.stringify(charTransitions_2[i_1 - 1].startGroup)
                        && JSON.stringify(charTransitions_2[i_1].endGroup) == JSON.stringify(charTransitions_2[i_1 - 1].endGroup)) {
                        condition.toChar = charTransitions_2[i_1].condition;
                    }
                    else {
                        if (condition.fromChar == condition.toChar) {
                            classTransitions.push(charTransitions_2[i_1 - 1]);
                        }
                        else {
                            classTransitions.push(__assign({}, charTransitions_2[i_1 - 1], { condition: condition }));
                        }
                        if (i_1 < charTransitions_2.length)
                            condition = { fromChar: charTransitions_2[i_1].condition, toChar: charTransitions_2[i_1].condition };
                    }
                }
                state.transitions = classTransitions.concat(state.transitions.filter(function (t) { return typeof t.condition != "string"; }));
            }
        }
        return states;
    };
    RegexBuilder.build = function (template) {
        var tokenTree = RegexParser.parse(template).tokenTree;
        var _a = this.convert(tokenTree), transitions = _a.transitions, nextFromState = _a.nextFromState;
        var states = this.normalize(transitions, nextFromState);
        return { states: states };
    };
    return RegexBuilder;
}());
exports.RegexBuilder = RegexBuilder;

},{}],14:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var standardCallResolvers = [];
function StandardCallResolver(target) {
    standardCallResolvers.push(new target());
}
exports.StandardCallResolver = StandardCallResolver;
var StandardCallHelper = /** @class */ (function () {
    function StandardCallHelper() {
    }
    StandardCallHelper.isStandardCall = function (typeHelper, node) {
        if (!ts.isCallExpression(node))
            return false;
        for (var _i = 0, standardCallResolvers_1 = standardCallResolvers; _i < standardCallResolvers_1.length; _i++) {
            var resolver = standardCallResolvers_1[_i];
            if (resolver.matchesNode(typeHelper, node))
                return true;
        }
        return false;
    };
    StandardCallHelper.createTemplate = function (scope, node) {
        for (var _i = 0, standardCallResolvers_2 = standardCallResolvers; _i < standardCallResolvers_2.length; _i++) {
            var resolver = standardCallResolvers_2[_i];
            if (resolver.matchesNode(scope.root.typeHelper, node))
                return resolver.createTemplate(scope, node);
        }
        return null;
    };
    StandardCallHelper.getObjectType = function (typeHelper, node) {
        for (var _i = 0, standardCallResolvers_3 = standardCallResolvers; _i < standardCallResolvers_3.length; _i++) {
            var resolver = standardCallResolvers_3[_i];
            if (resolver.matchesNode(typeHelper, node, { determineObjectType: true }))
                return resolver.objectType ? resolver.objectType(typeHelper, node) : null;
        }
        return null;
    };
    StandardCallHelper.getArgumentTypes = function (typeHelper, node) {
        var notDefined = node.arguments.map(function (a) { return null; });
        for (var _i = 0, standardCallResolvers_4 = standardCallResolvers; _i < standardCallResolvers_4.length; _i++) {
            var resolver = standardCallResolvers_4[_i];
            if (resolver.matchesNode(typeHelper, node, { determineObjectType: true }))
                return resolver.argumentTypes ? resolver.argumentTypes(typeHelper, node) : notDefined;
        }
        return notDefined;
    };
    StandardCallHelper.getReturnType = function (typeHelper, node) {
        for (var _i = 0, standardCallResolvers_5 = standardCallResolvers; _i < standardCallResolvers_5.length; _i++) {
            var resolver = standardCallResolvers_5[_i];
            if (resolver.matchesNode(typeHelper, node))
                return resolver.returnType(typeHelper, node);
        }
        return null;
    };
    StandardCallHelper.needsDisposal = function (typeHelper, node) {
        for (var _i = 0, standardCallResolvers_6 = standardCallResolvers; _i < standardCallResolvers_6.length; _i++) {
            var resolver = standardCallResolvers_6[_i];
            if (resolver.matchesNode(typeHelper, node))
                return resolver.needsDisposal(typeHelper, node);
        }
        return false;
    };
    StandardCallHelper.getTempVarName = function (typeHelper, node) {
        for (var _i = 0, standardCallResolvers_7 = standardCallResolvers; _i < standardCallResolvers_7.length; _i++) {
            var resolver = standardCallResolvers_7[_i];
            if (resolver.matchesNode(typeHelper, node))
                return resolver.getTempVarName(typeHelper, node);
        }
        console.log("Internal error: cannot find matching resolver for node '" + node.getText() + "' in StandardCallHelper.getTempVarName");
        return "tmp";
    };
    StandardCallHelper.getEscapeNode = function (typeHelper, node) {
        for (var _i = 0, standardCallResolvers_8 = standardCallResolvers; _i < standardCallResolvers_8.length; _i++) {
            var resolver = standardCallResolvers_8[_i];
            if (resolver.matchesNode(typeHelper, node))
                return resolver.getEscapeNode(typeHelper, node);
        }
        return null;
    };
    return StandardCallHelper;
}());
exports.StandardCallHelper = StandardCallHelper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],15:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayConcatResolver = /** @class */ (function () {
    function ArrayConcatResolver() {
    }
    ArrayConcatResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "concat" && objType instanceof ctypes_1.ArrayType;
    };
    ArrayConcatResolver.prototype.returnType = function (typeHelper, call) {
        var propAccess = call.expression;
        var type = typeHelper.getCType(propAccess.expression);
        return new ctypes_1.ArrayType(type.elementType, 0, true);
    };
    ArrayConcatResolver.prototype.createTemplate = function (scope, node) {
        return new CArrayConcat(scope, node);
    };
    ArrayConcatResolver.prototype.needsDisposal = function (typeHelper, node) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    };
    ArrayConcatResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "tmp_array";
    };
    ArrayConcatResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return node;
    };
    ArrayConcatResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArrayConcatResolver);
    return ArrayConcatResolver;
}());
var CArrayConcat = /** @class */ (function (_super) {
    __extends(CArrayConcat, _super);
    function CArrayConcat(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.varAccess = null;
        _this.concatValues = [];
        _this.sizes = [];
        var propAccess = call.expression;
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            _this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            var type = scope.root.typeHelper.getCType(propAccess.expression);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, new ctypes_1.ArrayType(type.elementType, 0, true)));
            _this.indexVarName = scope.root.symbolsHelper.addIterator(call);
            scope.variables.push(new variable_1.CVariable(scope, _this.indexVarName, ctypes_1.NumberVarType));
            var args = call.arguments.map(function (a) { return ({ node: a, template: template_1.CodeTemplateFactory.createForNode(scope, a) }); });
            var toConcatenate = [{ node: propAccess.expression, template: _this.varAccess }].concat(args);
            _this.sizes = toConcatenate.map(function (a) { return new CGetSize(scope, a.node, a.template); });
            _this.concatValues = toConcatenate.map(function (a) { return new CConcatValue(scope, _this.tempVarName, a.node, a.template, _this.indexVarName); });
        }
        scope.root.headerFlags.array = true;
        return _this;
    }
    CArrayConcat = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        ARRAY_CREATE({tempVarName}, {sizes{+}=>{this}}, 0);\n        {tempVarName}->size = {tempVarName}->capacity;\n        {indexVarName} = 0;\n        {concatValues}\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayConcat);
    return CArrayConcat;
}(template_1.CTemplateBase));
var CGetSize = /** @class */ (function () {
    function CGetSize(scope, valueNode, value) {
        this.value = value;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isArray = type instanceof ctypes_1.ArrayType;
        this.staticArraySize = type instanceof ctypes_1.ArrayType && type.capacity;
    }
    CGetSize = __decorate([
        template_1.CodeTemplate("\n{#if staticArraySize}\n    {staticArraySize}\n{#elseif isArray}\n    {value}->size\n{#else}\n    1\n{/if}")
    ], CGetSize);
    return CGetSize;
}());
var CConcatValue = /** @class */ (function () {
    function CConcatValue(scope, varAccess, valueNode, value, indexVarName) {
        this.varAccess = varAccess;
        this.value = value;
        this.indexVarName = indexVarName;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isArray = type instanceof ctypes_1.ArrayType;
        this.staticArraySize = type instanceof ctypes_1.ArrayType && !type.isDynamicArray && type.capacity;
        if (this.isArray) {
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(valueNode);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, ctypes_1.NumberVarType));
        }
    }
    CConcatValue = __decorate([
        template_1.CodeTemplate("\n{#if staticArraySize}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++)\n        {varAccess}->data[{indexVarName}++] = {value}[{iteratorVarName}];\n{#elseif isArray}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {value}->size; {iteratorVarName}++)\n        {varAccess}->data[{indexVarName}++] = {value}->data[{iteratorVarName}];\n{#else}\n    {varAccess}->data[{indexVarName}++] = {value};\n{/if}\n")
    ], CConcatValue);
    return CConcatValue;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],16:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var ctypes_1 = require("../../types/ctypes");
var elementaccess_1 = require("../../nodes/elementaccess");
var template_1 = require("../../template");
var variable_1 = require("../../nodes/variable");
var standard_1 = require("../../standard");
var ArrayForEachResolver = /** @class */ (function () {
    function ArrayForEachResolver() {
    }
    ArrayForEachResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "forEach" && objType instanceof ctypes_1.ArrayType;
    };
    ArrayForEachResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.NumberVarType;
    };
    ArrayForEachResolver.prototype.createTemplate = function (scope, node) {
        return new CArrayForEach(scope, node);
    };
    ArrayForEachResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ArrayForEachResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    ArrayForEachResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return node;
    };
    ArrayForEachResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArrayForEachResolver);
    return ArrayForEachResolver;
}());
var CArrayForEach = /** @class */ (function (_super) {
    __extends(CArrayForEach, _super);
    function CArrayForEach(scope, call) {
        var _this = _super.call(this) || this;
        _this.variables = [];
        _this.statements = [];
        _this.iteratorFnAccess = null;
        _this.arraySize = '';
        _this.parent = scope;
        _this.func = scope.func;
        _this.root = scope.root;
        var propAccess = call.expression;
        var objType = scope.root.typeHelper.getCType(propAccess.expression);
        _this.varAccess = template_1.CodeTemplateFactory.templateToString(new elementaccess_1.CElementAccess(scope, propAccess.expression));
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        _this.iteratorVarName = scope.root.symbolsHelper.addIterator(call);
        _this.arraySize = objType.isDynamicArray ? _this.varAccess + "->size" : objType.capacity + "";
        var iteratorFunc = call.arguments[0];
        scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
        _this.paramName = iteratorFunc.parameters[0].name.text;
        iteratorFunc.body.statements.forEach(function (s) { return _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, s)); });
        _this.variables.push(new variable_1.CVariable(scope, _this.paramName, objType.elementType));
        return _this;
    }
    CArrayForEach = __decorate([
        template_1.CodeTemplate("\nfor ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n    {variables {   }=> {this};\n}\n    {paramName} = {varAccess}[{iteratorVarName}];\n    {statements {    }=> {this}}\n}\n")
    ], CArrayForEach);
    return CArrayForEach;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],17:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var expressions_1 = require("../../nodes/expressions");
var ArrayIndexOfResolver = /** @class */ (function () {
    function ArrayIndexOfResolver() {
    }
    ArrayIndexOfResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "indexOf" && objType instanceof ctypes_1.ArrayType;
    };
    ArrayIndexOfResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.NumberVarType;
    };
    ArrayIndexOfResolver.prototype.createTemplate = function (scope, node) {
        return new CArrayIndexOf(scope, node);
    };
    ArrayIndexOfResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ArrayIndexOfResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    ArrayIndexOfResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    ArrayIndexOfResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArrayIndexOfResolver);
    return ArrayIndexOfResolver;
}());
var CArrayIndexOf = /** @class */ (function (_super) {
    __extends(CArrayIndexOf, _super);
    function CArrayIndexOf(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.staticArraySize = '';
        _this.varAccess = null;
        var propAccess = call.expression;
        var objType = scope.root.typeHelper.getCType(propAccess.expression);
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            _this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_pos");
            _this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
            _this.staticArraySize = objType.isDynamicArray ? "" : objType.capacity + "";
            scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, ctypes_1.NumberVarType));
            scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
            // Synthesize binary node that represents comparison expression
            var iteratorIdent = ts.createIdentifier(_this.iteratorVarName);
            var arrayElement = ts.createElementAccess(propAccess.expression, iteratorIdent);
            var comparison = ts.createBinary(arrayElement, ts.SyntaxKind.EqualsEqualsToken, call.arguments[0]);
            iteratorIdent.parent = arrayElement;
            arrayElement.parent = comparison;
            scope.root.typeHelper.registerSyntheticNode(iteratorIdent, ctypes_1.NumberVarType);
            scope.root.typeHelper.registerSyntheticNode(arrayElement, objType.elementType);
            scope.root.typeHelper.registerSyntheticNode(comparison, ctypes_1.BooleanVarType);
            _this.comparison = new expressions_1.CBinaryExpression(scope, comparison);
            scope.root.headerFlags.array = true;
        }
        return _this;
    }
    CArrayIndexOf = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && staticArraySize}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {#elseif !topExpressionOfStatement}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayIndexOf);
    return CArrayIndexOf;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/expressions":5,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],18:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var literals_1 = require("../../nodes/literals");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayConcatResolver = /** @class */ (function () {
    function ArrayConcatResolver() {
    }
    ArrayConcatResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return (propAccess.name.getText() == "join" || propAccess.name.getText() == "toString") && objType instanceof ctypes_1.ArrayType;
    };
    ArrayConcatResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.StringVarType;
    };
    ArrayConcatResolver.prototype.createTemplate = function (scope, node) {
        return new CArrayJoin(scope, node);
    };
    ArrayConcatResolver.prototype.needsDisposal = function (typeHelper, node) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    };
    ArrayConcatResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "tmp_joined_string";
    };
    ArrayConcatResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    ArrayConcatResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArrayConcatResolver);
    return ArrayConcatResolver;
}());
var CArrayJoin = /** @class */ (function (_super) {
    __extends(CArrayJoin, _super);
    function CArrayJoin(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.varAccess = null;
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            var propAccess = call.expression;
            var type = scope.root.typeHelper.getCType(propAccess.expression);
            _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
            _this.arraySize = new elementaccess_1.CArraySize(scope, _this.varAccess, type);
            _this.iteratorVarName = scope.root.symbolsHelper.addIterator(call);
            scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
            _this.arrayElement = new elementaccess_1.CSimpleElementAccess(scope, type, _this.varAccess, _this.iteratorVarName);
            _this.catFuncName = type.elementType == ctypes_1.NumberVarType ? "str_int16_t_cat" : "strcat";
            _this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, "char *"));
            _this.calculatedStringLength = new CCalculateStringSize(scope, _this.varAccess, _this.iteratorVarName, type, call);
            if (call.arguments.length > 0 && propAccess.name.getText() == "join")
                _this.separator = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
            else
                _this.separator = new literals_1.CString(scope, ',');
            scope.root.headerFlags.malloc = true;
            scope.root.headerFlags.strings = true;
            if (type.isDynamicArray)
                scope.root.headerFlags.array = true;
            if (type.elementType == ctypes_1.NumberVarType)
                scope.root.headerFlags.str_int16_t_cat = true;
        }
        return _this;
    }
    CArrayJoin = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {tempVarName} = malloc({calculatedStringLength});\n        assert({tempVarName} != NULL);\n        ((char *){tempVarName})[0] = '\\0';\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n            if ({iteratorVarName} > 0)\n                strcat((char *){tempVarName}, {separator});\n            {catFuncName}((char *){tempVarName}, {arrayElement});\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayJoin);
    return CArrayJoin;
}(template_1.CTemplateBase));
var CCalculateStringSize = /** @class */ (function () {
    function CCalculateStringSize(scope, varAccess, iteratorVarName, type, node) {
        this.varAccess = varAccess;
        this.iteratorVarName = iteratorVarName;
        this.type = type;
        this.arrayOfStrings = type.elementType == ctypes_1.StringVarType;
        this.arrayOfNumbers = type.elementType == ctypes_1.NumberVarType;
        this.arrayCapacity = type.capacity + "";
        this.arraySize = new elementaccess_1.CArraySize(scope, this.varAccess, type);
        this.arrayElement = new elementaccess_1.CSimpleElementAccess(scope, type, varAccess, iteratorVarName);
        if (this.arrayOfStrings) {
            this.lengthVarName = scope.root.symbolsHelper.addTemp(node, "len");
            scope.variables.push(new variable_1.CVariable(scope, this.lengthVarName, ctypes_1.NumberVarType));
        }
    }
    CCalculateStringSize = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if arrayOfStrings}\n        {lengthVarName} = 0;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)\n            {lengthVarName} += strlen({arrayElement});\n    {/if}\n{/statements}\n{#if type.isDynamicArray && arrayOfStrings}\n    {arraySize} == 0 ? 1 : {lengthVarName} + strlen({separator})*({arraySize}-1) + 1\n{#elseif arrayCapacity > 0 && arrayOfStrings}\n    {lengthVarName} + strlen({separator})*({arraySize}-1) + 1\n{#elseif type.isDynamicArray && arrayOfNumbers}\n    {varAccess}->size == 0 ? 1 : STR_INT16_T_BUFLEN*{varAccess}->size + strlen({separator})*({arraySize}-1) + 1\n{#elseif arrayCapacity > 0 && arrayOfNumbers}\n    STR_INT16_T_BUFLEN*{arraySize}+strlen({separator})*({arraySize}-1)+1\n{#else}\n    1\n{/if}")
    ], CCalculateStringSize);
    return CCalculateStringSize;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/literals":7,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],19:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var expressions_1 = require("../../nodes/expressions");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayLastIndexOfResolver = /** @class */ (function () {
    function ArrayLastIndexOfResolver() {
    }
    ArrayLastIndexOfResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "lastIndexOf" && objType instanceof ctypes_1.ArrayType;
    };
    ArrayLastIndexOfResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.NumberVarType;
    };
    ArrayLastIndexOfResolver.prototype.createTemplate = function (scope, node) {
        return new CArrayLastIndexOf(scope, node);
    };
    ArrayLastIndexOfResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ArrayLastIndexOfResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    ArrayLastIndexOfResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    ArrayLastIndexOfResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArrayLastIndexOfResolver);
    return ArrayLastIndexOfResolver;
}());
var CArrayLastIndexOf = /** @class */ (function (_super) {
    __extends(CArrayLastIndexOf, _super);
    function CArrayLastIndexOf(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.staticArraySize = '';
        _this.varAccess = null;
        var propAccess = call.expression;
        var objType = scope.root.typeHelper.getCType(propAccess.expression);
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            _this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_pos");
            _this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
            _this.staticArraySize = objType.isDynamicArray ? "" : objType.capacity + "";
            scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, ctypes_1.NumberVarType));
            scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
            // Synthesize binary node that represents comparison expression
            var iteratorIdent = ts.createIdentifier(_this.iteratorVarName);
            var arrayElement = ts.createElementAccess(propAccess.expression, iteratorIdent);
            var comparison = ts.createBinary(arrayElement, ts.SyntaxKind.EqualsEqualsToken, call.arguments[0]);
            iteratorIdent.parent = arrayElement;
            arrayElement.parent = comparison;
            scope.root.typeHelper.registerSyntheticNode(iteratorIdent, ctypes_1.NumberVarType);
            scope.root.typeHelper.registerSyntheticNode(arrayElement, objType.elementType);
            scope.root.typeHelper.registerSyntheticNode(comparison, ctypes_1.BooleanVarType);
            _this.comparison = new expressions_1.CBinaryExpression(scope, comparison);
            scope.root.headerFlags.array = true;
        }
        return _this;
    }
    CArrayLastIndexOf = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && staticArraySize}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = {staticArraySize} - 1; {iteratorVarName} >= 0; {iteratorVarName}--) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {#elseif !topExpressionOfStatement}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = {varAccess}->size - 1; {iteratorVarName} >= 0; {iteratorVarName}--) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayLastIndexOf);
    return CArrayLastIndexOf;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/expressions":5,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],20:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayPopResolver = /** @class */ (function () {
    function ArrayPopResolver() {
    }
    ArrayPopResolver.prototype.matchesNode = function (typeHelper, call, options) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "pop" && (objType instanceof ctypes_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArrayPopResolver.prototype.objectType = function (typeHelper, call) {
        return new ctypes_1.ArrayType(ctypes_1.PointerVarType, 0, true);
    };
    ArrayPopResolver.prototype.returnType = function (typeHelper, call) {
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return objType.elementType;
    };
    ArrayPopResolver.prototype.createTemplate = function (scope, node) {
        return new CArrayPop(scope, node);
    };
    ArrayPopResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ArrayPopResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    ArrayPopResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    ArrayPopResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArrayPopResolver);
    return ArrayPopResolver;
}());
var CArrayPop = /** @class */ (function (_super) {
    __extends(CArrayPop, _super);
    function CArrayPop(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.varAccess = null;
        var propAccess = call.expression;
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_pop = true;
        return _this;
    }
    CArrayPop = __decorate([
        template_1.CodeTemplate("ARRAY_POP({varAccess})")
    ], CArrayPop);
    return CArrayPop;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":43,"../../types/ctypes":44}],21:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var typeconvert_1 = require("../../nodes/typeconvert");
var ArrayPushResolver = /** @class */ (function () {
    function ArrayPushResolver() {
    }
    ArrayPushResolver.prototype.matchesNode = function (typeHelper, call, options) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "push" && (objType && objType instanceof ctypes_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArrayPushResolver.prototype.objectType = function (typeHelper, call) {
        var elementType = call.arguments[0] && typeHelper.getCType(call.arguments[0]);
        return new ctypes_1.ArrayType(elementType || ctypes_1.PointerVarType, 0, true);
    };
    ArrayPushResolver.prototype.argumentTypes = function (typeHelper, call) {
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return call.arguments.map(function (a) { return objType instanceof ctypes_1.ArrayType ? objType.elementType : null; });
    };
    ArrayPushResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.NumberVarType;
    };
    ArrayPushResolver.prototype.createTemplate = function (scope, node) {
        return new CArrayPush(scope, node);
    };
    ArrayPushResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ArrayPushResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    ArrayPushResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return node.expression.expression;
    };
    ArrayPushResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArrayPushResolver);
    return ArrayPushResolver;
}());
var CArrayPush = /** @class */ (function (_super) {
    __extends(CArrayPush, _super);
    function CArrayPush(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.varAccess = null;
        _this.pushValues = [];
        var propAccess = call.expression;
        var type = scope.root.typeHelper.getCType(propAccess.expression);
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return type.elementType === ctypes_1.UniversalVarType ? new typeconvert_1.CAsUniversalVar(scope, a) : template_1.CodeTemplateFactory.createForNode(scope, a); });
        _this.pushValues = args.map(function (a) { return new CPushValue(scope, _this.varAccess, a); });
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            _this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_size");
            scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, ctypes_1.NumberVarType));
        }
        scope.root.headerFlags.array = true;
        return _this;
    }
    CArrayPush = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {pushValues}\n        {tempVarName} = {varAccess}->size;\n    {/if}\n{/statements}\n{#if topExpressionOfStatement}\n    {pushValues}\n{#else}\n    {tempVarName}\n{/if}")
    ], CArrayPush);
    return CArrayPush;
}(template_1.CTemplateBase));
var CPushValue = /** @class */ (function () {
    function CPushValue(scope, varAccess, value) {
        this.varAccess = varAccess;
        this.value = value;
    }
    CPushValue = __decorate([
        template_1.CodeTemplate("ARRAY_PUSH({varAccess}, {value});\n")
    ], CPushValue);
    return CPushValue;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/typeconvert":10,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],22:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArraySortResolver = /** @class */ (function () {
    function ArraySortResolver() {
    }
    ArraySortResolver.prototype.matchesNode = function (typeHelper, call, options) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "reverse" && (objType && objType instanceof ctypes_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArraySortResolver.prototype.objectType = function (typeHelper, call) {
        return new ctypes_1.ArrayType(ctypes_1.PointerVarType, 0, true);
    };
    ArraySortResolver.prototype.returnType = function (typeHelper, call) {
        var propAccess = call.expression;
        return typeHelper.getCType(propAccess.expression);
    };
    ArraySortResolver.prototype.createTemplate = function (scope, node) {
        return new CArrayReverse(scope, node);
    };
    ArraySortResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ArraySortResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "";
    };
    ArraySortResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    ArraySortResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArraySortResolver);
    return ArraySortResolver;
}());
var CArrayReverse = /** @class */ (function (_super) {
    __extends(CArrayReverse, _super);
    function CArrayReverse(scope, call) {
        var _this = _super.call(this) || this;
        _this.varAccess = null;
        var propAccess = call.expression;
        var type = scope.root.typeHelper.getCType(propAccess.expression);
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        _this.iteratorVar1 = scope.root.symbolsHelper.addIterator(call);
        _this.iteratorVar2 = scope.root.symbolsHelper.addIterator(call);
        _this.tempVarName = scope.root.symbolsHelper.addTemp(call, "temp");
        scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVar1, ctypes_1.NumberVarType));
        scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVar2, ctypes_1.NumberVarType));
        scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, type.elementType));
        return _this;
    }
    CArrayReverse = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {iteratorVar1} = 0;\n    {iteratorVar2} = {varAccess}->size - 1;\n    while ({iteratorVar1} < {iteratorVar2}) {\n        {tempVarName} = {varAccess}->data[{iteratorVar1}];\n        {varAccess}->data[{iteratorVar1}] = {varAccess}->data[{iteratorVar2}];\n        {varAccess}->data[{iteratorVar2}] = {tempVarName};\n        {iteratorVar1}++;\n        {iteratorVar2}--;\n    }\n{/statements}\n{#if !topExpressionOfStatement}\n    {varAccess}\n{/if}")
    ], CArrayReverse);
    return CArrayReverse;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],23:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayShiftResolver = /** @class */ (function () {
    function ArrayShiftResolver() {
    }
    ArrayShiftResolver.prototype.matchesNode = function (typeHelper, call, options) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "shift" && (objType && objType instanceof ctypes_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArrayShiftResolver.prototype.objectType = function (typeHelper, call) {
        return new ctypes_1.ArrayType(ctypes_1.PointerVarType, 0, true);
    };
    ArrayShiftResolver.prototype.returnType = function (typeHelper, call) {
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return objType.elementType;
    };
    ArrayShiftResolver.prototype.createTemplate = function (scope, node) {
        return new CArrayShift(scope, node);
    };
    ArrayShiftResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ArrayShiftResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    ArrayShiftResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    ArrayShiftResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArrayShiftResolver);
    return ArrayShiftResolver;
}());
var CArrayShift = /** @class */ (function (_super) {
    __extends(CArrayShift, _super);
    function CArrayShift(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.varAccess = null;
        var propAccess = call.expression;
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        _this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "value");
        var type = scope.root.typeHelper.getCType(propAccess.expression);
        scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, type.elementType));
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_remove = true;
        return _this;
    }
    CArrayShift = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {tempVarName} = {varAccess}->data[0];\n    ARRAY_REMOVE({varAccess}, 0, 1);\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayShift);
    return CArrayShift;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],24:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArraySliceResolver = /** @class */ (function () {
    function ArraySliceResolver() {
    }
    ArraySliceResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "slice" && objType instanceof ctypes_1.ArrayType;
    };
    ArraySliceResolver.prototype.returnType = function (typeHelper, call) {
        var _a = getSliceParams(typeHelper, call), size = _a.size, dynamic = _a.dynamic, elementType = _a.elementType;
        return new ctypes_1.ArrayType(elementType, size, dynamic);
    };
    ArraySliceResolver.prototype.createTemplate = function (scope, node) {
        return new CArraySlice(scope, node);
    };
    ArraySliceResolver.prototype.needsDisposal = function (typeHelper, call) {
        var dynamic = getSliceParams(typeHelper, call).dynamic;
        return call.parent.kind != ts.SyntaxKind.ExpressionStatement && dynamic;
    };
    ArraySliceResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "tmp_slice";
    };
    ArraySliceResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    ArraySliceResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArraySliceResolver);
    return ArraySliceResolver;
}());
var CArraySlice = /** @class */ (function (_super) {
    __extends(CArraySlice, _super);
    function CArraySlice(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.iteratorVarName = '';
        _this.sizeVarName = '';
        _this.startVarName = '';
        _this.endVarName = '';
        _this.simpleSlice = false;
        _this.simpleSliceSize = 0;
        _this.simpleSliceStart = 0;
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (_this.topExpressionOfStatement)
            return _this;
        var propAccess = call.expression;
        var varType = scope.root.typeHelper.getCType(propAccess.expression);
        var varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        _this.arraySize = new elementaccess_1.CSimpleElementAccess(scope, varType, varAccess, "length");
        _this.arrayDataAccess = new CArrayDataAccess(scope, varAccess, varType.isDynamicArray);
        _this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
        scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        _this.startIndexArg = args[0];
        _this.endIndexArg = args.length == 2 ? args[1] : null;
        var _a = getSliceParams(scope.root.typeHelper, call), start = _a.start, size = _a.size, dynamic = _a.dynamic;
        if (!dynamic) {
            _this.simpleSlice = true;
            _this.simpleSliceStart = start;
            _this.simpleSliceSize = size;
            var reuseVariable = tryReuseExistingVariable(call);
            if (reuseVariable)
                _this.tempVarName = reuseVariable.getText();
            else {
                _this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "tmp_slice");
                scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, new ctypes_1.ArrayType(varType.elementType, _this.simpleSliceSize, false)));
            }
            return _this;
        }
        _this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
        var arrayType = scope.root.typeHelper.getCType(propAccess.expression);
        var tempVarType = new ctypes_1.ArrayType(arrayType.elementType, 0, true);
        if (!scope.root.memoryManager.variableWasReused(call))
            scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, tempVarType));
        _this.sizeVarName = scope.root.symbolsHelper.addTemp(propAccess, _this.tempVarName + "_size");
        scope.variables.push(new variable_1.CVariable(scope, _this.sizeVarName, ctypes_1.NumberVarType));
        _this.startVarName = scope.root.symbolsHelper.addTemp(propAccess, _this.tempVarName + "_start");
        scope.variables.push(new variable_1.CVariable(scope, _this.startVarName, ctypes_1.NumberVarType));
        if (args.length == 2) {
            _this.endVarName = scope.root.symbolsHelper.addTemp(propAccess, _this.tempVarName + "_end");
            scope.variables.push(new variable_1.CVariable(scope, _this.endVarName, ctypes_1.NumberVarType));
        }
        scope.root.headerFlags.array = true;
        return _this;
    }
    CArraySlice = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && simpleSlice }\n        for ({iteratorVarName} = 0; {iteratorVarName} < {simpleSliceSize}; {iteratorVarName}++)\n            {tempVarName}[{iteratorVarName}] = {arrayDataAccess}[{iteratorVarName} + {simpleSliceStart}];\n    {#elseif !topExpressionOfStatement && !simpleSlice && !endIndexArg}\n        {sizeVarName} = ({startIndexArg}) < 0 ? -({startIndexArg}) : {arraySize} - ({startIndexArg});\n        {startVarName} = ({startIndexArg}) < 0 ? {arraySize} + ({startIndexArg}) : ({startIndexArg});\n        ARRAY_CREATE({tempVarName}, {sizeVarName}, {sizeVarName});\n        for ({iteratorVarName} = 0; {iteratorVarName} < {sizeVarName}; {iteratorVarName}++)\n            {tempVarName}->data[{iteratorVarName}] = {arrayDataAccess}[{iteratorVarName} + {startVarName}];\n    {#elseif !topExpressionOfStatement && !simpleSlice && endIndexArg}\n        {startVarName} = ({startIndexArg}) < 0 ? {arraySize} + ({startIndexArg}) : ({startIndexArg});\n        {endVarName} = ({endIndexArg}) < 0 ? {arraySize} + ({endIndexArg}) : ({endIndexArg});\n        {sizeVarName} = {endVarName} - {startVarName};\n        ARRAY_CREATE({tempVarName}, {sizeVarName}, {sizeVarName});\n        for ({iteratorVarName} = 0; {iteratorVarName} < {sizeVarName}; {iteratorVarName}++)\n            {tempVarName}->data[{iteratorVarName}] = {arrayDataAccess}[{iteratorVarName} + {startVarName}];\n    {/if}\n{/statements}\n{#if topExpressionOfStatement}\n    /* slice doesn't have side effects, skipping */\n{#else}\n    {tempVarName}\n{/if}")
    ], CArraySlice);
    return CArraySlice;
}(template_1.CTemplateBase));
var CArrayDataAccess = /** @class */ (function () {
    function CArrayDataAccess(scope, elementAccess, isDynamicArray) {
        this.elementAccess = elementAccess;
        this.isDynamicArray = isDynamicArray;
    }
    CArrayDataAccess = __decorate([
        template_1.CodeTemplate("\n{#if isDynamicArray}\n    {elementAccess}->data\n{#else}\n    {elementAccess}\n{/if}")
    ], CArrayDataAccess);
    return CArrayDataAccess;
}());
function getSliceParams(typeHelper, call) {
    var params = { start: 0, size: 0, dynamic: true, elementType: null };
    if (!ts.isPropertyAccessExpression(call.expression))
        return params;
    var objType = typeHelper.getCType(call.expression.expression);
    if (!(objType instanceof ctypes_1.ArrayType))
        return params;
    params.elementType = objType.elementType;
    var reuseVar = tryReuseExistingVariable(call);
    var reuseVarType = reuseVar && typeHelper.getCType(reuseVar);
    var reuseVarIsDynamicArray = reuseVar && reuseVarType instanceof ctypes_1.ArrayType && reuseVarType.isDynamicArray;
    var isSimpleSlice = !reuseVarIsDynamicArray && !objType.isDynamicArray && call.arguments.every(function (a) { return ts.isNumericLiteral(a) || ts.isPrefixUnaryExpression(a) && a.operator == ts.SyntaxKind.MinusToken && ts.isNumericLiteral(a.operand); });
    if (isSimpleSlice) {
        var arraySize = objType.capacity;
        var startIndexArg = +call.arguments[0].getText();
        if (call.arguments.length == 1) {
            params.start = startIndexArg < 0 ? arraySize + startIndexArg : startIndexArg;
            params.size = startIndexArg < 0 ? -startIndexArg : arraySize - startIndexArg;
        }
        else {
            var endIndexArg = +call.arguments[1].getText();
            params.start = startIndexArg < 0 ? arraySize + startIndexArg : startIndexArg;
            params.size = (endIndexArg < 0 ? arraySize + endIndexArg : endIndexArg) - params.start;
        }
        params.dynamic = params.size <= 0; // C standard doesn't allow creating static arrays with zero size, so we have to go with a dynamic array if size is 0
    }
    return params;
}
function tryReuseExistingVariable(node) {
    if (node.parent.kind == ts.SyntaxKind.BinaryExpression) {
        var assignment = node.parent;
        if (assignment.left.kind == ts.SyntaxKind.Identifier)
            return assignment.left;
    }
    if (node.parent.kind == ts.SyntaxKind.VariableDeclaration) {
        var assignment = node.parent;
        if (assignment.name.kind == ts.SyntaxKind.Identifier)
            return assignment.name;
    }
    return null;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],25:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArraySortResolver = /** @class */ (function () {
    function ArraySortResolver() {
    }
    ArraySortResolver.prototype.matchesNode = function (typeHelper, call, options) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "sort" && (objType && objType instanceof ctypes_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArraySortResolver.prototype.objectType = function (typeHelper, call) {
        return new ctypes_1.ArrayType(ctypes_1.PointerVarType, 0, true);
    };
    ArraySortResolver.prototype.returnType = function (typeHelper, call) {
        var propAccess = call.expression;
        return typeHelper.getCType(propAccess.expression);
    };
    ArraySortResolver.prototype.createTemplate = function (scope, node) {
        return new CArraySort(scope, node);
    };
    ArraySortResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ArraySortResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "";
    };
    ArraySortResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    ArraySortResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArraySortResolver);
    return ArraySortResolver;
}());
var CArraySort = /** @class */ (function (_super) {
    __extends(CArraySort, _super);
    function CArraySort(scope, call) {
        var _this = _super.call(this) || this;
        _this.varAccess = null;
        _this.arrayOfInts = false;
        _this.arrayOfStrings = false;
        var propAccess = call.expression;
        var type = scope.root.typeHelper.getCType(propAccess.expression);
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        _this.arrayOfInts = type.elementType == ctypes_1.NumberVarType;
        _this.arrayOfStrings = type.elementType == ctypes_1.StringVarType;
        if (_this.arrayOfInts)
            scope.root.headerFlags.array_int16_t_cmp = true;
        else if (_this.arrayOfStrings)
            scope.root.headerFlags.array_str_cmp = true;
        return _this;
    }
    CArraySort = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && arrayOfInts}\n        qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_int16_t_cmp);\n    {#elseif !topExpressionOfStatement && arrayOfStrings}\n        qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_str_cmp);\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {varAccess}\n{#elseif arrayOfInts}\n    qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_int16_t_cmp);\n{#elseif arrayOfStrings}\n    qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_str_cmp);\n{/if}")
    ], CArraySort);
    return CArraySort;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":43,"../../types/ctypes":44}],26:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArraySpliceResolver = /** @class */ (function () {
    function ArraySpliceResolver() {
    }
    ArraySpliceResolver.prototype.matchesNode = function (typeHelper, call, options) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "splice" && (objType && objType instanceof ctypes_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArraySpliceResolver.prototype.objectType = function (typeHelper, call) {
        return new ctypes_1.ArrayType(ctypes_1.PointerVarType, 0, true);
    };
    ArraySpliceResolver.prototype.returnType = function (typeHelper, call) {
        var propAccess = call.expression;
        return typeHelper.getCType(propAccess.expression);
    };
    ArraySpliceResolver.prototype.createTemplate = function (scope, node) {
        return new CArraySplice(scope, node);
    };
    ArraySpliceResolver.prototype.needsDisposal = function (typeHelper, node) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    };
    ArraySpliceResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "tmp_removed_values";
    };
    ArraySpliceResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return node.expression.expression;
    };
    ArraySpliceResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArraySpliceResolver);
    return ArraySpliceResolver;
}());
var CArraySplice = /** @class */ (function (_super) {
    __extends(CArraySplice, _super);
    function CArraySplice(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.varAccess = null;
        _this.insertValues = [];
        _this.needsRemove = false;
        var propAccess = call.expression;
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        _this.startPosArg = args[0];
        _this.deleteCountArg = args[1];
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            _this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            var type = scope.root.typeHelper.getCType(propAccess.expression);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, type));
            _this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
            scope.variables.push(new variable_1.CVariable(scope, _this.iteratorVarName, ctypes_1.NumberVarType));
        }
        if (call.arguments.length > 2) {
            _this.insertValues = args.slice(2).reverse().map(function (a) { return new CInsertValue(scope, _this.varAccess, _this.startPosArg, a); });
            scope.root.headerFlags.array_insert = true;
        }
        if (call.arguments[1].kind == ts.SyntaxKind.NumericLiteral) {
            _this.needsRemove = call.arguments[1].getText() != "0";
        }
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_insert = true;
        scope.root.headerFlags.array_remove = true;
        return _this;
    }
    CArraySplice = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        ARRAY_CREATE({tempVarName}, {deleteCountArg}, {deleteCountArg});\n        for ({iteratorVarName} = 0; {iteratorVarName} < {deleteCountArg}; {iteratorVarName}++)\n            {tempVarName}->data[{iteratorVarName}] = {varAccess}->data[{iteratorVarName}+(({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}))];\n        ARRAY_REMOVE({varAccess}, ({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}), {deleteCountArg});\n        {insertValues}\n    {/if}\n{/statements}\n{#if topExpressionOfStatement && needsRemove}\n    ARRAY_REMOVE({varAccess}, ({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}), {deleteCountArg});\n    {insertValues}\n{#elseif topExpressionOfStatement && !needsRemove}\n    {insertValues}\n{#else}\n    {tempVarName}\n{/if}")
    ], CArraySplice);
    return CArraySplice;
}(template_1.CTemplateBase));
var CInsertValue = /** @class */ (function () {
    function CInsertValue(scope, varAccess, startIndex, value) {
        this.varAccess = varAccess;
        this.startIndex = startIndex;
        this.value = value;
    }
    CInsertValue = __decorate([
        template_1.CodeTemplate("ARRAY_INSERT({varAccess}, {startIndex}, {value});\n")
    ], CInsertValue);
    return CInsertValue;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],27:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayUnshiftResolver = /** @class */ (function () {
    function ArrayUnshiftResolver() {
    }
    ArrayUnshiftResolver.prototype.matchesNode = function (typeHelper, call, options) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "unshift" && (objType && objType instanceof ctypes_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArrayUnshiftResolver.prototype.objectType = function (typeHelper, call) {
        var elementType = call.arguments[0] && typeHelper.getCType(call.arguments[0]);
        return new ctypes_1.ArrayType(elementType || ctypes_1.PointerVarType, 0, true);
    };
    ArrayUnshiftResolver.prototype.argumentTypes = function (typeHelper, call) {
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return call.arguments.map(function (a) { return objType instanceof ctypes_1.ArrayType ? objType.elementType : null; });
    };
    ArrayUnshiftResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.NumberVarType;
    };
    ArrayUnshiftResolver.prototype.createTemplate = function (scope, node) {
        return new CArrayUnshift(scope, node);
    };
    ArrayUnshiftResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ArrayUnshiftResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    ArrayUnshiftResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return node.expression.expression;
    };
    ArrayUnshiftResolver = __decorate([
        standard_1.StandardCallResolver
    ], ArrayUnshiftResolver);
    return ArrayUnshiftResolver;
}());
var CArrayUnshift = /** @class */ (function (_super) {
    __extends(CArrayUnshift, _super);
    function CArrayUnshift(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.varAccess = null;
        _this.unshiftValues = [];
        var propAccess = call.expression;
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        _this.unshiftValues = args.map(function (a) { return new CUnshiftValue(scope, _this.varAccess, a); });
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            _this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_size");
            scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, ctypes_1.NumberVarType));
        }
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_insert = true;
        return _this;
    }
    CArrayUnshift = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {unshiftValues}\n        {tempVarName} = {varAccess}->size;\n    {/if}\n{/statements}\n{#if topExpressionOfStatement}\n    {unshiftValues}\n{#else}\n    {tempVarName}\n{/if}")
    ], CArrayUnshift);
    return CArrayUnshift;
}(template_1.CTemplateBase));
var CUnshiftValue = /** @class */ (function (_super) {
    __extends(CUnshiftValue, _super);
    function CUnshiftValue(scope, varAccess, value) {
        var _this = _super.call(this) || this;
        _this.varAccess = varAccess;
        _this.value = value;
        return _this;
    }
    CUnshiftValue = __decorate([
        template_1.CodeTemplate("ARRAY_INSERT({varAccess}, 0, {value});\n")
    ], CUnshiftValue);
    return CUnshiftValue;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],28:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var standard_1 = require("../../standard");
var utils_1 = require("../../types/utils");
var assignment_1 = require("../../nodes/assignment");
var literals_1 = require("../../nodes/literals");
var ConsoleLogResolver = /** @class */ (function () {
    function ConsoleLogResolver() {
    }
    ConsoleLogResolver.prototype.matchesNode = function (typeHelper, call) {
        if (!ts.isPropertyAccessExpression(call.expression))
            return false;
        return call.expression.getText() == "console.log";
    };
    ConsoleLogResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.VoidType;
    };
    ConsoleLogResolver.prototype.createTemplate = function (scope, node) {
        return new CConsoleLog(scope, node);
    };
    ConsoleLogResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ConsoleLogResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    ConsoleLogResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    ConsoleLogResolver = __decorate([
        standard_1.StandardCallResolver
    ], ConsoleLogResolver);
    return ConsoleLogResolver;
}());
var CConsoleLog = /** @class */ (function (_super) {
    __extends(CConsoleLog, _super);
    function CConsoleLog(scope, node) {
        var _this = _super.call(this) || this;
        _this.printfCalls = [];
        _this.printfCall = null;
        var printfs = [];
        var printNodes = node.arguments;
        var _loop_1 = function (i_1) {
            var printNode = printNodes[i_1];
            var nodeExpressions = processBinaryExpressions(scope, printNode);
            var stringLit = '';
            nodeExpressions = nodeExpressions.reduce(function (a, c) {
                if (ts.isStringLiteral(c.node))
                    stringLit += template_1.CodeTemplateFactory.templateToString(new literals_1.CString(scope, c.node)).slice(1, -1);
                else {
                    a.push(c);
                    c.prefix = stringLit;
                    stringLit = '';
                }
                return a;
            }, []);
            if (stringLit) {
                if (nodeExpressions.length)
                    nodeExpressions[nodeExpressions.length - 1].postfix = stringLit;
                else
                    nodeExpressions.push({ node: printNode, prefix: '', postfix: '' });
            }
            for (var j = 0; j < nodeExpressions.length; j++) {
                var _a = nodeExpressions[j], node_1 = _a.node, prefix = _a.prefix, postfix = _a.postfix;
                var type = scope.root.typeHelper.getCType(node_1);
                var nodesUnder = utils_1.getAllNodesUnder(node_1);
                var hasSideEffects = nodesUnder.some(function (n) { return utils_1.isSideEffectExpression(n); });
                var accessor = "";
                if (hasSideEffects && (type instanceof ctypes_1.ArrayType || type instanceof ctypes_1.StructType || type instanceof ctypes_1.DictType || type === ctypes_1.UniversalVarType)) {
                    var tempVarName = scope.root.symbolsHelper.addTemp(node_1, "tmp_result");
                    // crutch
                    var tempVarType = type;
                    if (tempVarType instanceof ctypes_1.ArrayType && !tempVarType.isDynamicArray)
                        tempVarType = ctypes_1.getTypeText(tempVarType.elementType) + "*";
                    scope.variables.push(new variable_1.CVariable(scope, tempVarName, tempVarType));
                    printfs.push(new assignment_1.CAssignment(scope, tempVarName, null, tempVarType, node_1, false));
                    accessor = tempVarName;
                }
                else if (ts.isStringLiteral(node_1))
                    accessor = template_1.CodeTemplateFactory.templateToString(new literals_1.CString(scope, node_1)).slice(1, -1).replace(/%/g, "%%");
                else
                    accessor = template_1.CodeTemplateFactory.templateToString(template_1.CodeTemplateFactory.createForNode(scope, node_1));
                var options = {
                    prefix: (i_1 > 0 && j == 0 ? " " : "") + prefix.replace(/%/g, "%%"),
                    postfix: postfix.replace(/%/g, "%%") + (i_1 == printNodes.length - 1 && j == nodeExpressions.length - 1 ? "\\n" : "")
                };
                printfs.push(new CPrintf(scope, node_1, accessor, type, options));
            }
        };
        for (var i_1 = 0; i_1 < printNodes.length; i_1++) {
            _loop_1(i_1);
        }
        _this.printfCalls = printfs.slice(0, -1);
        _this.printfCall = printfs[printfs.length - 1];
        scope.root.headerFlags.printf = true;
        return _this;
    }
    CConsoleLog = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if printfCalls.length}\n        {printfCalls => {this}\n}\n    {/if}\n{/statements}\n{printfCall}")
    ], CConsoleLog);
    return CConsoleLog;
}(template_1.CTemplateBase));
function processBinaryExpressions(scope, printNode) {
    var type = scope.root.typeHelper.getCType(printNode);
    if (type == ctypes_1.StringVarType && ts.isBinaryExpression(printNode)) {
        var binExpr = printNode;
        if (binExpr.operatorToken.kind == ts.SyntaxKind.PlusToken) {
            var left = processBinaryExpressions(scope, binExpr.left);
            var right = processBinaryExpressions(scope, binExpr.right);
            return [].concat(left, right);
        }
    }
    return [{ node: printNode, prefix: '', postfix: '' }];
}
var CPrintf = /** @class */ (function () {
    function CPrintf(scope, printNode, accessor, varType, options) {
        var _this = this;
        this.accessor = accessor;
        this.isStringLiteral = false;
        this.quoted = false;
        this.isCString = false;
        this.isRegex = false;
        this.isInteger = false;
        this.isBoolean = false;
        this.isDict = false;
        this.isStruct = false;
        this.isArray = false;
        this.isStaticArray = false;
        this.isUniversalVar = false;
        this.elementPrintfs = [];
        this.elementFormatString = '';
        this.propPrefix = '';
        this.INDENT = '';
        this.isStringLiteral = varType == ctypes_1.StringVarType && printNode.kind == ts.SyntaxKind.StringLiteral;
        this.isCString = varType == ctypes_1.StringVarType;
        this.isRegex = varType == ctypes_1.RegexVarType;
        this.isInteger = varType == ctypes_1.NumberVarType;
        this.isBoolean = varType == ctypes_1.BooleanVarType;
        this.isUniversalVar = varType == ctypes_1.UniversalVarType;
        this.quoted = options.quotedString;
        if (this.isUniversalVar) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(printNode, "tmp_str", false);
            this.needDisposeVarName = scope.root.symbolsHelper.addTemp(printNode, "tmp_need_dispose", false);
            if (!scope.variables.some(function (v) { return v.name == _this.tempVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, ctypes_1.StringVarType));
            if (!scope.variables.some(function (v) { return v.name == _this.needDisposeVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, this.needDisposeVarName, ctypes_1.BooleanVarType));
            scope.root.headerFlags.js_var_to_str = true;
        }
        this.PREFIX = options.prefix || '';
        this.POSTFIX = options.postfix || '';
        if (options.propName)
            this.PREFIX = this.PREFIX + options.propName + ": ";
        if (options.indent)
            this.INDENT = options.indent;
        if (varType instanceof ctypes_1.ArrayType) {
            this.isArray = true;
            this.isStaticArray = !varType.isDynamicArray;
            this.elementFormatString = varType.elementType == ctypes_1.NumberVarType ? '%d'
                : varType.elementType == ctypes_1.StringVarType ? '\\"%s\\"' : '';
            this.arraySize = varType.isDynamicArray ? accessor + "->size" : varType.capacity + "";
            if (!this.isStaticArray || !this.elementFormatString || varType.capacity > 3) {
                this.iteratorVarName = scope.root.symbolsHelper.addIterator(printNode);
                scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, ctypes_1.NumberVarType));
                var elementAccessor = accessor + (varType.isDynamicArray ? "->data" : "") + "[" + this.iteratorVarName + "]";
                var opts = { quotedString: true, indent: this.INDENT + "    " };
                this.elementPrintfs = [
                    new CPrintf_1(scope, printNode, elementAccessor, varType.elementType, opts)
                ];
            }
        }
        else if (varType instanceof ctypes_1.DictType) {
            this.isDict = true;
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(printNode);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, ctypes_1.NumberVarType));
            var opts = { quotedString: true, indent: this.INDENT + "    " };
            this.elementPrintfs = [
                new CPrintf_1(scope, printNode, accessor + "->values->data[" + this.iteratorVarName + "]", varType.elementType, opts)
            ];
        }
        else if (varType instanceof ctypes_1.StructType) {
            this.isStruct = true;
            for (var k in varType.properties) {
                var opts = { quotedString: true, propName: k, indent: this.INDENT + "    " };
                if (varType.propertyDefs[k].recursive) {
                    var objString = "[object Object]";
                    var stringLit = ts.createLiteral(objString);
                    this.elementPrintfs.push(new CPrintf_1(scope, stringLit, objString, ctypes_1.StringVarType, opts));
                }
                else {
                    var propAccessor = accessor + "->" + k;
                    this.elementPrintfs.push(new CPrintf_1(scope, printNode, propAccessor, varType.properties[k], opts));
                }
            }
        }
    }
    CPrintf_1 = CPrintf;
    CPrintf = CPrintf_1 = __decorate([
        template_1.CodeTemplate("\n{#if isStringLiteral}\n    printf(\"{PREFIX}{accessor}{POSTFIX}\");\n{#elseif isCString && quoted}\n    printf(\"{PREFIX}\\\"%s\\\"{POSTFIX}\", {accessor});\n{#elseif isCString}\n    printf(\"{PREFIX}%s{POSTFIX}\", {accessor});\n{#elseif isRegex}\n    printf(\"{PREFIX}%s{POSTFIX}\", {accessor}.str);\n{#elseif isInteger}\n    printf(\"{PREFIX}%d{POSTFIX}\", {accessor});\n{#elseif isBoolean && !PREFIX && !POSTFIX}\n    printf({accessor} ? \"true\" : \"false\");\n{#elseif isBoolean && (PREFIX || POSTFIX)}\n    printf(\"{PREFIX}%s{POSTFIX}\", {accessor} ? \"true\" : \"false\");\n{#elseif isDict}\n    printf(\"{PREFIX}{ \");\n    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {accessor}->index->size; {iteratorVarName}++) {\n    {INDENT}    if ({iteratorVarName} != 0)\n    {INDENT}        printf(\", \");\n    {INDENT}    printf(\"\\\"%s\\\": \", {accessor}->index->data[{iteratorVarName}]);\n    {INDENT}    {elementPrintfs}\n    {INDENT}}\n    {INDENT}printf(\" }{POSTFIX}\");\n{#elseif isStruct}\n    printf(\"{PREFIX}{ \");\n    {INDENT}{elementPrintfs {    printf(\", \");\n    }=> {this}}\n    {INDENT}printf(\" }{POSTFIX}\");\n{#elseif isStaticArray && elementFormatString && +arraySize==1}\n    printf(\"{PREFIX}[ {elementFormatString} ]{POSTFIX}\", {accessor}[0]);\n{#elseif isStaticArray && elementFormatString && +arraySize==2}\n    printf(\"{PREFIX}[ {elementFormatString}, {elementFormatString} ]{POSTFIX}\", {accessor}[0], {accessor}[1]);\n{#elseif isStaticArray && elementFormatString && +arraySize==3}\n    printf(\"{PREFIX}[ {elementFormatString}, {elementFormatString}, {elementFormatString} ]{POSTFIX}\", {accessor}[0], {accessor}[1], {accessor}[2]);\n{#elseif isArray}\n    printf(\"{PREFIX}[ \");\n    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n    {INDENT}    if ({iteratorVarName} != 0)\n    {INDENT}        printf(\", \");\n    {INDENT}    {elementPrintfs}\n    {INDENT}}\n    {INDENT}printf(\" ]{POSTFIX}\");\n{#elseif isUniversalVar && quoted}\n    printf({accessor}.type == JS_VAR_STRING ? \"{PREFIX}\\\"%s\\\"{POSTFIX}\" : \"{PREFIX}%s{POSTFIX}\", {tempVarName} = js_var_to_str({accessor}, &{needDisposeVarName}));\n    {INDENT}if ({needDisposeVarName})\n    {INDENT}    free((void *){tempVarName});\n{#elseif isUniversalVar}\n    printf(\"{PREFIX}%s{POSTFIX}\", {tempVarName} = js_var_to_str({accessor}, &{needDisposeVarName}));\n    {INDENT}if ({needDisposeVarName})\n    {INDENT}    free((void *){tempVarName});\n{#else}\n    printf(/* Unsupported printf expression */);\n{/if}")
    ], CPrintf);
    return CPrintf;
    var CPrintf_1;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/assignment":2,"../../nodes/literals":7,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44,"../../types/utils":49}],29:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var typeconvert_1 = require("../../nodes/typeconvert");
var IsNaNResolver = /** @class */ (function () {
    function IsNaNResolver() {
    }
    IsNaNResolver.prototype.matchesNode = function (typeHelper, call) {
        return call.expression.kind === ts.SyntaxKind.Identifier && call.expression.getText() === "isNaN";
    };
    IsNaNResolver.prototype.argumentTypes = function (typeHelper, call) {
        return [ctypes_1.UniversalVarType];
    };
    IsNaNResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.BooleanVarType;
    };
    IsNaNResolver.prototype.createTemplate = function (scope, node) {
        return new CIsNaN(scope, node);
    };
    IsNaNResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    IsNaNResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    IsNaNResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    IsNaNResolver = __decorate([
        standard_1.StandardCallResolver
    ], IsNaNResolver);
    return IsNaNResolver;
}());
var CIsNaN = /** @class */ (function (_super) {
    __extends(CIsNaN, _super);
    function CIsNaN(scope, call) {
        var _this = _super.call(this) || this;
        _this.argument = null;
        _this.argument = new typeconvert_1.CAsUniversalVar(scope, call.arguments[0]);
        scope.root.headerFlags.js_var_isnan = true;
        scope.root.headerFlags.js_var_to_number = true;
        return _this;
    }
    CIsNaN = __decorate([
        template_1.CodeTemplate("js_var_isnan({argument})")
    ], CIsNaN);
    return CIsNaN;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/typeconvert":10,"../../standard":14,"../../template":43,"../../types/ctypes":44}],30:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var ParseIntResolver = /** @class */ (function () {
    function ParseIntResolver() {
    }
    ParseIntResolver.prototype.matchesNode = function (typeHelper, call) {
        return call.expression.kind === ts.SyntaxKind.Identifier && call.expression.getText() === "parseInt";
    };
    ParseIntResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.NumberVarType;
    };
    ParseIntResolver.prototype.createTemplate = function (scope, node) {
        return new CParseInt(scope, node);
    };
    ParseIntResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    ParseIntResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    ParseIntResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    ParseIntResolver = __decorate([
        standard_1.StandardCallResolver
    ], ParseIntResolver);
    return ParseIntResolver;
}());
var CParseInt = /** @class */ (function (_super) {
    __extends(CParseInt, _super);
    function CParseInt(scope, call) {
        var _this = _super.call(this) || this;
        _this.arguments = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        scope.root.headerFlags.parse_int16_t = true;
        return _this;
    }
    CParseInt = __decorate([
        template_1.CodeTemplate("parse_int16_t({arguments {, }=> {this}})")
    ], CParseInt);
    return CParseInt;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../standard":14,"../../template":43,"../../types/ctypes":44}],31:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var NumberCallResolver = /** @class */ (function () {
    function NumberCallResolver() {
    }
    NumberCallResolver.prototype.matchesNode = function (typeHelper, call) {
        return ts.isIdentifier(call.expression) && call.expression.text == "Number";
    };
    NumberCallResolver.prototype.returnType = function (typeHelper, call) {
        var type = typeHelper.getCType(call.arguments[0]);
        return type == ctypes_1.NumberVarType ? ctypes_1.NumberVarType : ctypes_1.UniversalVarType;
    };
    NumberCallResolver.prototype.createTemplate = function (scope, node) {
        return new CNumberCall(scope, node);
    };
    NumberCallResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    NumberCallResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    NumberCallResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    NumberCallResolver = __decorate([
        standard_1.StandardCallResolver
    ], NumberCallResolver);
    return NumberCallResolver;
}());
var CNumberCall = /** @class */ (function (_super) {
    __extends(CNumberCall, _super);
    function CNumberCall(scope, call) {
        var _this = _super.call(this) || this;
        _this.call = "";
        _this.arg = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
        var type = scope.root.typeHelper.getCType(call.arguments[0]);
        if (type != ctypes_1.NumberVarType && type != ctypes_1.UniversalVarType) {
            _this.call = "str_to_int16_t";
            scope.root.headerFlags.str_to_int16_t = true;
        }
        else if (type == ctypes_1.UniversalVarType) {
            _this.call = "js_var_to_number";
            scope.root.headerFlags.js_var_to_number = true;
        }
        return _this;
    }
    CNumberCall = __decorate([
        template_1.CodeTemplate("\n{#if call}\n    {call}({arg})\n{#else}\n    {arg}\n{/if}")
    ], CNumberCall);
    return CNumberCall;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../standard":14,"../../template":43,"../../types/ctypes":44}],32:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringCharAtResolver = /** @class */ (function () {
    function StringCharAtResolver() {
    }
    StringCharAtResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "charAt" && objType == ctypes_1.StringVarType;
    };
    StringCharAtResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.StringVarType;
    };
    StringCharAtResolver.prototype.createTemplate = function (scope, node) {
        return new CStringCharAt(scope, node);
    };
    StringCharAtResolver.prototype.needsDisposal = function (typeHelper, node) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    };
    StringCharAtResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "char_at";
    };
    StringCharAtResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    StringCharAtResolver = __decorate([
        standard_1.StandardCallResolver
    ], StringCharAtResolver);
    return StringCharAtResolver;
}());
var CStringCharAt = /** @class */ (function (_super) {
    __extends(CStringCharAt, _super);
    function CStringCharAt(scope, call) {
        var _this = _super.call(this) || this;
        _this.varAccess = null;
        _this.start = null;
        var propAccess = call.expression;
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            if (call.arguments.length == 0) {
                console.log("Error in " + call.getText() + ". Parameter expected!");
            }
            else {
                _this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, ctypes_1.StringVarType));
                _this.start = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
            }
        }
        scope.root.headerFlags.str_substring = true;
        return _this;
    }
    CStringCharAt = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && start != null}\n        {tempVarName} = str_substring({varAccess}, {start}, ({start}) + 1);\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement && start != null}\n    {tempVarName}\n{#elseif !topExpressionOfStatement && start == null}\n    /* Error: parameter expected for charAt */\n{/if}")
    ], CStringCharAt);
    return CStringCharAt;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],33:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringCharCodeAtResolver = /** @class */ (function () {
    function StringCharCodeAtResolver() {
    }
    StringCharCodeAtResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "charCodeAt" && objType == ctypes_1.StringVarType;
    };
    StringCharCodeAtResolver.prototype.objectType = function (typeHelper, call) {
        return ctypes_1.StringVarType;
    };
    StringCharCodeAtResolver.prototype.argumentTypes = function (typeHelper, call) {
        return call.arguments.map(function (a, i) { return i == 0 ? ctypes_1.NumberVarType : null; });
    };
    StringCharCodeAtResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.NumberVarType;
    };
    StringCharCodeAtResolver.prototype.createTemplate = function (scope, node) {
        return new CStringSearch(scope, node);
    };
    StringCharCodeAtResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    StringCharCodeAtResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    StringCharCodeAtResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    StringCharCodeAtResolver = __decorate([
        standard_1.StandardCallResolver
    ], StringCharCodeAtResolver);
    return StringCharCodeAtResolver;
}());
var CStringSearch = /** @class */ (function (_super) {
    __extends(CStringSearch, _super);
    function CStringSearch(scope, call) {
        var _this = _super.call(this) || this;
        var propAccess = call.expression;
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                _this.strAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                _this.position = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                scope.root.headerFlags.str_char_code_at = true;
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
        return _this;
    }
    CStringSearch = __decorate([
        template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    str_char_code_at({strAccess}, {position})\n{/if}")
    ], CStringSearch);
    return CStringSearch;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":43,"../../types/ctypes":44}],34:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringConcatResolver = /** @class */ (function () {
    function StringConcatResolver() {
    }
    StringConcatResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "concat" && objType == ctypes_1.StringVarType;
    };
    StringConcatResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.StringVarType;
    };
    StringConcatResolver.prototype.createTemplate = function (scope, node) {
        return new CStringConcat(scope, node);
    };
    StringConcatResolver.prototype.needsDisposal = function (typeHelper, node) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    };
    StringConcatResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "concatenated_str";
    };
    StringConcatResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    StringConcatResolver = __decorate([
        standard_1.StandardCallResolver
    ], StringConcatResolver);
    return StringConcatResolver;
}());
var CStringConcat = /** @class */ (function (_super) {
    __extends(CStringConcat, _super);
    function CStringConcat(scope, call) {
        var _this = _super.call(this) || this;
        _this.tempVarName = '';
        _this.varAccess = null;
        _this.concatValues = [];
        _this.sizes = [];
        var propAccess = call.expression;
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            _this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, "char *"));
            var args = call.arguments.map(function (a) { return ({ node: a, template: template_1.CodeTemplateFactory.createForNode(scope, a) }); });
            var toConcatenate = [{ node: propAccess.expression, template: _this.varAccess }].concat(args);
            _this.sizes = toConcatenate.map(function (a) { return new CGetSize(scope, a.node, a.template); });
            _this.concatValues = toConcatenate.map(function (a) { return new CConcatValue(scope, _this.tempVarName, a.node, a.template); });
        }
        scope.root.headerFlags.strings = true;
        scope.root.headerFlags.malloc = true;
        scope.root.headerFlags.str_int16_t_cat = true;
        return _this;
    }
    CStringConcat = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {tempVarName} = malloc({sizes{+}=>{this}} + 1);\n        assert({tempVarName} != NULL);\n        ((char *){tempVarName})[0] = '\\0';\n        {concatValues}\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CStringConcat);
    return CStringConcat;
}(template_1.CTemplateBase));
var CGetSize = /** @class */ (function () {
    function CGetSize(scope, valueNode, value) {
        this.value = value;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isNumber = type == ctypes_1.NumberVarType;
    }
    CGetSize = __decorate([
        template_1.CodeTemplate("\n{#if isNumber}\n    STR_INT16_T_BUFLEN\n{#else}\n    strlen({value})\n{/if}")
    ], CGetSize);
    return CGetSize;
}());
var CConcatValue = /** @class */ (function () {
    function CConcatValue(scope, tempVarName, valueNode, value) {
        this.tempVarName = tempVarName;
        this.value = value;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isNumber = type == ctypes_1.NumberVarType;
    }
    CConcatValue = __decorate([
        template_1.CodeTemplate("\n{#if isNumber}\n    str_int16_t_cat((char *){tempVarName}, {value});\n{#else}\n    strcat((char *){tempVarName}, {value});\n{/if}\n")
    ], CConcatValue);
    return CConcatValue;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],35:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringIndexOfResolver = /** @class */ (function () {
    function StringIndexOfResolver() {
    }
    StringIndexOfResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "indexOf" && objType == ctypes_1.StringVarType;
    };
    StringIndexOfResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.NumberVarType;
    };
    StringIndexOfResolver.prototype.createTemplate = function (scope, node) {
        return new CStringIndexOf(scope, node);
    };
    StringIndexOfResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    StringIndexOfResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    StringIndexOfResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    StringIndexOfResolver = __decorate([
        standard_1.StandardCallResolver
    ], StringIndexOfResolver);
    return StringIndexOfResolver;
}());
var CStringIndexOf = /** @class */ (function (_super) {
    __extends(CStringIndexOf, _super);
    function CStringIndexOf(scope, call) {
        var _this = _super.call(this) || this;
        var propAccess = call.expression;
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                _this.stringAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                _this.arg1 = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                scope.root.headerFlags.str_pos = true;
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
        return _this;
    }
    CStringIndexOf = __decorate([
        template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    str_pos({stringAccess}, {arg1})\n{/if}")
    ], CStringIndexOf);
    return CStringIndexOf;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":43,"../../types/ctypes":44}],36:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringIndexOfResolver = /** @class */ (function () {
    function StringIndexOfResolver() {
    }
    StringIndexOfResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "lastIndexOf" && objType == ctypes_1.StringVarType;
    };
    StringIndexOfResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.NumberVarType;
    };
    StringIndexOfResolver.prototype.createTemplate = function (scope, node) {
        return new CStringIndexOf(scope, node);
    };
    StringIndexOfResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    StringIndexOfResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    StringIndexOfResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    StringIndexOfResolver = __decorate([
        standard_1.StandardCallResolver
    ], StringIndexOfResolver);
    return StringIndexOfResolver;
}());
var CStringIndexOf = /** @class */ (function (_super) {
    __extends(CStringIndexOf, _super);
    function CStringIndexOf(scope, call) {
        var _this = _super.call(this) || this;
        var propAccess = call.expression;
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                _this.stringAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                _this.arg1 = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                scope.root.headerFlags.str_rpos = true;
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
        return _this;
    }
    CStringIndexOf = __decorate([
        template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    str_rpos({stringAccess}, {arg1})\n{/if}")
    ], CStringIndexOf);
    return CStringIndexOf;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":43,"../../types/ctypes":44}],37:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringMatchResolver = /** @class */ (function () {
    function StringMatchResolver() {
    }
    StringMatchResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "match" && objType == ctypes_1.StringVarType;
    };
    StringMatchResolver.prototype.objectType = function (typeHelper, call) {
        return ctypes_1.StringVarType;
    };
    StringMatchResolver.prototype.argumentTypes = function (typeHelper, call) {
        return call.arguments.map(function (a, i) { return i == 0 ? ctypes_1.RegexVarType : null; });
    };
    StringMatchResolver.prototype.returnType = function (typeHelper, call) {
        return new ctypes_1.ArrayType(ctypes_1.StringVarType, 1, true);
    };
    StringMatchResolver.prototype.createTemplate = function (scope, node) {
        return new CStringMatch(scope, node);
    };
    StringMatchResolver.prototype.needsDisposal = function (typeHelper, node) {
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    };
    StringMatchResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "match_array";
    };
    StringMatchResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    StringMatchResolver = __decorate([
        standard_1.StandardCallResolver
    ], StringMatchResolver);
    return StringMatchResolver;
}());
exports.StringMatchResolver = StringMatchResolver;
var CStringMatch = /** @class */ (function (_super) {
    __extends(CStringMatch, _super);
    function CStringMatch(scope, call) {
        var _this = _super.call(this) || this;
        _this.topExpressionOfStatement = false;
        _this.gcVarName = null;
        scope.root.headerFlags.str_substring = true;
        var propAccess = call.expression;
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                _this.argAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                _this.regexVar = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                _this.gcVarName = scope.root.memoryManager.getGCVariableForNode(call);
                _this.matchArrayVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new variable_1.CVariable(scope, _this.matchArrayVarName, new ctypes_1.ArrayType(ctypes_1.StringVarType, 0, true)));
                scope.root.headerFlags.regex_match = true;
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.gc_iterator = true;
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
        return _this;
    }
    CStringMatch = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {matchArrayVarName} = regex_match({regexVar}, {argAccess});\n    {/if}\n    {#if !topExpressionOfStatement && gcVarName}\n        ARRAY_PUSH({gcVarName}, (void *){matchArrayVarName});\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {matchArrayVarName}\n{/if}")
    ], CStringMatch);
    return CStringMatch;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],38:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringSearchResolver = /** @class */ (function () {
    function StringSearchResolver() {
    }
    StringSearchResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "search" && objType == ctypes_1.StringVarType;
    };
    StringSearchResolver.prototype.objectType = function (typeHelper, call) {
        return ctypes_1.StringVarType;
    };
    StringSearchResolver.prototype.argumentTypes = function (typeHelper, call) {
        return call.arguments.map(function (a, i) { return i == 0 ? ctypes_1.RegexVarType : null; });
    };
    StringSearchResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.NumberVarType;
    };
    StringSearchResolver.prototype.createTemplate = function (scope, node) {
        return new CStringSearch(scope, node);
    };
    StringSearchResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    StringSearchResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    StringSearchResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    StringSearchResolver = __decorate([
        standard_1.StandardCallResolver
    ], StringSearchResolver);
    return StringSearchResolver;
}());
var CStringSearch = /** @class */ (function (_super) {
    __extends(CStringSearch, _super);
    function CStringSearch(scope, call) {
        var _this = _super.call(this) || this;
        var propAccess = call.expression;
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                _this.argAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                _this.regexVar = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
        return _this;
    }
    CStringSearch = __decorate([
        template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    {regexVar}.func({argAccess}, FALSE).index\n{/if}")
    ], CStringSearch);
    return CStringSearch;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":43,"../../types/ctypes":44}],39:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringSliceResolver = /** @class */ (function () {
    function StringSliceResolver() {
    }
    StringSliceResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "slice" && objType == ctypes_1.StringVarType;
    };
    StringSliceResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.StringVarType;
    };
    StringSliceResolver.prototype.createTemplate = function (scope, node) {
        return new CStringSlice(scope, node);
    };
    StringSliceResolver.prototype.needsDisposal = function (typeHelper, node) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    };
    StringSliceResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "substr";
    };
    StringSliceResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    StringSliceResolver = __decorate([
        standard_1.StandardCallResolver
    ], StringSliceResolver);
    return StringSliceResolver;
}());
var CStringSlice = /** @class */ (function (_super) {
    __extends(CStringSlice, _super);
    function CStringSlice(scope, call) {
        var _this = _super.call(this) || this;
        _this.varAccess = null;
        _this.start = null;
        _this.end = null;
        var propAccess = call.expression;
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            if (call.arguments.length == 0) {
                console.log("Error in " + call.getText() + ". At least one parameter expected!");
            }
            else {
                _this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, ctypes_1.StringVarType));
                _this.start = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                if (call.arguments.length >= 2)
                    _this.end = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[1]);
            }
        }
        scope.root.headerFlags.str_slice = true;
        return _this;
    }
    CStringSlice = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && start && end}\n        {tempVarName} = str_slice({varAccess}, {start}, {end});\n    {#elseif !topExpressionOfStatement && start && !end}\n        {tempVarName} = str_slice({varAccess}, {start}, str_len({varAccess}));\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement && start}\n    {tempVarName}\n{#elseif !topExpressionOfStatement && !start}\n    /* Error: String.slice requires at least one parameter! */\n{/if}")
    ], CStringSlice);
    return CStringSlice;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],40:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringSubstringResolver = /** @class */ (function () {
    function StringSubstringResolver() {
    }
    StringSubstringResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "substring" && objType == ctypes_1.StringVarType;
    };
    StringSubstringResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.StringVarType;
    };
    StringSubstringResolver.prototype.createTemplate = function (scope, node) {
        return new CStringSubstring(scope, node);
    };
    StringSubstringResolver.prototype.needsDisposal = function (typeHelper, node) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    };
    StringSubstringResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "substr";
    };
    StringSubstringResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    StringSubstringResolver = __decorate([
        standard_1.StandardCallResolver
    ], StringSubstringResolver);
    return StringSubstringResolver;
}());
var CStringSubstring = /** @class */ (function (_super) {
    __extends(CStringSubstring, _super);
    function CStringSubstring(scope, call) {
        var _this = _super.call(this) || this;
        _this.varAccess = null;
        _this.start = null;
        _this.end = null;
        var propAccess = call.expression;
        _this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        _this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!_this.topExpressionOfStatement) {
            if (call.arguments.length == 0) {
                console.log("Error in " + call.getText() + ". At least one parameter expected!");
            }
            else {
                _this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new variable_1.CVariable(scope, _this.tempVarName, ctypes_1.StringVarType));
                _this.start = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                if (call.arguments.length >= 2)
                    _this.end = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[1]);
            }
        }
        scope.root.headerFlags.str_substring = true;
        return _this;
    }
    CStringSubstring = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && start && end}\n        {tempVarName} = str_substring({varAccess}, {start}, {end});\n    {#elseif !topExpressionOfStatement && start && !end}\n        {tempVarName} = str_substring({varAccess}, {start}, str_len({varAccess}));\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement && start}\n    {tempVarName}\n{#elseif !topExpressionOfStatement && !start}\n    /* Error: String.substring requires at least one parameter! */\n{/if}")
    ], CStringSubstring);
    return CStringSubstring;
}(template_1.CTemplateBase));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":43,"../../types/ctypes":44}],41:[function(require,module,exports){
(function (global){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../../template");
var standard_1 = require("../../standard");
var ctypes_1 = require("../../types/ctypes");
var StringToStringResolver = /** @class */ (function () {
    function StringToStringResolver() {
    }
    StringToStringResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return ["toString", "valueOf"].indexOf(propAccess.name.getText()) > -1 && objType == ctypes_1.StringVarType;
    };
    StringToStringResolver.prototype.returnType = function (typeHelper, call) {
        return ctypes_1.StringVarType;
    };
    StringToStringResolver.prototype.createTemplate = function (scope, node) {
        return template_1.CodeTemplateFactory.createForNode(scope, node.expression);
    };
    StringToStringResolver.prototype.needsDisposal = function (typeHelper, node) {
        return false;
    };
    StringToStringResolver.prototype.getTempVarName = function (typeHelper, node) {
        return null;
    };
    StringToStringResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    StringToStringResolver = __decorate([
        standard_1.StandardCallResolver
    ], StringToStringResolver);
    return StringToStringResolver;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../standard":14,"../../template":43,"../../types/ctypes":44}],42:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var ctypes_1 = require("./types/ctypes");
var utils_1 = require("./types/utils");
var SymbolsHelper = /** @class */ (function () {
    function SymbolsHelper(typeChecker, typeHelper) {
        this.typeChecker = typeChecker;
        this.typeHelper = typeHelper;
        this.userStructs = {};
        this.arrayStructs = [];
        this.temporaryVariables = {
            // reserved symbols that are used in program.ts
            "main": [
                "TRUE", "FALSE", "uint8_t", "int16_t",
                "regex_indices_struct_t", "regex_match_struct_t", "regex_func_t",
                "ARRAY", "ARRAY_CREATE", "ARRAY_PUSH", "ARRAY_INSERT", "ARRAY_REMOVE", "ARRAY_POP",
                "DICT", "DICT_CREATE", "DICT_SET", "DICT_GET", "dict_find_pos", "tmp_dict_pos", "tmp_dict_pos2",
                "STR_INT16_T_BUFLEN", "str_int16_t_cmp", "str_pos", "str_rpos", "str_len",
                "str_char_code_at", "str_substring", "str_slice", "str_int16_t_cat",
                "array_int16_t_cmp", "array_str_cmp", "parse_int16_t",
                "js_var_type", "js_var", "array_js_var_t", "dict_js_var_t",
                "js_var_from", "js_var_from_int16_t", "js_var_from_uint8_t", "js_var_from_str", "js_var_from_dict",
                "str_to_int16_t", "js_var_to_str", "js_var_to_number", "js_var_to_bool", "js_var_to_undefined",
                "js_var_typeof", "js_var_dict_inc", "js_var_get", "js_var_eq", "js_var_op", "js_var_compute",
                "regex_clear_matches", "regex_match",
                "gc_main", "gc_i", "gc_j"
            ]
        };
        this.iteratorVarNames = ['i', 'j', 'k', 'l', 'm', 'n'];
        this.closureVarNames = [];
        this.scopeVarNames = [];
    }
    SymbolsHelper.prototype.getStructsAndFunctionPrototypes = function () {
        var _this = this;
        for (var _i = 0, _a = this.arrayStructs; _i < _a.length; _i++) {
            var arrElemType = _a[_i];
            var elementTypeText = this.typeHelper.getTypeString(arrElemType);
            var structName = ctypes_1.ArrayType.getArrayStructName(elementTypeText);
            this.userStructs[structName] = new ctypes_1.StructType({
                size: { type: ctypes_1.NumberVarType, order: 1 },
                capacity: { type: ctypes_1.NumberVarType, order: 2 },
                data: { type: elementTypeText + "*", order: 3 }
            });
            this.userStructs[structName].structName = structName;
        }
        var structs = Object.keys(this.userStructs).filter(function (k) { return !_this.userStructs[k].external; }).map(function (k) { return ({
            name: k,
            properties: Object.keys(_this.userStructs[k].properties).map(function (pk) { return ({
                name: pk,
                type: _this.userStructs[k].properties[pk]
            }); })
        }); });
        return [structs];
    };
    SymbolsHelper.prototype.ensureClosureStruct = function (type, parentFuncType, name) {
        if (!type.structName)
            type.structName = name + "_t";
        var params = {
            func: { type: type.getText(true), order: 0 },
            scope: { type: parentFuncType.scopeType || "void *", order: 1 }
        };
        var closureStruct = new ctypes_1.StructType(params);
        var found = this.findStructByType(closureStruct);
        if (!found)
            this.userStructs[type.structName] = closureStruct;
    };
    SymbolsHelper.prototype.ensureStruct = function (structType, name) {
        if (!structType.structName)
            structType.structName = name + "_t";
        var found = this.findStructByType(structType);
        if (!found)
            this.userStructs[structType.structName] = structType;
    };
    SymbolsHelper.prototype.ensureArrayStruct = function (elementType) {
        var _this = this;
        if (this.arrayStructs.every(function (s) { return _this.typeHelper.getTypeString(s) !== _this.typeHelper.getTypeString(elementType); }))
            this.arrayStructs.push(elementType);
    };
    SymbolsHelper.prototype.findStructByType = function (structType) {
        var userStructCode = this.getStructureBodyString(structType);
        for (var s in this.userStructs) {
            if (this.getStructureBodyString(this.userStructs[s]) == userStructCode)
                return s;
        }
        return null;
    };
    SymbolsHelper.prototype.getStructureBodyString = function (structType) {
        var userStructCode = '{\n';
        for (var propName in structType.properties) {
            var propType = structType.propertyDefs[propName].type;
            if (typeof propType === 'string') {
                userStructCode += '    ' + propType + ' ' + propName + ';\n';
            }
            else if (propType instanceof ctypes_1.ArrayType) {
                var propTypeText = propType.getText();
                if (propTypeText.indexOf("{var}") > -1)
                    userStructCode += '    ' + propTypeText.replace(/^static /, '').replace("{var}", propName) + ';\n';
                else
                    userStructCode += '    ' + propTypeText + ' ' + propName + ';\n';
            }
            else {
                userStructCode += '    ' + propType.getText() + ' ' + propName + ';\n';
            }
        }
        userStructCode += "};\n";
        return userStructCode;
    };
    /** Generate name for a new iterator variable and register it in temporaryVariables table.
     * Generated name is guarantied not to conflict with any existing names in specified scope.
     */
    SymbolsHelper.prototype.addIterator = function (scopeNode) {
        var parentFunc = utils_1.findParentFunction(scopeNode);
        var scopeId = parentFunc && parentFunc.pos + 1 || 'main';
        var existingSymbolNames = this.typeChecker.getSymbolsInScope(scopeNode, ts.SymbolFlags.Variable).map(function (s) { return s.name; });
        if (!this.temporaryVariables[scopeId])
            this.temporaryVariables[scopeId] = [];
        existingSymbolNames = existingSymbolNames.concat(this.temporaryVariables[scopeId]);
        var i = 0;
        while (i < this.iteratorVarNames.length && existingSymbolNames.indexOf(this.iteratorVarNames[i]) > -1)
            i++;
        var iteratorVarName;
        if (i == this.iteratorVarNames.length) {
            i = 2;
            while (existingSymbolNames.indexOf("i_" + i) > -1)
                i++;
            iteratorVarName = "i_" + i;
        }
        else
            iteratorVarName = this.iteratorVarNames[i];
        this.temporaryVariables[scopeId].push(iteratorVarName);
        return iteratorVarName;
    };
    /** Generate name for a new temporary variable and register it in temporaryVariables table.
     * Generated name is guarantied not to conflict with any existing names in specified scope.
     */
    SymbolsHelper.prototype.addTemp = function (scopeNode, proposedName, reserve) {
        if (reserve === void 0) { reserve = true; }
        var parentFunc = utils_1.findParentFunction(scopeNode);
        var scopeId = parentFunc && parentFunc.pos + 1 || 'main';
        var existingSymbolNames = scopeNode == null ? [] : this.typeChecker.getSymbolsInScope(scopeNode, ts.SymbolFlags.Variable).map(function (s) { return s.name; });
        if (!this.temporaryVariables[scopeId])
            this.temporaryVariables[scopeId] = [];
        existingSymbolNames = existingSymbolNames.concat(this.temporaryVariables[scopeId]);
        if (existingSymbolNames.indexOf(proposedName) > -1) {
            var i_1 = 2;
            while (existingSymbolNames.indexOf(proposedName + "_" + i_1) > -1)
                i_1++;
            proposedName = proposedName + "_" + i_1;
        }
        if (reserve)
            this.temporaryVariables[scopeId].push(proposedName);
        return proposedName;
    };
    SymbolsHelper.prototype.getClosureVarName = function (node) {
        if (!this.closureVarNames[node.pos]) {
            var name_1 = this.addTemp(node, "closure");
            this.closureVarNames[node.pos] = name_1;
        }
        return this.closureVarNames[node.pos];
    };
    SymbolsHelper.prototype.getScopeVarName = function (node) {
        if (!this.scopeVarNames[node.pos]) {
            var name_2 = this.addTemp(node, "scope");
            this.scopeVarNames[node.pos] = name_2;
        }
        return this.scopeVarNames[node.pos];
    };
    return SymbolsHelper;
}());
exports.SymbolsHelper = SymbolsHelper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./types/ctypes":44,"./types/utils":49}],43:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
;
var CTemplateBase = /** @class */ (function () {
    function CTemplateBase() {
    }
    CTemplateBase.prototype.new = function (scope, node) { };
    ;
    CTemplateBase.prototype.resolve = function () { return ""; };
    return CTemplateBase;
}());
exports.CTemplateBase = CTemplateBase;
var nodeKindTemplates = {};
var CodeTemplateFactory = /** @class */ (function () {
    function CodeTemplateFactory() {
    }
    CodeTemplateFactory.createForNode = function (scope, node) {
        return nodeKindTemplates[node.kind] ? new nodeKindTemplates[node.kind](scope, node)
            : "/* Unsupported node: " + node.getText().replace(/[\n\s]+/g, ' ') + " */;\n";
    };
    CodeTemplateFactory.templateToString = function (template) {
        return typeof (template) === "string" ? template : template.resolve();
    };
    return CodeTemplateFactory;
}());
exports.CodeTemplateFactory = CodeTemplateFactory;
function CodeTemplate(tempString, nodeKind) {
    return function (target) {
        var newConstructor = function (scope, node) {
            var self = this;
            var retValue = target.apply(self, arguments);
            var _a = processTemplate(tempString, self), code = _a[0], statements = _a[1];
            if (statements)
                scope.statements.push(statements);
            self.resolve = function () {
                return code;
            };
            return retValue;
        };
        if (nodeKind) {
            if (typeof nodeKind === 'number')
                nodeKindTemplates[nodeKind] = newConstructor;
            else
                for (var _i = 0, nodeKind_1 = nodeKind; _i < nodeKind_1.length; _i++) {
                    var nk = nodeKind_1[_i];
                    nodeKindTemplates[nk] = newConstructor;
                }
        }
        return newConstructor;
    };
}
exports.CodeTemplate = CodeTemplate;
/** Returns: [code, statements] */
function processTemplate(template, args) {
    var statements = "";
    if (template.indexOf("{#statements}") > -1) {
        var statementsStartPos = template.indexOf("{#statements}");
        var statementsBodyStartPos = statementsStartPos + "{#statements}".length;
        var statementsBodyEndPos = template.indexOf("{/statements}");
        var statementsEndPos = statementsBodyEndPos + "{/statements}".length;
        while (statementsStartPos > 0 && (template[statementsStartPos - 1] == ' ' || template[statementsStartPos - 1] == '\n'))
            statementsStartPos--;
        if (statementsBodyEndPos > 0 && template[statementsBodyEndPos - 1] == '\n')
            statementsBodyEndPos--;
        var templateText = template.slice(statementsBodyStartPos, statementsBodyEndPos).replace(/\n    /g, '\n');
        var _a = processTemplate(templateText, args), c = _a[0], s = _a[1];
        statements += s + c;
        template = template.slice(0, statementsStartPos) + template.slice(statementsEndPos);
    }
    if (typeof args === "string")
        return [template.replace(/{this}/g, function () { return args; }), statements];
    var ifPos;
    while ((ifPos = template.indexOf("{#if ")) > -1) {
        var posBeforeIf = ifPos;
        while (posBeforeIf > 0 && (template[posBeforeIf - 1] == ' ' || template[posBeforeIf - 1] == '\n'))
            posBeforeIf--;
        ifPos += 5;
        var conditionStartPos = ifPos;
        while (template[ifPos] != "}")
            ifPos++;
        var endIfPos = template.indexOf("{/if}", ifPos);
        var elseIfPos = template.indexOf("{#elseif ", ifPos);
        var elsePos = template.indexOf("{#else}", ifPos);
        var endIfBodyPos = endIfPos;
        if (elseIfPos != -1 && elseIfPos < endIfBodyPos)
            endIfBodyPos = elseIfPos;
        if (elsePos != -1 && elsePos < endIfBodyPos)
            endIfBodyPos = elsePos;
        if (endIfBodyPos > 0 && template[endIfBodyPos - 1] == '\n')
            endIfBodyPos--;
        var posAfterIf = endIfPos + 5;
        if (endIfPos > 0 && template[endIfPos - 1] == '\n')
            endIfPos--;
        var evalText = template.slice(conditionStartPos, ifPos);
        for (var k_1 in args)
            evalText = evalText.replace(new RegExp("\\b" + k_1 + "\\b", "g"), function (m) { return "args." + m; });
        var evalResult = eval(evalText);
        if (evalResult)
            template = template.slice(0, posBeforeIf) + template.slice(ifPos + 1, endIfBodyPos).replace(/\n    /g, '\n') + template.slice(posAfterIf);
        else if (elseIfPos > -1)
            template = template.slice(0, posBeforeIf) + "{#" + template.slice(elseIfPos + 6);
        else if (elsePos > -1)
            template = template.slice(0, posBeforeIf) + template.slice(elsePos + 7, endIfPos).replace(/\n    /g, '\n') + template.slice(posAfterIf);
        else
            template = template.slice(0, posBeforeIf) + template.slice(posAfterIf);
    }
    var replaced = false;
    for (var k in args) {
        if (k == "resolve")
            continue;
        if (args[k] && args[k].push) {
            var data = { template: template };
            while (replaceArray(data, k, args[k], statements))
                replaced = true;
            template = data.template;
        }
        else {
            var index = -1;
            var _loop_1 = function () {
                var spaces = '';
                while (template.length > index && template[index - 1] == ' ') {
                    index--;
                    spaces += ' ';
                }
                var value = args[k];
                if (value && value.resolve)
                    value = value.resolve();
                if (value && typeof value === 'string')
                    value = value.replace(/\n/g, '\n' + spaces);
                template = template.replace("{" + k + "}", function () { return value; });
                replaced = true;
            };
            while ((index = template.indexOf("{" + k + "}")) > -1) {
                _loop_1();
            }
        }
    }
    if (args["resolve"] && !replaced && template.indexOf("{this}") > -1) {
        template = template.replace("{this}", function () { return args["resolve"](); });
    }
    template = template.replace(/^[\n]*/, '').replace(/\n\s*\n[\n\s]*\n/g, '\n\n');
    return [template, statements];
}
function replaceArray(data, k, array, statements) {
    var pos = data.template.indexOf("{" + k + '}');
    if (pos != -1) {
        var elementsResolved_1 = '';
        for (var _i = 0, array_1 = array; _i < array_1.length; _i++) {
            var element = array_1[_i];
            var _a = processTemplate("{this}", element), resolvedElement = _a[0], elementStatements = _a[1];
            statements += elementStatements;
            elementsResolved_1 += resolvedElement;
        }
        data.template = data.template.slice(0, pos) + elementsResolved_1 + data.template.slice(pos + k.length + 2);
        return true;
    }
    if (pos == -1)
        pos = data.template.indexOf("{" + k + ' ');
    if (pos == -1)
        pos = data.template.indexOf("{" + k + '=');
    if (pos == -1)
        pos = data.template.indexOf("{" + k + '{');
    if (pos == -1)
        return false;
    var startPos = pos;
    pos += k.length + 1;
    while (data.template[pos] == ' ')
        pos++;
    var separator = '';
    if (data.template[pos] == '{') {
        pos++;
        while (data.template[pos] != '}' && pos < data.template.length) {
            separator += data.template[pos];
            pos++;
        }
        pos++;
    }
    if (pos >= data.template.length - 2 || data.template[pos] !== "=" || data.template[pos + 1] !== ">")
        throw new Error("Internal error: incorrect template format for array " + k + ".");
    pos += 2;
    if (data.template[pos] == ' ' && data.template[pos + 1] != ' ')
        pos++;
    var curlyBracketCounter = 1;
    var elementTemplateStart = pos;
    while (curlyBracketCounter > 0) {
        if (pos == data.template.length)
            throw new Error("Internal error: incorrect template format for array " + k + ".");
        if (data.template[pos] == '{')
            curlyBracketCounter++;
        if (data.template[pos] == '}')
            curlyBracketCounter--;
        pos++;
    }
    var elementTemplate = data.template.slice(elementTemplateStart, pos - 1);
    var elementsResolved = "";
    for (var _b = 0, array_2 = array; _b < array_2.length; _b++) {
        var element = array_2[_b];
        var _c = processTemplate(elementTemplate, element), resolvedElement = _c[0], elementStatements = _c[1];
        statements += elementStatements;
        if (k == 'statements') {
            resolvedElement = resolvedElement.replace(/[;\n]+;/g, ';');
            if (resolvedElement.search(/\n/) > -1) {
                for (var _d = 0, _e = resolvedElement.split('\n'); _d < _e.length; _d++) {
                    var line = _e[_d];
                    if (line != '') {
                        if (elementsResolved != "")
                            elementsResolved += separator;
                        elementsResolved += line + '\n';
                    }
                }
            }
            else {
                if (elementsResolved != "" && resolvedElement != "")
                    elementsResolved += separator;
                if (resolvedElement.search(/^[\n\s]*$/) == -1)
                    elementsResolved += resolvedElement + '\n';
            }
        }
        else {
            if (elementsResolved != "")
                elementsResolved += separator;
            elementsResolved += resolvedElement;
        }
    }
    if (array.length == 0) {
        while (pos < data.template.length && data.template[pos] == ' ')
            pos++;
        while (pos < data.template.length && data.template[pos] == '\n')
            pos++;
        while (startPos > 0 && data.template[startPos - 1] == ' ')
            startPos--;
        while (startPos > 0 && data.template[startPos - 1] == '\n')
            startPos--;
        if (data.template[startPos] == '\n')
            startPos++;
    }
    data.template = data.template.slice(0, startPos) + elementsResolved + data.template.slice(pos);
    return true;
}

},{}],44:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversalVarType = "struct js_var";
exports.VoidType = "void";
exports.PointerVarType = "void *";
exports.StringVarType = "const char *";
exports.NumberVarType = "int16_t";
exports.BooleanVarType = "uint8_t";
exports.RegexVarType = "struct regex_struct_t";
exports.RegexMatchVarType = "struct regex_match_struct_t";
function getTypeBodyText(t) { return typeof t === "string" ? t : t.getBodyText(); }
exports.getTypeBodyText = getTypeBodyText;
function getTypeText(t) { return typeof (t) === "string" ? t : t.getText(); }
exports.getTypeText = getTypeText;
/** Type that represents static or dynamic array */
var ArrayType = /** @class */ (function () {
    function ArrayType(elementType, capacity, isDynamicArray) {
        this.elementType = elementType;
        this.capacity = capacity;
        this.isDynamicArray = isDynamicArray;
    }
    ArrayType.getArrayStructName = function (elementTypeText) {
        while (elementTypeText.indexOf(exports.NumberVarType) > -1)
            elementTypeText = elementTypeText.replace(exports.NumberVarType, "number");
        while (elementTypeText.indexOf(exports.StringVarType) > -1)
            elementTypeText = elementTypeText.replace(exports.StringVarType, "string");
        while (elementTypeText.indexOf(exports.PointerVarType) > -1)
            elementTypeText = elementTypeText.replace(exports.PointerVarType, "pointer");
        while (elementTypeText.indexOf(exports.BooleanVarType) > -1)
            elementTypeText = elementTypeText.replace(exports.BooleanVarType, "bool");
        elementTypeText = elementTypeText.replace(/^struct ([a-z0-9_]+)_t \*$/, function (all, g1) { return g1; }).replace(/^struct js_var/, "js_var");
        return "array_" +
            elementTypeText
                .replace(/^static /, '').replace('{var}', '').replace(/[\[\]]/g, '')
                .replace(/ /g, '_')
                .replace(/const char \*/g, 'string')
                .replace(/\*/g, 'p') + "_t";
    };
    ArrayType.prototype.getText = function () {
        var elementType = this.elementType;
        var elementTypeText;
        if (typeof elementType === 'string')
            elementTypeText = elementType;
        else
            elementTypeText = elementType.getText();
        var structName = ArrayType.getArrayStructName(elementTypeText);
        if (this.isDynamicArray)
            return "struct " + structName + " *";
        else if (elementTypeText.indexOf('{var}') > -1)
            return elementTypeText + "[" + this.capacity + "]";
        else
            return "static " + elementTypeText + " {var}[" + this.capacity + "]";
    };
    ArrayType.prototype.getBodyText = function () {
        return getTypeBodyText(this.elementType) + "[" + (this.isDynamicArray ? "" : this.capacity) + "]";
    };
    return ArrayType;
}());
exports.ArrayType = ArrayType;
/** Type that represents JS object with static properties (implemented as C struct) */
var StructType = /** @class */ (function () {
    function StructType(propertyDefs) {
        this.propertyDefs = propertyDefs;
    }
    StructType.prototype.getText = function () {
        return this.forcedType || 'struct ' + this.structName + ' *';
    };
    Object.defineProperty(StructType.prototype, "properties", {
        get: function () {
            var _this = this;
            return Object.keys(this.propertyDefs)
                .sort(function (a, b) { return _this.propertyDefs[a].order - _this.propertyDefs[b].order; })
                .reduce(function (acc, k) { acc[k] = _this.propertyDefs[k].type; return acc; }, {});
        },
        enumerable: true,
        configurable: true
    });
    StructType.prototype.getBodyText = function () {
        var _this = this;
        return "{" + Object.keys(this.propertyDefs).sort().map(function (k) { return k + ": " + getTypeBodyText(_this.properties[k]); }).join("; ") + "}";
    };
    return StructType;
}());
exports.StructType = StructType;
/** Type that represents JS object with dynamic properties (implemented as dynamic dictionary) */
var DictType = /** @class */ (function () {
    function DictType(elementType) {
        this.elementType = elementType;
    }
    DictType.prototype.getText = function () {
        if (this.elementType == exports.UniversalVarType)
            return "struct dict_js_var_t *";
        else
            return "DICT(" + (typeof this.elementType === "string" ? this.elementType : this.elementType.getText()) + ")";
    };
    DictType.prototype.getBodyText = function () {
        return "{" + getTypeBodyText(this.elementType) + "}";
    };
    return DictType;
}());
exports.DictType = DictType;
var FuncType = /** @class */ (function () {
    function FuncType(data) {
        this.returnType = data.returnType || exports.VoidType;
        this.parameterTypes = data.parameterTypes || [];
        this.instanceType = data.instanceType || null;
        this.closureParams = data.closureParams || [];
        this.needsClosureStruct = data.needsClosureStruct || false;
        this.scopeType = data.scopeType || null;
        this.structName = data.structName || null;
    }
    FuncType.getReturnType = function (typeHelper, node) {
        var type = typeHelper.getCType(node);
        return type && type instanceof FuncType ? type.returnType : null;
    };
    FuncType.getInstanceType = function (typeHelper, node) {
        var type = typeHelper.getCType(node);
        return type && type instanceof FuncType ? type.instanceType : null;
    };
    FuncType.prototype.getText = function (forceFuncType) {
        if (forceFuncType === void 0) { forceFuncType = false; }
        if (this.closureParams.length && !forceFuncType)
            return 'struct ' + this.structName + ' *';
        var retType = getTypeText(this.returnType).replace(/ \{var\}\[\d+\]/g, "* {var}").replace(/^static /, "");
        if (retType.indexOf("{var}") == -1)
            retType += " {var}";
        return retType.replace(" {var}", " (*{var})") + "("
            + this.parameterTypes
                .map(function (t) { return getTypeText(t).replace(/\ {var\}/, "").replace(/^static /, ""); })
                .concat(this.closureParams.length ? ['struct ' + this.structName + ' *'] : [])
                .join(', ')
            + ")";
    };
    FuncType.prototype.getBodyText = function () {
        var paramTypes = [].concat(this.parameterTypes);
        if (this.instanceType)
            paramTypes.unshift(this.instanceType);
        return getTypeBodyText(this.returnType)
            + "(" + paramTypes.map(function (pt) { return pt ? getTypeBodyText(pt) : exports.PointerVarType; }).join(", ") + ")"
            + (this.scopeType ? " scope=" + getTypeBodyText(this.scopeType) : "")
            + (this.closureParams.length ? " closure" : "")
            + (this.needsClosureStruct ? "_struct" : "")
            + (this.closureParams.length ? "={" + this.closureParams.map(function (p) { return (p.assigned ? "*" : "") + p.node.text + "(" + p.refs.map(function (r) { return r.pos; }).join(",") + ")"; }).join(", ") + "}" : "");
    };
    return FuncType;
}());
exports.FuncType = FuncType;

},{}],45:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var utils_1 = require("./utils");
var CircularTypesFinder = /** @class */ (function () {
    function CircularTypesFinder(allNodes, typeChecker) {
        this.allNodes = allNodes;
        this.typeChecker = typeChecker;
        this.assignments = {};
        this.circularAssignments = {};
    }
    CircularTypesFinder.prototype.findCircularAssignments = function () {
        this.circularAssignments = {};
        this.assignments = {};
        for (var _i = 0, _a = this.allNodes; _i < _a.length; _i++) {
            var node = _a[_i];
            if (utils_1.isEqualsExpression(node) || ts.isVariableDeclaration(node)) {
                var left = utils_1.isEqualsExpression(node) ? node.left : node.name;
                var right = utils_1.isEqualsExpression(node) ? node.right : node.initializer;
                if (!left || !right)
                    continue;
                var lvar = left;
                var leftProps = [];
                while (utils_1.isFieldPropertyAccess(lvar) || utils_1.isFieldElementAccess(lvar)) {
                    if (utils_1.isFieldPropertyAccess(lvar))
                        leftProps.unshift(lvar.name.text);
                    else if (utils_1.isFieldElementAccess(lvar))
                        leftProps.unshift(lvar.argumentExpression.getText().slice(1, -1));
                    lvar = lvar.expression;
                }
                this.checkOneAssignment(node, lvar, leftProps, right);
            }
        }
        console.log(Object.keys(this.circularAssignments));
        return this.circularAssignments;
    };
    CircularTypesFinder.prototype.checkOneAssignment = function (refNode, left, leftProps, right) {
        var _this = this;
        if (ts.isObjectLiteralExpression(right)) {
            for (var _i = 0, _a = right.properties; _i < _a.length; _i++) {
                var prop = _a[_i];
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name))
                    this.checkOneAssignment(refNode, left, leftProps.concat(prop.name.text), prop.initializer);
            }
            return;
        }
        var rightProps = [];
        while (utils_1.isFieldPropertyAccess(right) || utils_1.isFieldElementAccess(right)) {
            if (utils_1.isFieldPropertyAccess(right))
                rightProps.unshift(right.name.text);
            else if (utils_1.isFieldElementAccess(right))
                rightProps.unshift(right.argumentExpression.getText().slice(1, -1));
            right = right.expression;
        }
        var symbolRight = this.typeChecker.getSymbolAtLocation(right);
        var symbolLeft = this.typeChecker.getSymbolAtLocation(left);
        if (symbolRight && symbolLeft) {
            var key_1 = symbolLeft.valueDeclaration.pos + "->" + leftProps.map(function (p) { return p + "->"; }).join("");
            var value_1 = symbolRight.valueDeclaration.pos + "->" + rightProps.map(function (p) { return p + "->"; }).join("");
            if (key_1.indexOf(value_1) === 0 || Object.keys(this.assignments).filter(function (k) { return k.indexOf(value_1) === 0; }).some(function (k) { return _this.assignments[k].some(function (a) { return key_1.indexOf(a) === 0; }); }))
                this.circularAssignments[refNode.pos] = { node: symbolLeft.valueDeclaration, propChain: leftProps };
            this.assignments[key_1] = (this.assignments[key_1] || []).concat(value_1);
        }
    };
    return CircularTypesFinder;
}());
exports.CircularTypesFinder = CircularTypesFinder;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./utils":49}],46:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ctypes_1 = require("./ctypes");
var TypeMerger = /** @class */ (function () {
    function TypeMerger() {
        this.typesDict = {};
    }
    TypeMerger.prototype.mergeTypes = function (type1, type2) {
        var type1_result = { type: this.ensureNoTypeDuplicates(type1), replaced: true };
        var type2_result = { type: this.ensureNoTypeDuplicates(type2), replaced: true };
        var noChanges = { type: this.ensureNoTypeDuplicates(type1), replaced: false };
        if (!type1 && type2)
            return type2_result;
        else if (type1 && !type2)
            return type1_result;
        else if (!type1 && !type2)
            return noChanges;
        else if (typeof type1 == "string" && typeof type2 == "string" && type1 == type2)
            return noChanges;
        else if (type1 === ctypes_1.VoidType)
            return type2_result;
        else if (type2 === ctypes_1.VoidType)
            return type1_result;
        else if (type1 === ctypes_1.PointerVarType)
            return type2_result;
        else if (type2 === ctypes_1.PointerVarType)
            return type1_result;
        else if (type1 === ctypes_1.UniversalVarType)
            return type1_result;
        else if (type2 === ctypes_1.UniversalVarType)
            return type2_result;
        else if (type1 === ctypes_1.StringVarType && type2 instanceof ctypes_1.StructType) {
            if (Object.keys(type2.properties).length == 1 && (type2.properties["length"] == ctypes_1.PointerVarType || type2.properties["length"] == ctypes_1.NumberVarType))
                return type1_result;
        }
        else if (type1 instanceof ctypes_1.StructType && type2 === ctypes_1.StringVarType) {
            if (Object.keys(type1.properties).length == 1 && (type1.properties["length"] == ctypes_1.PointerVarType || type1.properties["length"] == ctypes_1.NumberVarType))
                return type2_result;
        }
        else if (type1 instanceof ctypes_1.ArrayType && type2 instanceof ctypes_1.ArrayType) {
            var cap = Math.max(type2.capacity, type1.capacity);
            var isDynamicArray = type2.isDynamicArray || type1.isDynamicArray;
            var elementTypeMergeResult = this.mergeTypes(type1.elementType, type2.elementType);
            if (type1.capacity != cap || type2.capacity != cap
                || type1.isDynamicArray != isDynamicArray || type2.isDynamicArray != isDynamicArray
                || elementTypeMergeResult.replaced)
                return { type: this.ensureNoTypeDuplicates(new ctypes_1.ArrayType(elementTypeMergeResult.type, cap, isDynamicArray)), replaced: true };
            return noChanges;
        }
        else if (type1 instanceof ctypes_1.DictType && type2 instanceof ctypes_1.ArrayType) {
            return type1_result;
        }
        else if (type1 instanceof ctypes_1.ArrayType && type2 instanceof ctypes_1.DictType) {
            return type2_result;
        }
        else if (type1 instanceof ctypes_1.StructType && type2 instanceof ctypes_1.StructType) {
            var props = Object.keys(type1.properties).concat(Object.keys(type2.properties));
            var changed = false;
            var newProps = {};
            for (var _i = 0, props_1 = props; _i < props_1.length; _i++) {
                var p = props_1[_i];
                var recursive1 = type1.propertyDefs[p] ? type1.propertyDefs[p].recursive : false;
                var recursive2 = type2.propertyDefs[p] ? type2.propertyDefs[p].recursive : false;
                var result = recursive1 || recursive2 ? { type: ctypes_1.PointerVarType, replaced: recursive1 != recursive2 } : this.mergeTypes(type1.properties[p], type2.properties[p]);
                var order = Math.max(type1.propertyDefs[p] ? type1.propertyDefs[p].order : 0, type2.propertyDefs[p] ? type2.propertyDefs[p].order : 0);
                newProps[p] = { type: result.type, order: order, recursive: recursive1 || recursive2 };
                if (result.replaced)
                    changed = true;
            }
            return changed ? { type: this.ensureNoTypeDuplicates(new ctypes_1.StructType(newProps)), replaced: true } : noChanges;
        }
        else if (type1 instanceof ctypes_1.ArrayType && type2 instanceof ctypes_1.StructType) {
            return this.mergeArrayAndStruct(type1, type2);
        }
        else if (type1 instanceof ctypes_1.StructType && type2 instanceof ctypes_1.ArrayType) {
            return this.mergeArrayAndStruct(type2, type1);
        }
        else if (type1 instanceof ctypes_1.DictType && type2 instanceof ctypes_1.StructType) {
            return this.mergeDictAndStruct(type1, type2);
        }
        else if (type1 instanceof ctypes_1.StructType && type2 instanceof ctypes_1.DictType) {
            return this.mergeDictAndStruct(type2, type1);
        }
        else if (type1 instanceof ctypes_1.DictType && type2 instanceof ctypes_1.DictType) {
            var _a = this.mergeTypes(type1.elementType, type2.elementType), elemType = _a.type, replaced = _a.replaced;
            if (replaced)
                return { type: this.ensureNoTypeDuplicates(new ctypes_1.DictType(elemType)), replaced: true };
            else
                return noChanges;
        }
        else if (type1 instanceof ctypes_1.FuncType && type2 instanceof ctypes_1.FuncType) {
            var _b = this.mergeTypes(type1.returnType, type2.returnType), returnType = _b.type, returnTypeReplaced = _b.replaced;
            var _c = this.mergeTypes(type1.instanceType, type2.instanceType), instanceType = _c.type, instanceTypeReplaced = _c.replaced;
            var _d = this.mergeTypes(type1.scopeType, type2.scopeType), scopeType = _d.type, scopeTypeReplaced = _d.replaced;
            var paramCount = Math.max(type1.parameterTypes.length, type2.parameterTypes.length);
            var paramTypesReplaced = type1.parameterTypes.length !== type2.parameterTypes.length;
            var parameterTypes = [];
            for (var i_1 = 0; i_1 < paramCount; i_1++) {
                var _e = this.mergeTypes(type1.parameterTypes[i_1], type2.parameterTypes[i_1]), pType = _e.type, pTypeReplaced = _e.replaced;
                parameterTypes.push(pType);
                if (pTypeReplaced)
                    paramTypesReplaced = true;
            }
            var closureParamCount = Math.max(type1.closureParams.length, type2.closureParams.length);
            var closureParamsReplaced = type1.closureParams.length !== type2.closureParams.length;
            var closureParams = [];
            for (var i_2 = 0; i_2 < closureParamCount; i_2++) {
                closureParams.push(type1.closureParams[i_2] || type2.closureParams[i_2]);
            }
            var needsClosureStructReplaced = type1.needsClosureStruct != type2.needsClosureStruct;
            var needsClosureStruct = type1.needsClosureStruct || type2.needsClosureStruct;
            if (returnTypeReplaced || instanceTypeReplaced || scopeTypeReplaced || paramTypesReplaced || closureParamsReplaced || needsClosureStructReplaced)
                return { type: this.ensureNoTypeDuplicates(new ctypes_1.FuncType({ returnType: returnType, parameterTypes: parameterTypes, instanceType: instanceType, closureParams: closureParams, needsClosureStruct: needsClosureStruct, scopeType: scopeType })), replaced: true };
            else
                return noChanges;
        }
        else
            return { type: ctypes_1.UniversalVarType, replaced: true };
    };
    TypeMerger.prototype.mergeArrayAndStruct = function (arrayType, structType) {
        var props = Object.keys(structType.properties);
        var needPromoteToDictionary = false;
        var needPromoteToTuple = false;
        for (var _i = 0, props_2 = props; _i < props_2.length; _i++) {
            var p = props_2[_i];
            if (p == "length")
                continue;
            if (isNaN(+p))
                needPromoteToDictionary = true;
            if (this.mergeTypes(arrayType.elementType, structType.properties[p]).replaced)
                needPromoteToTuple = true;
        }
        if (needPromoteToDictionary && needPromoteToTuple)
            return { type: this.ensureNoTypeDuplicates(new ctypes_1.DictType(ctypes_1.UniversalVarType)), replaced: true };
        else if (needPromoteToDictionary)
            return { type: this.ensureNoTypeDuplicates(new ctypes_1.DictType(arrayType.elementType)), replaced: true };
        else if (needPromoteToTuple)
            return { type: this.ensureNoTypeDuplicates(new ctypes_1.ArrayType(ctypes_1.UniversalVarType, arrayType.capacity, arrayType.isDynamicArray)), replaced: true };
        else
            return { type: arrayType, replaced: true };
    };
    TypeMerger.prototype.mergeDictAndStruct = function (dictType, structType) {
        var elementType = dictType.elementType;
        for (var k in structType.properties)
            (elementType = this.mergeTypes(elementType, structType.properties[k]).type);
        return { type: this.ensureNoTypeDuplicates(new ctypes_1.DictType(elementType)), replaced: true };
    };
    TypeMerger.prototype.ensureNoTypeDuplicates = function (t) {
        if (!t)
            return null;
        var typeBodyText = ctypes_1.getTypeBodyText(t);
        var type = this.typesDict[typeBodyText];
        if (type instanceof ctypes_1.ArrayType)
            type.capacity = Math.max(type.capacity, t.capacity);
        if (type instanceof ctypes_1.StructType)
            for (var pk in type.propertyDefs)
                type.propertyDefs[pk].recursive = type.propertyDefs[pk].recursive || t.propertyDefs[pk].recursive;
        if (!type)
            type = this.typesDict[typeBodyText] = t;
        return type;
    };
    return TypeMerger;
}());
exports.TypeMerger = TypeMerger;

},{"./ctypes":44}],47:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var standard_1 = require("../standard");
var utils_1 = require("./utils");
var ctypes_1 = require("./ctypes");
var findcircular_1 = require("./findcircular");
var TypeResolver = /** @class */ (function () {
    function TypeResolver(typeChecker, allNodes, typeHelper, typeMerger, typeOfNodeDict) {
        this.typeChecker = typeChecker;
        this.allNodes = allNodes;
        this.typeHelper = typeHelper;
        this.typeMerger = typeMerger;
        this.typeOfNodeDict = typeOfNodeDict;
    }
    /** Postprocess TypeScript AST for better type inference and map TS types to C types */
    /** Creates typeOfNodeDict that is later used in getCType */
    TypeResolver.prototype.inferTypes = function () {
        var _this = this;
        var finder = new findcircular_1.CircularTypesFinder(this.allNodes, this.typeChecker);
        var circularAssignments = finder.findCircularAssignments();
        var type = function (t) { return ({ getType: typeof (t) === "string" ? function (_) { return t; } : t }); };
        var struct = function (prop, pos, elemType, recursive) {
            if (elemType === void 0) { elemType = ctypes_1.PointerVarType; }
            if (recursive === void 0) { recursive = false; }
            return new ctypes_1.StructType((_a = {}, _a[prop] = { type: elemType, order: pos, recursive: recursive }, _a));
            var _a;
        };
        var typeEqualities = [];
        var addEquality = function (typeGuard, node1, node2) {
            if (typeof node2 == "function")
                typeEqualities.push([typeGuard, node1, { getNode: node2 }]);
            else
                typeEqualities.push([typeGuard, node1, node2]);
        };
        // left hand side
        addEquality(ts.isIdentifier, function (n) { return n; }, function (n) { return _this.typeHelper.getDeclaration(n); });
        addEquality(ts.isPropertyAssignment, function (n) { return n; }, function (n) { return n.initializer; });
        addEquality(ts.isPropertyAssignment, function (n) { return n.parent; }, type(function (n) {
            var propName = (ts.isIdentifier(n.name) || utils_1.isStringLiteralAsIdentifier(n.name)) && n.name.text;
            if (propName)
                return struct(propName, n.pos, _this.typeHelper.getCType(n) || ctypes_1.PointerVarType);
            else
                return new ctypes_1.DictType(_this.typeHelper.getCType(n));
        }));
        addEquality(ts.isPropertyAssignment, function (n) { return n; }, type(function (n) {
            var propName = (ts.isIdentifier(n.name) || utils_1.isStringLiteralAsIdentifier(n.name)) && n.name.text;
            var type = _this.typeHelper.getCType(n.parent);
            return type instanceof ctypes_1.StructType ? type.properties[propName]
                : type instanceof ctypes_1.DictType ? type.elementType
                    : null;
        }));
        addEquality(ts.isPropertyAssignment, function (n) { return n; }, type(function (n) {
            var type = _this.typeHelper.getCType(n.initializer);
            if (type instanceof ctypes_1.FuncType && type.closureParams.length)
                return new ctypes_1.FuncType({ needsClosureStruct: true });
            else
                return null;
        }));
        addEquality(ts.isPropertyAccessExpression, function (n) { return n; }, function (n) { return n.name; });
        addEquality(utils_1.isFieldPropertyAccess, function (n) { return n.expression; }, type(function (n) { return struct(n.name.getText(), n.pos, _this.typeHelper.getCType(n) || ctypes_1.PointerVarType); }));
        addEquality(utils_1.isFieldPropertyAccess, function (n) { return n; }, type(function (n) {
            var type = _this.typeHelper.getCType(n.expression);
            return type instanceof ctypes_1.StructType ? type.properties[n.name.getText()]
                : type instanceof ctypes_1.ArrayType && n.name.getText() == "length" ? ctypes_1.NumberVarType
                    : type === ctypes_1.StringVarType && n.name.getText() == "length" ? ctypes_1.NumberVarType
                        : type instanceof ctypes_1.ArrayType || type instanceof ctypes_1.DictType ? type.elementType
                            : type === ctypes_1.UniversalVarType && n.name.getText() == "length" ? ctypes_1.NumberVarType
                                : type === ctypes_1.UniversalVarType ? ctypes_1.UniversalVarType
                                    : null;
        }));
        addEquality(utils_1.isFieldElementAccess, function (n) { return n.expression; }, type(function (n) {
            var type = _this.typeHelper.getCType(n.argumentExpression);
            var elementType = _this.typeHelper.getCType(n) || ctypes_1.PointerVarType;
            return utils_1.isStringLiteralAsIdentifier(n.argumentExpression) ? struct(n.argumentExpression.text, n.pos, elementType)
                : ts.isNumericLiteral(n.argumentExpression) ? new ctypes_1.ArrayType(elementType, 0, false)
                    : type == ctypes_1.NumberVarType ? new ctypes_1.ArrayType(elementType, 0, false)
                        : type == ctypes_1.StringVarType ? new ctypes_1.DictType(elementType)
                            : null;
        }));
        addEquality(utils_1.isFieldElementAccess, function (n) { return n; }, type(function (n) {
            var type = _this.typeHelper.getCType(n.expression);
            return ts.isStringLiteral(n.argumentExpression) && type instanceof ctypes_1.StructType ? type.properties[n.argumentExpression.getText().slice(1, -1)]
                : ts.isStringLiteral(n.argumentExpression) && type instanceof ctypes_1.ArrayType && n.argumentExpression.getText().slice(1, -1) == "length" ? ctypes_1.NumberVarType
                    : ts.isStringLiteral(n.argumentExpression) && type === ctypes_1.StringVarType && n.argumentExpression.getText().slice(1, -1) == "length" ? ctypes_1.NumberVarType
                        : ts.isStringLiteral(n.argumentExpression) && type === ctypes_1.UniversalVarType && n.argumentExpression.getText().slice(1, -1) == "length" ? ctypes_1.NumberVarType
                            : type instanceof ctypes_1.ArrayType || type instanceof ctypes_1.DictType ? type.elementType
                                : type === ctypes_1.UniversalVarType ? ctypes_1.UniversalVarType
                                    : null;
        }));
        var _loop_1 = function (i_1) {
            addEquality(ts.isArrayLiteralExpression, function (n) { return n; }, type(function (n) {
                var elemType = _this.typeHelper.getCType(n.elements[i_1]);
                return elemType ? new ctypes_1.ArrayType(elemType, 0, false) : null;
            }));
            addEquality(ts.isArrayLiteralExpression, function (n) { return n.elements[i_1]; }, type(function (n) {
                var arrType = _this.typeHelper.getCType(n);
                return arrType && arrType instanceof ctypes_1.ArrayType ? arrType.elementType
                    : arrType === ctypes_1.UniversalVarType ? ctypes_1.UniversalVarType
                        : null;
            }));
        };
        for (var i_1 = 0; i_1 < 10; i_1++) {
            _loop_1(i_1);
        }
        // expressions
        addEquality(utils_1.isEqualsExpression, function (n) { return n.left; }, function (n) { return circularAssignments[n.pos] ? null : n.right; });
        addEquality(utils_1.isEqualsExpression, function (n) { return n.left; }, type(function (n) {
            var type = _this.typeHelper.getCType(n.right);
            if (type instanceof ctypes_1.FuncType && type.closureParams.length)
                return new ctypes_1.FuncType({ needsClosureStruct: true });
            else
                return null;
        }));
        addEquality(utils_1.isFieldAssignment, function (n) { return n.left.expression; }, type(function (n) {
            if (!circularAssignments[n.pos])
                return null;
            return utils_1.isFieldElementAccess(n.left) ? struct(n.left.argumentExpression.getText().slice(1, -1), n.left.pos, ctypes_1.PointerVarType, true)
                : utils_1.isFieldPropertyAccess(n.left) ? struct(n.left.name.text, n.left.pos, ctypes_1.PointerVarType, true)
                    : null;
        }));
        addEquality(ts.isConditionalExpression, function (n) { return n.whenTrue; }, function (n) { return n.whenFalse; });
        addEquality(ts.isConditionalExpression, function (n) { return n; }, function (n) { return n.whenTrue; });
        addEquality(utils_1.isUnaryExpression, function (n) { return n; }, type(function (n) { return utils_1.getUnaryExprResultType(n.operator, _this.typeHelper.getCType(n.operand)); }));
        addEquality(utils_1.isUnaryExpression, function (n) { return n.operand; }, type(function (n) {
            if (n.operator !== ts.SyntaxKind.PlusPlusToken && n.operator !== ts.SyntaxKind.MinusMinusToken)
                return null;
            var resultType = _this.typeHelper.getCType(n);
            var accessObjType = (ts.isPropertyAccessExpression(n.operand) || ts.isElementAccessExpression(n.operand)) && _this.typeHelper.getCType(n.operand.expression);
            var isDictAccessor = accessObjType instanceof ctypes_1.DictType;
            if (resultType == ctypes_1.UniversalVarType || utils_1.toNumberCanBeNaN(resultType) || isDictAccessor)
                return ctypes_1.UniversalVarType;
            else
                return null;
        }));
        addEquality(ts.isBinaryExpression, function (n) { return n; }, type(function (n) { return utils_1.getBinExprResultType(_this.typeMerger.mergeTypes.bind(_this.typeMerger), _this.typeHelper.getCType(n.left), n.operatorToken.kind, _this.typeHelper.getCType(n.right)); }));
        addEquality(ts.isBinaryExpression, function (n) { return n.left; }, type(function (n) {
            var resultType = _this.typeHelper.getCType(n);
            var operandType = _this.typeHelper.getCType(n.left);
            var rightType = _this.typeHelper.getCType(n.right);
            if (resultType === ctypes_1.UniversalVarType) {
                return utils_1.isCompoundAssignment(n.operatorToken) ? ctypes_1.UniversalVarType
                    : operandType instanceof ctypes_1.ArrayType ? new ctypes_1.ArrayType(ctypes_1.UniversalVarType, 0, true)
                        : operandType instanceof ctypes_1.StructType || operandType instanceof ctypes_1.DictType ? new ctypes_1.DictType(ctypes_1.UniversalVarType)
                            : null;
            }
            else if (utils_1.operandsToNumber(operandType, n.operatorToken.kind, rightType) && utils_1.toNumberCanBeNaN(operandType))
                return ctypes_1.UniversalVarType;
            else
                return null;
        }));
        addEquality(ts.isBinaryExpression, function (n) { return n.right; }, type(function (n) {
            var resultType = _this.typeHelper.getCType(n);
            var operandType = _this.typeHelper.getCType(n.right);
            var leftType = _this.typeHelper.getCType(n.left);
            if (resultType === ctypes_1.UniversalVarType && !utils_1.isLogicOp(n.operatorToken.kind)) {
                return operandType instanceof ctypes_1.ArrayType ? new ctypes_1.ArrayType(ctypes_1.UniversalVarType, 0, true)
                    : operandType instanceof ctypes_1.StructType || operandType instanceof ctypes_1.DictType ? new ctypes_1.DictType(ctypes_1.UniversalVarType)
                        : null;
            }
            else if (utils_1.operandsToNumber(leftType, n.operatorToken.kind, operandType) && utils_1.toNumberCanBeNaN(operandType))
                return ctypes_1.UniversalVarType;
            else
                return null;
        }));
        addEquality(utils_1.isNullOrUndefinedOrNaN, function (n) { return n; }, type(ctypes_1.UniversalVarType));
        addEquality(ts.isParenthesizedExpression, function (n) { return n; }, function (n) { return n.expression; });
        addEquality(ts.isVoidExpression, function (n) { return n; }, type(ctypes_1.UniversalVarType));
        addEquality(ts.isVoidExpression, function (n) { return n.expression; }, type(ctypes_1.PointerVarType));
        addEquality(ts.isTypeOfExpression, function (n) { return n; }, type(ctypes_1.StringVarType));
        addEquality(utils_1.isDeleteExpression, function (n) { return n; }, type(ctypes_1.BooleanVarType));
        addEquality(utils_1.isDeleteExpression, function (n) { return n.expression.expression; }, type(function (n) { return new ctypes_1.DictType(ctypes_1.UniversalVarType); }));
        // functions
        addEquality(ts.isCallExpression, function (n) { return n.expression; }, function (n) { return _this.typeHelper.getDeclaration(n); });
        addEquality(ts.isCallExpression, function (n) { return n.expression; }, type(function (n) { return _this.typeHelper.getCType(n) ? new ctypes_1.FuncType({ returnType: _this.typeHelper.getCType(n), parameterTypes: n.arguments.map(function (arg) { return _this.typeHelper.getCType(arg); }) }) : null; }));
        addEquality(ts.isCallExpression, function (n) { return n; }, type(function (n) { return ctypes_1.FuncType.getReturnType(_this.typeHelper, n.expression); }));
        addEquality(ts.isParameter, function (n) { return n; }, function (n) { return n.name; });
        addEquality(ts.isParameter, function (n) { return n; }, function (n) { return n.initializer; });
        addEquality(ts.isNewExpression, function (n) { return n; }, type(function (n) {
            return ts.isIdentifier(n.expression) && n.expression.text === "Object" ? new ctypes_1.StructType({})
                : ctypes_1.FuncType.getInstanceType(_this.typeHelper, n.expression);
        }));
        var _loop_2 = function (i_2) {
            addEquality(ts.isNewExpression, function (n) { return n.arguments[i_2]; }, function (n) {
                var func = _this.typeHelper.getDeclaration(n.expression);
                return func && ts.isFunctionDeclaration(func) ? func.parameters[i_2] : null;
            });
        };
        for (var i_2 = 0; i_2 < 10; i_2++) {
            _loop_2(i_2);
        }
        addEquality(utils_1.isThisKeyword, function (n) { return utils_1.findParentFunction(n); }, type(function (n) { return new ctypes_1.FuncType({ instanceType: _this.typeHelper.getCType(n) }); }));
        addEquality(utils_1.isThisKeyword, function (n) { return n; }, type(function (n) { return ctypes_1.FuncType.getInstanceType(_this.typeHelper, utils_1.findParentFunction(n)); }));
        addEquality(utils_1.isMethodCall, function (n) { return n.expression.expression; }, type(function (n) { return standard_1.StandardCallHelper.getObjectType(_this.typeHelper, n); }));
        addEquality(ts.isCallExpression, function (n) { return n; }, type(function (n) { return standard_1.StandardCallHelper.getReturnType(_this.typeHelper, n); }));
        var _loop_3 = function (i_3) {
            addEquality(ts.isCallExpression, function (n) { return n.arguments[i_3]; }, type(function (n) { return utils_1.isLiteral(n.arguments[i_3]) ? null : standard_1.StandardCallHelper.getArgumentTypes(_this.typeHelper, n)[i_3]; }));
        };
        for (var i_3 = 0; i_3 < 10; i_3++) {
            _loop_3(i_3);
        }
        // crutch for callback argument type in foreach
        addEquality(utils_1.isFunctionArgInMethodCall, function (n) { return n.parameters[0]; }, type(function (n) {
            var objType = _this.typeHelper.getCType(n.parent.expression.expression);
            return objType instanceof ctypes_1.ArrayType && n.parent.expression.name.text == "forEach" ? objType.elementType : null;
        }));
        addEquality(utils_1.isFunction, function (n) { return n; }, type(function (n) { return new ctypes_1.FuncType({ parameterTypes: n.parameters.map(function (p) { return _this.typeHelper.getCType(p); }) }); }));
        var _loop_4 = function (i_4) {
            addEquality(utils_1.isFunction, function (n) { return n.parameters[i_4]; }, type(function (n) {
                var type = _this.typeHelper.getCType(n);
                return type instanceof ctypes_1.FuncType ? type.parameterTypes[i_4] : null;
            }));
        };
        for (var i_4 = 0; i_4 < 10; i_4++) {
            _loop_4(i_4);
        }
        // closures
        addEquality(utils_1.isFunction, function (n) { return n; }, type(function (node) {
            var funcsInFunction = utils_1.getAllFunctionNodesInFunction(node);
            var scopePropDefs = {};
            for (var _i = 0, funcsInFunction_1 = funcsInFunction; _i < funcsInFunction_1.length; _i++) {
                var f = funcsInFunction_1[_i];
                var fType = _this.typeHelper.getCType(f);
                if (fType && fType.needsClosureStruct && fType.closureParams) {
                    for (var _a = 0, _b = fType.closureParams; _a < _b.length; _a++) {
                        var p = _b[_a];
                        var decl = _this.typeHelper.getDeclaration(p.node);
                        scopePropDefs[p.node.text] = { type: _this.typeHelper.getCType(p.node) || ctypes_1.PointerVarType, pos: decl.pos };
                        if (utils_1.findParentFunction(decl) === node)
                            _this.typeHelper.registerScopeVariable(decl);
                    }
                }
            }
            if (Object.keys(scopePropDefs).length > 0)
                return new ctypes_1.FuncType({ scopeType: new ctypes_1.StructType(scopePropDefs) });
            else
                return null;
        }));
        addEquality(utils_1.isFunction, function (n) { return n; }, type(function (node) {
            var nodesInFunction = utils_1.getAllNodesUnder(node);
            var closureParams = [];
            nodesInFunction.filter(function (n) { return ts.isIdentifier(n); })
                .forEach(function (ident) {
                var identDecl = _this.typeHelper.getDeclaration(ident);
                // if declaration of identifier is function (i.e. function param), and it is not under node
                // (then it is defined in a parent func obviously), then add closure params of this parent function
                if (identDecl && utils_1.isFunction(identDecl) && !utils_1.isUnder(node, identDecl)) {
                    var identDeclType = _this.typeHelper.getCType(identDecl);
                    var _loop_5 = function (param) {
                        if (!closureParams.some(function (p) { return p.node.text === param.node.text; }))
                            closureParams.push(param);
                    };
                    for (var _i = 0, _a = identDeclType.closureParams; _i < _a.length; _i++) {
                        var param = _a[_i];
                        _loop_5(param);
                    }
                }
                else {
                    var identDeclFunc = identDecl && utils_1.findParentFunction(identDecl);
                    var isFieldName = ts.isPropertyAccessExpression(ident.parent) && ident.parent.name === ident;
                    var assigned = utils_1.isEqualsExpression(ident.parent) || utils_1.isCompoundAssignment(ident.parent);
                    if (identDeclFunc && identDeclFunc != node && utils_1.isUnder(identDeclFunc, node) && !isFieldName) {
                        var existing = closureParams.filter(function (p) { return p.node.escapedText === ident.escapedText; })[0];
                        if (!existing)
                            closureParams.push({ assigned: assigned, node: ident, refs: [ident] });
                        else if (assigned && !existing.assigned)
                            existing.assigned = true;
                        if (existing)
                            existing.refs.push(ident);
                    }
                }
            });
            if (closureParams.length)
                return new ctypes_1.FuncType({ closureParams: closureParams });
            else
                return null;
        }));
        // statements
        addEquality(ts.isVariableDeclaration, function (n) { return n; }, function (n) { return n.initializer; });
        addEquality(ts.isVariableDeclaration, function (n) { return n; }, type(function (n) {
            var type = _this.typeHelper.getCType(n.initializer);
            if (type instanceof ctypes_1.FuncType && type.closureParams.length)
                return new ctypes_1.FuncType({ needsClosureStruct: true });
            else
                return null;
        }));
        addEquality(utils_1.isForOfWithSimpleInitializer, function (n) { return n.expression; }, type(function (n) { return new ctypes_1.ArrayType(_this.typeHelper.getCType(n.initializer.declarations[0]) || ctypes_1.PointerVarType, 0, false); }));
        addEquality(utils_1.isForOfWithSimpleInitializer, function (n) { return n.initializer.declarations[0]; }, type(function (n) {
            var type = _this.typeHelper.getCType(n.expression);
            return type instanceof ctypes_1.ArrayType ? type.elementType : null;
        }));
        addEquality(utils_1.isForOfWithIdentifierInitializer, function (n) { return n.expression; }, type(function (n) { return new ctypes_1.ArrayType(_this.typeHelper.getCType(n.initializer) || ctypes_1.PointerVarType, 0, false); }));
        addEquality(utils_1.isForOfWithIdentifierInitializer, function (n) { return n.initializer; }, type(function (n) {
            var type = _this.typeHelper.getCType(n.expression);
            return type instanceof ctypes_1.ArrayType ? type.elementType : null;
        }));
        addEquality(ts.isForInStatement, function (n) { return n.initializer; }, type(ctypes_1.StringVarType));
        addEquality(ts.isForInStatement, function (n) { return n.expression; }, type(function (_) { return new ctypes_1.DictType(ctypes_1.PointerVarType); }));
        addEquality(ts.isReturnStatement, function (n) { return n.expression; }, type(function (n) { return ctypes_1.FuncType.getReturnType(_this.typeHelper, utils_1.findParentFunction(n)); }));
        addEquality(ts.isReturnStatement, function (n) { return utils_1.findParentFunction(n); }, type(function (n) { return _this.typeHelper.getCType(n.expression) ? new ctypes_1.FuncType({ returnType: _this.typeHelper.getCType(n.expression) }) : null; }));
        addEquality(ts.isCaseClause, function (n) { return n.expression; }, function (n) { return n.parent.parent.expression; });
        addEquality(ts.isCatchClause, function (n) { return n.variableDeclaration; }, type(ctypes_1.StringVarType));
        this.resolveTypes(typeEqualities);
    };
    TypeResolver.prototype.resolveTypes = function (typeEqualities) {
        var _this = this;
        this.allNodes.forEach(function (n) { return _this.setNodeType(n, _this.typeHelper.getCType(n)); });
        var equalities = [];
        typeEqualities.forEach(function (teq) {
            return _this.allNodes.forEach(function (node) { if (teq[0].bind(_this)(node))
                equalities.push([node, teq]); });
        });
        var changed;
        do {
            changed = false;
            for (var _i = 0, equalities_1 = equalities; _i < equalities_1.length; _i++) {
                var equality = equalities_1[_i];
                var node = equality[0], _a = equality[1], _ = _a[0], node1_func = _a[1], node2_resolver = _a[2];
                var node1 = node1_func(node);
                if (!node1)
                    continue;
                var type1 = this.typeHelper.getCType(node1);
                var node2 = node2_resolver.getNode ? node2_resolver.getNode(node) : null;
                var type2 = node2_resolver.getType ? node2_resolver.getType(node) : this.typeHelper.getCType(node2);
                if (!node2 && !type2)
                    continue;
                var _b = this.typeMerger.mergeTypes(type1, type2), type = _b.type, replaced = _b.replaced;
                if (type && replaced) {
                    if (type != type1)
                        changed = true;
                    if (node2 && type != type2)
                        changed = true;
                    this.setNodeType(node1, type);
                    if (node2)
                        this.propagateNodeType(node1, node2);
                }
            }
        } while (changed);
        for (var k in this.typeOfNodeDict) {
            var type = this.typeOfNodeDict[k].type;
            if (type instanceof ctypes_1.ArrayType && !type.isDynamicArray && type.capacity == 0)
                type.isDynamicArray = true;
            if (type instanceof ctypes_1.StructType && Object.keys(type.properties).length == 0)
                this.typeOfNodeDict[k].type = new ctypes_1.DictType(ctypes_1.PointerVarType);
        }
        this.allNodes
            .filter(function (n) { return ts.isFunctionLike(n); })
            .forEach(function (n) { return console.log(n.getText(), "|", ts.SyntaxKind[n.kind], "|", _this.typeHelper.getCType(n).getBodyText()); });
        /*
        this.allNodes
            .filter(n => !ts.isToken(n) && !ts.isBlock(n) && n.kind != ts.SyntaxKind.SyntaxList)
            .forEach(n => console.log(n.getText(), "|", ts.SyntaxKind[n.kind], "|", JSON.stringify(this.typeHelper.getCType(n))));
        */
    };
    TypeResolver.prototype.setNodeType = function (n, t) {
        if (n && t) {
            var key = n.pos + "_" + n.end;
            if (!this.typeOfNodeDict[key])
                this.typeOfNodeDict[key] = { type: t };
            else
                this.typeOfNodeDict[key].type = t;
        }
    };
    TypeResolver.prototype.propagateNodeType = function (from, to) {
        var typeToKeep = this.typeOfNodeDict[from.pos + "_" + from.end];
        var typeToRemove = this.typeOfNodeDict[to.pos + "_" + to.end];
        this.typeOfNodeDict[to.pos + "_" + to.end] = typeToRemove;
        for (var key in this.typeOfNodeDict)
            if (this.typeOfNodeDict[key] === typeToRemove)
                this.typeOfNodeDict[key] = typeToKeep;
    };
    return TypeResolver;
}());
exports.TypeResolver = TypeResolver;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../standard":14,"./ctypes":44,"./findcircular":45,"./utils":49}],48:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var standard_1 = require("../standard");
var ctypes_1 = require("./ctypes");
var merge_1 = require("./merge");
var resolve_1 = require("./resolve");
var utils_1 = require("./utils");
var TypeHelper = /** @class */ (function () {
    function TypeHelper(typeChecker, allNodes) {
        this.typeChecker = typeChecker;
        this.arrayLiteralsTypes = {};
        this.objectLiteralsTypes = {};
        this.typeOfNodeDict = {};
        this.typeMerger = new merge_1.TypeMerger();
        this.scopeVariables = {};
        this.typeResolver = new resolve_1.TypeResolver(typeChecker, allNodes, this, this.typeMerger, this.typeOfNodeDict);
    }
    TypeHelper.prototype.inferTypes = function () {
        this.typeResolver.inferTypes();
    };
    /** Get C type of TypeScript node */
    TypeHelper.prototype.getCType = function (node) {
        if (!node || !node.kind)
            return null;
        var found = this.typeOfNodeDict[node.pos + "_" + node.end];
        if (found)
            return found.type;
        switch (node.kind) {
            case ts.SyntaxKind.NumericLiteral:
                return ctypes_1.NumberVarType;
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
                return ctypes_1.BooleanVarType;
            case ts.SyntaxKind.StringLiteral:
                return ctypes_1.StringVarType;
            case ts.SyntaxKind.RegularExpressionLiteral:
                return ctypes_1.RegexVarType;
            case ts.SyntaxKind.ArrayLiteralExpression:
                {
                    if (!this.arrayLiteralsTypes[node.pos])
                        this.determineArrayType(node);
                    return this.arrayLiteralsTypes[node.pos];
                }
            case ts.SyntaxKind.ObjectLiteralExpression:
                {
                    if (!this.objectLiteralsTypes[node.pos])
                        this.objectLiteralsTypes[node.pos] = this.generateStructure(this.typeChecker.getTypeAtLocation(node));
                    return this.objectLiteralsTypes[node.pos];
                }
            case ts.SyntaxKind.CallExpression:
                {
                    var call = node;
                    var retType = standard_1.StandardCallHelper.getReturnType(this, call);
                    if (retType)
                        return retType;
                }
        }
        if (node.kind != ts.SyntaxKind.ImportClause && node.pos != -1) {
            var tsType = this.typeChecker.getTypeAtLocation(node);
            var type = tsType && this.convertType(tsType, node);
            if (type)
                return type;
        }
        return null;
    };
    /** Get textual representation of type of the parameter for inserting into the C code */
    TypeHelper.prototype.getTypeString = function (source) {
        var cType = source;
        if (source && source.flags != null && source.intrinsicName != null) // ts.Type
            cType = this.convertType(source);
        else if (source && source.flags != null && source.callSignatures != null && source.constructSignatures != null) // ts.Type
            cType = this.convertType(source);
        else if (source && source.kind != null && source.flags != null) // ts.Node
            cType = this.getCType(source);
        if (cType instanceof ctypes_1.ArrayType || cType instanceof ctypes_1.StructType || cType instanceof ctypes_1.DictType || cType instanceof ctypes_1.FuncType)
            return cType.getText();
        else if (typeof cType === 'string')
            return cType;
        else
            return "/* Cannot determine variable type from source " + (source && source.getText ? source.getText() : JSON.stringify(source)) + "*/";
    };
    TypeHelper.prototype.getDeclaration = function (n) {
        var s = this.typeChecker.getSymbolAtLocation(n);
        return s && s.valueDeclaration;
    };
    TypeHelper.prototype.registerSyntheticNode = function (n, t) {
        if (!n || !(n.flags & ts.NodeFlags.Synthesized))
            return false;
        n.end = TypeHelper.syntheticNodesCounter++;
        this.typeResolver.setNodeType(n, t);
    };
    TypeHelper.prototype.registerScopeVariable = function (decl) {
        this.scopeVariables[decl.pos] = true;
    };
    TypeHelper.prototype.isScopeVariableDeclaration = function (decl) {
        return this.scopeVariables[decl.pos] || false;
    };
    TypeHelper.prototype.isScopeVariable = function (n) {
        var decl = this.getDeclaration(n);
        return decl && this.scopeVariables[decl.pos] || false;
    };
    /** Convert ts.Type to CType */
    TypeHelper.prototype.convertType = function (tsType, node) {
        if (!tsType || tsType.flags == ts.TypeFlags.Void)
            return ctypes_1.VoidType;
        if (tsType.flags == ts.TypeFlags.String || tsType.flags == ts.TypeFlags.StringLiteral)
            return ctypes_1.StringVarType;
        if (tsType.flags == ts.TypeFlags.Number || tsType.flags == ts.TypeFlags.NumberLiteral)
            return ctypes_1.NumberVarType;
        if (tsType.flags == ts.TypeFlags.Boolean || tsType.flags == (ts.TypeFlags.Boolean + ts.TypeFlags.Union))
            return ctypes_1.BooleanVarType;
        if (tsType.flags & ts.TypeFlags.Object && tsType.getProperties().length > 0 && tsType.getProperties().every(function (s) { return /[a-zA-Z_]/.test(s.name); })) {
            var structType = this.generateStructure(tsType);
            var baseType = this.typeChecker.getBaseTypeOfLiteralType(tsType);
            var cTypeTag = baseType && baseType.symbol && baseType.symbol.getJsDocTags().filter(function (t) { return t.name == "ctype"; })[0];
            structType.forcedType = cTypeTag && cTypeTag.text.trim();
            structType.external = baseType && baseType.symbol && utils_1.findParentSourceFile(baseType.symbol.declarations[0]).isDeclarationFile;
            return structType;
        }
        return null;
    };
    TypeHelper.prototype.generateStructure = function (tsType) {
        var userStructInfo = {};
        for (var _i = 0, _a = tsType.getProperties(); _i < _a.length; _i++) {
            var prop = _a[_i];
            if (prop.name == "prototype")
                continue;
            var declaration = prop.valueDeclaration;
            var propTsType = this.typeChecker.getTypeOfSymbolAtLocation(prop, declaration);
            var propType = this.convertType(propTsType, declaration.name) || ctypes_1.PointerVarType;
            if (propType == ctypes_1.PointerVarType && ts.isPropertyAssignment(declaration)) {
                if (declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer))
                    propType = this.determineArrayType(declaration.initializer);
            }
            userStructInfo[prop.name] = { type: propType, order: declaration.pos };
        }
        return this.typeMerger.ensureNoTypeDuplicates(new ctypes_1.StructType(userStructInfo));
    };
    TypeHelper.prototype.determineArrayType = function (arrLiteral) {
        var elementType = ctypes_1.PointerVarType;
        var cap = arrLiteral.elements.length;
        if (cap > 0)
            elementType = this.convertType(this.typeChecker.getTypeAtLocation(arrLiteral.elements[0])) || ctypes_1.PointerVarType;
        var type = new ctypes_1.ArrayType(elementType, cap, false);
        this.arrayLiteralsTypes[arrLiteral.pos] = type;
        return type;
    };
    TypeHelper.syntheticNodesCounter = 0;
    return TypeHelper;
}());
exports.TypeHelper = TypeHelper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../standard":14,"./ctypes":44,"./merge":46,"./resolve":47,"./utils":49}],49:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var ctypes_1 = require("./ctypes");
function isNode(n) {
    return n && n.kind !== undefined && n.flags !== undefined && n.pos !== undefined && n.end !== undefined;
}
exports.isNode = isNode;
function isEqualsExpression(n) {
    return n && n.kind == ts.SyntaxKind.BinaryExpression && n.operatorToken.kind == ts.SyntaxKind.EqualsToken;
}
exports.isEqualsExpression = isEqualsExpression;
function isFieldAssignment(n) {
    return n && n.kind == ts.SyntaxKind.BinaryExpression && n.operatorToken.kind == ts.SyntaxKind.EqualsToken && (isFieldElementAccess(n.left) || isFieldPropertyAccess(n.left));
}
exports.isFieldAssignment = isFieldAssignment;
function isMethodCall(n) {
    return ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression);
}
exports.isMethodCall = isMethodCall;
function isFunction(n) {
    return ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n);
}
exports.isFunction = isFunction;
function isFunctionArgInMethodCall(n) {
    return ts.isFunctionExpression(n) && ts.isCallExpression(n.parent) && n.parent.arguments[0] == n && ts.isPropertyAccessExpression(n.parent.expression);
}
exports.isFunctionArgInMethodCall = isFunctionArgInMethodCall;
function isFieldElementAccess(n) {
    return ts.isElementAccessExpression(n) && (!ts.isCallExpression(n.parent) || n.parent.expression != n);
}
exports.isFieldElementAccess = isFieldElementAccess;
function isFieldPropertyAccess(n) {
    return ts.isPropertyAccessExpression(n) && (!ts.isCallExpression(n.parent) || n.parent.expression != n);
}
exports.isFieldPropertyAccess = isFieldPropertyAccess;
function isForOfWithSimpleInitializer(n) {
    return ts.isForOfStatement(n) && ts.isVariableDeclarationList(n.initializer) && n.initializer.declarations.length == 1;
}
exports.isForOfWithSimpleInitializer = isForOfWithSimpleInitializer;
function isForOfWithIdentifierInitializer(n) {
    return ts.isForOfStatement(n) && ts.isIdentifier(n.initializer);
}
exports.isForOfWithIdentifierInitializer = isForOfWithIdentifierInitializer;
function isLiteral(n) {
    return ts.isNumericLiteral(n) || ts.isStringLiteral(n) || ts.isRegularExpressionLiteral(n) || n.kind == ts.SyntaxKind.TrueKeyword || n.kind == ts.SyntaxKind.FalseKeyword;
}
exports.isLiteral = isLiteral;
function isUnaryExpression(n) {
    return ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n);
}
exports.isUnaryExpression = isUnaryExpression;
exports.SyntaxKind_NaNKeyword = ts.SyntaxKind.Count + 1;
function isNullOrUndefinedOrNaN(n) {
    return n.kind === ts.SyntaxKind.NullKeyword || n.kind === ts.SyntaxKind.UndefinedKeyword || n.kind === exports.SyntaxKind_NaNKeyword;
}
exports.isNullOrUndefinedOrNaN = isNullOrUndefinedOrNaN;
function isNullOrUndefined(n) {
    return n.kind === ts.SyntaxKind.NullKeyword || n.kind === ts.SyntaxKind.UndefinedKeyword;
}
exports.isNullOrUndefined = isNullOrUndefined;
function isDeleteExpression(n) {
    return ts.isDeleteExpression(n) && (ts.isPropertyAccessExpression(n.expression) || ts.isElementAccessExpression(n.expression));
}
exports.isDeleteExpression = isDeleteExpression;
function isThisKeyword(n) {
    return n.kind === ts.SyntaxKind.ThisKeyword;
}
exports.isThisKeyword = isThisKeyword;
function isCompoundAssignment(n) {
    if (ts.isBinaryExpression(n))
        return n.operatorToken.kind >= ts.SyntaxKind.FirstCompoundAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastCompoundAssignment;
    else
        return n.kind >= ts.SyntaxKind.FirstCompoundAssignment && n.kind <= ts.SyntaxKind.LastCompoundAssignment;
}
exports.isCompoundAssignment = isCompoundAssignment;
function isNumberOp(op) {
    return [
        ts.SyntaxKind.MinusToken, ts.SyntaxKind.MinusEqualsToken,
        ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.AsteriskEqualsToken,
        ts.SyntaxKind.SlashToken, ts.SyntaxKind.SlashEqualsToken,
        ts.SyntaxKind.PercentToken, ts.SyntaxKind.PercentEqualsToken,
    ].indexOf(op) > -1;
}
exports.isNumberOp = isNumberOp;
function isIntegerOp(op) {
    return [
        ts.SyntaxKind.LessThanLessThanToken, ts.SyntaxKind.LessThanLessThanEqualsToken,
        ts.SyntaxKind.GreaterThanGreaterThanToken, ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
        ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
        ts.SyntaxKind.BarToken, ts.SyntaxKind.BarEqualsToken,
        ts.SyntaxKind.AmpersandToken, ts.SyntaxKind.AmpersandEqualsToken
    ].indexOf(op) > -1;
}
exports.isIntegerOp = isIntegerOp;
function isRelationalOp(op) {
    return [
        ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken,
        ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken
    ].indexOf(op) > -1;
}
exports.isRelationalOp = isRelationalOp;
function isEqualityOp(op) {
    return [
        ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ].indexOf(op) > -1;
}
exports.isEqualityOp = isEqualityOp;
function isLogicOp(op) {
    return [
        ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken
    ].indexOf(op) > -1;
}
exports.isLogicOp = isLogicOp;
function isPlusOp(op) {
    return op == ts.SyntaxKind.PlusToken || op == ts.SyntaxKind.PlusEqualsToken;
}
exports.isPlusOp = isPlusOp;
function isStringLiteralAsIdentifier(n) {
    return ts.isStringLiteral(n) && /^[A-Za-z_][A-Za-z_0-9]*$/.test(n.text);
}
exports.isStringLiteralAsIdentifier = isStringLiteralAsIdentifier;
function isInBoolContext(n) {
    while (ts.isBinaryExpression(n.parent) && isLogicOp(n.parent.operatorToken.kind))
        n = n.parent;
    return ts.isPrefixUnaryExpression(n.parent) && n.parent.operator === ts.SyntaxKind.ExclamationToken
        || ts.isIfStatement(n.parent) && n.parent.expression === n
        || ts.isWhileStatement(n.parent) && n.parent.expression === n
        || ts.isDoStatement(n.parent) && n.parent.expression === n
        || ts.isForStatement(n.parent) && n.parent.condition === n;
}
exports.isInBoolContext = isInBoolContext;
function isSimpleNode(n) {
    return ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isIdentifier(n);
}
exports.isSimpleNode = isSimpleNode;
function isSideEffectExpression(n) {
    return isEqualsExpression(n) || isCompoundAssignment(n)
        || isUnaryExpression(n) && n.operator === ts.SyntaxKind.PlusPlusToken
        || isUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusMinusToken
        || ts.isCallExpression(n)
        || ts.isNewExpression(n);
}
exports.isSideEffectExpression = isSideEffectExpression;
function operandsToNumber(leftType, op, rightType) {
    return isNumberOp(op) || isIntegerOp(op)
        || op == ts.SyntaxKind.PlusToken && !toNumberCanBeNaN(leftType) && !toNumberCanBeNaN(rightType)
        || isRelationalOp(op) && (leftType !== ctypes_1.StringVarType || rightType !== ctypes_1.StringVarType);
}
exports.operandsToNumber = operandsToNumber;
function getBinExprResultType(mergeTypes, leftType, op, rightType) {
    if (op === ts.SyntaxKind.EqualsToken)
        return rightType;
    if (isRelationalOp(op) || isEqualityOp(op) || op === ts.SyntaxKind.InKeyword || op === ts.SyntaxKind.InstanceOfKeyword)
        return ctypes_1.BooleanVarType;
    if (leftType == null || rightType == null)
        return null;
    if (isLogicOp(op))
        return mergeTypes(leftType, rightType).type;
    if (isNumberOp(op) || isIntegerOp(op))
        return toNumberCanBeNaN(leftType) || toNumberCanBeNaN(rightType) ? ctypes_1.UniversalVarType : ctypes_1.NumberVarType;
    if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.PlusEqualsToken)
        return leftType === ctypes_1.UniversalVarType || rightType === ctypes_1.UniversalVarType ? ctypes_1.UniversalVarType
            : toPrimitive(leftType) === ctypes_1.StringVarType || toPrimitive(rightType) === ctypes_1.StringVarType ? ctypes_1.StringVarType
                : toPrimitive(leftType) === ctypes_1.NumberVarType && toPrimitive(rightType) == ctypes_1.NumberVarType ? ctypes_1.NumberVarType
                    : null;
    console.log("WARNING: unexpected binary expression!");
    return null;
}
exports.getBinExprResultType = getBinExprResultType;
function getUnaryExprResultType(op, operandType) {
    if (op === ts.SyntaxKind.ExclamationToken) {
        return ctypes_1.BooleanVarType;
    }
    else if (op === ts.SyntaxKind.TildeToken) {
        return ctypes_1.NumberVarType;
    }
    else {
        return toNumberCanBeNaN(operandType) ? ctypes_1.UniversalVarType : ctypes_1.NumberVarType;
    }
}
exports.getUnaryExprResultType = getUnaryExprResultType;
function toNumberCanBeNaN(t) {
    return t !== null && t !== ctypes_1.PointerVarType && t !== ctypes_1.NumberVarType && t !== ctypes_1.BooleanVarType && !(t instanceof ctypes_1.ArrayType && !t.isDynamicArray && t.capacity == 1 && !toNumberCanBeNaN(t.elementType));
}
exports.toNumberCanBeNaN = toNumberCanBeNaN;
function toPrimitive(t) {
    return t === null || t === ctypes_1.PointerVarType ? t : t === ctypes_1.NumberVarType || t === ctypes_1.BooleanVarType ? ctypes_1.NumberVarType : ctypes_1.StringVarType;
}
exports.toPrimitive = toPrimitive;
function findParentFunction(node) {
    var parentFunc = node;
    while (parentFunc && !isFunction(parentFunc))
        parentFunc = parentFunc.parent;
    return parentFunc;
}
exports.findParentFunction = findParentFunction;
function findParentSourceFile(node) {
    var parent = node;
    while (!ts.isSourceFile(parent))
        parent = parent.parent;
    return parent;
}
exports.findParentSourceFile = findParentSourceFile;
function getAllFunctionNodesInFunction(node) {
    var nodes = node.getChildren().slice();
    var foundFuncNodes = [];
    var cur;
    while (cur = nodes.shift()) {
        if (ts.isFunctionLike(cur)) {
            foundFuncNodes.push(cur);
        }
        else
            nodes.push.apply(nodes, cur.getChildren());
    }
    return foundFuncNodes;
}
exports.getAllFunctionNodesInFunction = getAllFunctionNodesInFunction;
function getAllNodesInFunction(node) {
    var i = 0;
    var nodes = node.getChildren();
    while (i < nodes.length) {
        if (ts.isFunctionLike(nodes[i]))
            i++;
        else
            nodes.push.apply(nodes, nodes[i++].getChildren());
    }
    return nodes;
}
exports.getAllNodesInFunction = getAllNodesInFunction;
function getAllNodesUnder(node) {
    var i = 0;
    var nodes = [node];
    while (i < nodes.length)
        nodes.push.apply(nodes, nodes[i++].getChildren());
    return nodes;
}
exports.getAllNodesUnder = getAllNodesUnder;
function isUnder(container, item) {
    var parent = item;
    while (parent && parent != container)
        parent = parent.parent;
    return parent;
}
exports.isUnder = isUnder;
function hasType(refType, type) {
    return refType == type
        || refType instanceof ctypes_1.StructType && Object.keys(refType.properties).some(function (k) { return hasType(refType.properties[k], type); })
        || refType instanceof ctypes_1.ArrayType && hasType(refType.elementType, type)
        || refType instanceof ctypes_1.DictType && hasType(refType.elementType, type)
        || refType instanceof ctypes_1.FuncType && hasType(refType.returnType, type)
        || refType instanceof ctypes_1.FuncType && hasType(refType.instanceType, type)
        || refType instanceof ctypes_1.FuncType && refType.parameterTypes.some(function (pt) { return hasType(pt, type); });
}
exports.hasType = hasType;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ctypes":44}],50:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var program_1 = require("./src/program");
function transpile(source) {
    var sourceFile = ts.createSourceFile('source.ts', source, ts.ScriptTarget.ES5, true);
    var compilerHost = {
        getSourceFile: function (fileName, target) { return 'source.ts' ? sourceFile : null; },
        writeFile: function (name, text, writeByteOrderMark) { },
        getDefaultLibFileName: function () { return "lib.d.ts"; },
        useCaseSensitiveFileNames: function () { return false; },
        getCanonicalFileName: function (fileName) { return fileName; },
        getCurrentDirectory: function () { return ""; },
        getDirectories: function () { return []; },
        getNewLine: function () { return "\n"; },
        fileExists: function (fileName) { return fileName == 'source.ts'; },
        readFile: function (fileName) { return fileName == 'source.ts' ? source : null; },
        directoryExists: function (dirName) { return dirName == ""; },
    };
    var program = ts.createProgram(['source.ts'], { noLib: true }, compilerHost);
    return new program_1.CProgram(program)["resolve"]();
}
exports.transpile = transpile;
;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./src/program":12}]},{},[50])(50)
});
