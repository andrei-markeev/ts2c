(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ts2c = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var types_1 = require("./types");
var standard_1 = require("./standard");
var match_1 = require("./standard/string/match");
var MemoryManager = /** @class */ (function () {
    function MemoryManager(typeChecker, typeHelper, symbolsHelper) {
        this.typeChecker = typeChecker;
        this.typeHelper = typeHelper;
        this.symbolsHelper = symbolsHelper;
        this.scopes = {};
        this.scopesOfVariables = {};
        this.reusedVariables = {};
        this.originalNodes = {};
        this.references = {};
    }
    MemoryManager.prototype.scheduleNodeDisposals = function (nodes) {
        var _this = this;
        nodes.filter(function (n) { return ts.isIdentifier(n); }).forEach(function (n) {
            var symbol = _this.typeChecker.getSymbolAtLocation(n);
            if (symbol) {
                _this.references[symbol.valueDeclaration.pos] = _this.references[symbol.valueDeclaration.pos] || [];
                _this.references[symbol.valueDeclaration.pos].push(n);
            }
        });
        for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
            var node = nodes_1[_i];
            switch (node.kind) {
                case ts.SyntaxKind.ArrayLiteralExpression:
                    {
                        var type = this.typeHelper.getCType(node);
                        if (type && type instanceof types_1.ArrayType && type.isDynamicArray)
                            this.scheduleNodeDisposal(node);
                    }
                    break;
                case ts.SyntaxKind.ObjectLiteralExpression:
                    {
                        var type = this.typeHelper.getCType(node);
                        if (type && (type instanceof types_1.StructType || type instanceof types_1.DictType))
                            this.scheduleNodeDisposal(node);
                    }
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    {
                        var binExpr = node;
                        if (binExpr.operatorToken.kind == ts.SyntaxKind.PlusToken
                            || binExpr.operatorToken.kind == ts.SyntaxKind.FirstCompoundAssignment) {
                            var leftType = this.typeHelper.getCType(binExpr.left);
                            var rightType = this.typeHelper.getCType(binExpr.right);
                            if (leftType == types_1.StringVarType || rightType == types_1.StringVarType)
                                this.scheduleNodeDisposal(binExpr, false);
                        }
                    }
                    break;
                case ts.SyntaxKind.CallExpression:
                    {
                        if (standard_1.StandardCallHelper.needsDisposal(this.typeHelper, node))
                            this.scheduleNodeDisposal(node);
                    }
                    break;
            }
        }
    };
    MemoryManager.prototype.getGCVariablesForScope = function (node) {
        var parentDecl = this.findParentFunctionNode(node);
        var scopeId = parentDecl && parentDecl.pos + 1 + "" || "main";
        var realScopeId = this.scopes[scopeId] && this.scopes[scopeId].length && this.scopes[scopeId][0].scopeId;
        var gcVars = [];
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(function (v) { return !v.simple && !v.array && !v.dict && !v.arrayWithContents; }).length) {
            gcVars.push("gc_" + realScopeId);
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
        var parentDecl = this.findParentFunctionNode(node);
        var scopeId = parentDecl && parentDecl.pos + 1 || "main";
        var destructors = [];
        if (this.scopes[scopeId]) {
            // string match allocates array of strings, and each of those strings should be also disposed
            for (var _i = 0, _a = this.scopes[scopeId].filter(function (v) { return v.simple && v.used; }); _i < _a.length; _i++) {
                var simpleVarScopeInfo = _a[_i];
                destructors.push({
                    varName: simpleVarScopeInfo.varName,
                    array: simpleVarScopeInfo.array,
                    dict: simpleVarScopeInfo.dict,
                    string: this.typeHelper.getCType(simpleVarScopeInfo.node) == types_1.StringVarType,
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
    MemoryManager.prototype.scheduleNodeDisposal = function (heapNode, canReuse) {
        if (canReuse === void 0) { canReuse = true; }
        var isTemp = true;
        if (canReuse) {
            var existingVariable = this.tryReuseExistingVariable(heapNode);
            isTemp = existingVariable == null;
            if (!isTemp) {
                this.reusedVariables[heapNode.pos + "_" + heapNode.end] = existingVariable.pos + "_" + existingVariable.end;
                this.originalNodes[existingVariable.pos + "_" + existingVariable.end] = heapNode;
                heapNode = existingVariable;
            }
        }
        var varFuncNode = this.findParentFunctionNode(heapNode);
        var topScope = varFuncNode && varFuncNode.pos + 1 || "main";
        var isSimple = true;
        if (this.isInsideLoop(heapNode))
            isSimple = false;
        var scopeTree = {};
        scopeTree[topScope] = true;
        var queue = [heapNode];
        queue.push();
        var visited = {};
        while (queue.length > 0) {
            var node = queue.shift();
            if (visited[node.pos + "_" + node.end])
                continue;
            var refs = [node];
            if (node.kind == ts.SyntaxKind.Identifier) {
                var symbol = this.typeChecker.getSymbolAtLocation(node);
                if (symbol)
                    refs = this.references[symbol.valueDeclaration.pos] || refs;
            }
            var returned = false;
            for (var _i = 0, refs_1 = refs; _i < refs_1.length; _i++) {
                var ref = refs_1[_i];
                visited[ref.pos + "_" + ref.end] = true;
                var parentNode = this.findParentFunctionNode(ref);
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
                if (ref.parent && ref.parent.kind == ts.SyntaxKind.CallExpression) {
                    var call = ref.parent;
                    if (call.expression.kind == ts.SyntaxKind.Identifier && call.expression.pos == ref.pos) {
                        console.log(heapNode.getText() + " -> Found function call!");
                        if (topScope !== "main") {
                            var funcNode = this.findParentFunctionNode(call);
                            topScope = funcNode && funcNode.pos + 1 || "main";
                            var targetScope = node.parent.pos + 1 + "";
                            isSimple = false;
                            if (scopeTree[targetScope])
                                delete scopeTree[targetScope];
                            scopeTree[topScope] = targetScope;
                        }
                        this.addIfFoundInAssignment(heapNode, call, queue);
                    }
                    else {
                        var symbol = this.typeChecker.getSymbolAtLocation(call.expression);
                        if (!symbol) {
                            var isStandardCall = standard_1.StandardCallHelper.isStandardCall(this.typeHelper, call);
                            if (isStandardCall) {
                                var standardCallEscapeNode = standard_1.StandardCallHelper.getEscapeNode(this.typeHelper, call);
                                if (standardCallEscapeNode) {
                                    console.log(heapNode.getText() + " escapes to '" + standardCallEscapeNode.getText() + "' via standard call '" + call.getText() + "'.");
                                    queue.push(standardCallEscapeNode);
                                }
                            }
                            else {
                                console.log(heapNode.getText() + " -> Detected passing to external function " + call.expression.getText() + ". Scope changed to main.");
                                topScope = "main";
                                isSimple = false;
                            }
                        }
                        else {
                            var funcDecl = symbol.valueDeclaration;
                            for (var i = 0; i < call.arguments.length; i++) {
                                if (call.arguments[i].pos <= ref.pos && call.arguments[i].end >= ref.end) {
                                    if (funcDecl.pos + 1 == topScope) {
                                        console.log(heapNode.getText() + " -> Found recursive call with parameter " + funcDecl.parameters[i].name.getText());
                                        queue.push(funcDecl.name);
                                    }
                                    else {
                                        console.log(heapNode.getText() + " -> Found passing to function " + call.expression.getText() + " as parameter " + funcDecl.parameters[i].name.getText());
                                        queue.push(funcDecl.parameters[i].name);
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
                    this.addIfFoundInAssignment(heapNode, ref, queue);
            }
        }
        var type = this.typeHelper.getCType(heapNode);
        var varName;
        if (ts.isArrayLiteralExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_array");
        else if (ts.isObjectLiteralExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_obj");
        else if (ts.isBinaryExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, "tmp_string");
        else if (ts.isCallExpression(heapNode))
            varName = this.symbolsHelper.addTemp(heapNode, standard_1.StandardCallHelper.getTempVarName(this.typeHelper, heapNode));
        else
            varName = heapNode.getText().replace(/\./g, "->");
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
            array: !arrayWithContents && type && type instanceof types_1.ArrayType && type.isDynamicArray,
            dict: type && type instanceof types_1.DictType,
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
    MemoryManager.prototype.findParentFunctionNode = function (node) {
        var parent = node;
        while (parent && parent.kind != ts.SyntaxKind.FunctionDeclaration) {
            parent = parent.parent;
        }
        return parent;
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
},{"./standard":13,"./standard/string/match":34,"./types":41}],2:[function(require,module,exports){
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
var template_1 = require("../template");
var types_1 = require("../types");
var elementaccess_1 = require("./elementaccess");
var AssignmentHelper = /** @class */ (function () {
    function AssignmentHelper() {
    }
    AssignmentHelper.create = function (scope, left, right, inline) {
        if (inline === void 0) { inline = false; }
        var accessor;
        var varType;
        var argumentExpression;
        if (left.kind == ts.SyntaxKind.ElementAccessExpression) {
            var elemAccess = left;
            varType = scope.root.typeHelper.getCType(elemAccess.expression);
            if (elemAccess.expression.kind == ts.SyntaxKind.Identifier)
                accessor = elemAccess.expression.getText();
            else
                accessor = new elementaccess_1.CElementAccess(scope, elemAccess.expression);
            if (varType instanceof types_1.StructType && elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
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
var CAssignment = /** @class */ (function () {
    function CAssignment(scope, accessor, argumentExpression, type, right, inline) {
        if (inline === void 0) { inline = false; }
        var _this = this;
        this.accessor = accessor;
        this.argumentExpression = argumentExpression;
        this.isObjLiteralAssignment = false;
        this.isArrayLiteralAssignment = false;
        this.isDynamicArray = false;
        this.isStaticArray = false;
        this.isStruct = false;
        this.isDict = false;
        this.assignmentRemoved = false;
        this.CR = inline ? "" : ";\n";
        this.isSimpleVar = typeof type === 'string';
        this.isDynamicArray = type instanceof types_1.ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof types_1.ArrayType && !type.isDynamicArray;
        this.isDict = type instanceof types_1.DictType;
        this.isStruct = type instanceof types_1.StructType;
        this.nodeText = right.getText();
        var argType = type;
        var argAccessor = accessor;
        if (argumentExpression) {
            if (type instanceof types_1.StructType && typeof argumentExpression === 'string')
                argType = type.properties[argumentExpression];
            else if (type instanceof types_1.ArrayType)
                argType = type.elementType;
            argAccessor = new elementaccess_1.CSimpleElementAccess(scope, type, accessor, argumentExpression);
        }
        var isTempVar = !!scope.root.memoryManager.getReservedTemporaryVarName(right);
        if (right.kind == ts.SyntaxKind.ObjectLiteralExpression && !isTempVar) {
            this.isObjLiteralAssignment = true;
            var objLiteral = right;
            this.objInitializers = objLiteral.properties
                .filter(function (p) { return p.kind == ts.SyntaxKind.PropertyAssignment; })
                .map(function (p) { return p; })
                .map(function (p) { return new CAssignment_1(scope, argAccessor, _this.isDict ? '"' + p.name.getText() + '"' : p.name.getText(), argType, p.initializer); });
        }
        else if (right.kind == ts.SyntaxKind.ArrayLiteralExpression && !isTempVar) {
            this.isArrayLiteralAssignment = true;
            var arrLiteral = right;
            this.arrayLiteralSize = arrLiteral.elements.length;
            this.arrInitializers = arrLiteral.elements.map(function (e, i) { return new CAssignment_1(scope, argAccessor, "" + i, argType, e); });
        }
        else
            this.expression = template_1.CodeTemplateFactory.createForNode(scope, right);
        if (this.argumentExpression == null) {
            var expr = typeof this.expression == "string" ? this.expression : this.expression && this.expression["resolve"] && this.expression["resolve"]();
            var acc = typeof this.accessor == "string" ? this.accessor : this.accessor && this.accessor["resolve"] && this.accessor["resolve"]();
            if (expr == '' || acc == expr || "((void *)" + acc + ")" == expr)
                this.assignmentRemoved = true;
        }
    }
    CAssignment_1 = CAssignment;
    CAssignment = CAssignment_1 = __decorate([
        template_1.CodeTemplate("\n{#if assignmentRemoved}\n{#elseif isObjLiteralAssignment}\n    {objInitializers}\n{#elseif isArrayLiteralAssignment}\n    {arrInitializers}\n{#elseif isDynamicArray && argumentExpression == null}\n    {accessor} = ((void *){expression}){CR}\n{#elseif argumentExpression == null}\n    {accessor} = {expression}{CR}\n{#elseif isStruct}\n    {accessor}->{argumentExpression} = {expression}{CR}\n{#elseif isDict}\n    DICT_SET({accessor}, {argumentExpression}, {expression}){CR}\n{#elseif isDynamicArray}\n    {accessor}->data[{argumentExpression}] = {expression}{CR}\n{#elseif isStaticArray}\n    {accessor}[{argumentExpression}] = {expression}{CR}\n{#else}\n    /* Unsupported assignment {accessor}[{argumentExpression}] = {nodeText} */{CR}\n{/if}")
    ], CAssignment);
    return CAssignment;
    var CAssignment_1;
}());
exports.CAssignment = CAssignment;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":40,"../types":41,"./elementaccess":4}],3:[function(require,module,exports){
(function (global){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var standard_1 = require("../standard");
var template_1 = require("../template");
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var CCallExpression = /** @class */ (function () {
    function CCallExpression(scope, call) {
        this.funcName = call.expression.getText();
        this.standardCall = standard_1.StandardCallHelper.createTemplate(scope, call);
        if (this.standardCall) {
            return;
        }
        this.arguments = call.arguments.map(function (a) {
            return template_1.CodeTemplateFactory.createForNode(scope, a);
        });
        if (call.expression.kind == ts.SyntaxKind.Identifier && this.funcName == "parseInt") {
            scope.root.headerFlags.int16_t = true;
            scope.root.headerFlags.parseInt = true;
        }
    }
    CCallExpression = __decorate([
        template_1.CodeTemplate("\n{#if standardCall}\n    {standardCall}\n{#else}\n    {funcName}({arguments {, }=> {this}})\n{/if}", ts.SyntaxKind.CallExpression)
    ], CCallExpression);
    return CCallExpression;
}());
exports.CCallExpression = CCallExpression;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../standard":13,"../template":40}],4:[function(require,module,exports){
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
var template_1 = require("../template");
var types_1 = require("../types");
var CElementAccess = /** @class */ (function () {
    function CElementAccess(scope, node) {
        var type = null;
        var elementAccess = null;
        var argumentExpression = null;
        if (node.kind == ts.SyntaxKind.Identifier) {
            type = scope.root.typeHelper.getCType(node);
            elementAccess = node.getText();
            var isLogicalContext = (node.parent.kind == ts.SyntaxKind.IfStatement
                || node.parent.kind == ts.SyntaxKind.WhileStatement
                || node.parent.kind == ts.SyntaxKind.DoStatement) && node.parent["expression"] == node;
            if (!isLogicalContext && node.parent.kind == ts.SyntaxKind.ForStatement && node.parent["condition"] == node)
                isLogicalContext = true;
            if (!isLogicalContext && node.parent.kind == ts.SyntaxKind.BinaryExpression) {
                var binExpr = node.parent;
                if (binExpr.operatorToken.kind == ts.SyntaxKind.AmpersandAmpersandToken
                    || binExpr.operatorToken.kind == ts.SyntaxKind.BarBarToken)
                    isLogicalContext = true;
            }
            if (!isLogicalContext && node.parent.kind == ts.SyntaxKind.PrefixUnaryExpression) {
                var binExpr = node.parent;
                if (binExpr.operator == ts.SyntaxKind.ExclamationToken)
                    isLogicalContext = true;
            }
            if (isLogicalContext && type instanceof types_1.ArrayType && !type.isDynamicArray) {
                argumentExpression = "0";
            }
        }
        else if (node.kind == ts.SyntaxKind.PropertyAccessExpression) {
            var propAccess = node;
            type = scope.root.typeHelper.getCType(propAccess.expression);
            if (propAccess.expression.kind == ts.SyntaxKind.Identifier)
                elementAccess = propAccess.expression.getText();
            else
                elementAccess = new CElementAccess_1(scope, propAccess.expression);
            argumentExpression = propAccess.name.getText();
        }
        else if (node.kind == ts.SyntaxKind.ElementAccessExpression) {
            var elemAccess = node;
            type = scope.root.typeHelper.getCType(elemAccess.expression);
            if (elemAccess.expression.kind == ts.SyntaxKind.Identifier)
                elementAccess = elemAccess.expression.getText();
            else
                elementAccess = new CElementAccess_1(scope, elemAccess.expression);
            if (type instanceof types_1.StructType && elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
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
        this.simpleAccessor = new CSimpleElementAccess(scope, type, elementAccess, argumentExpression);
    }
    CElementAccess_1 = CElementAccess;
    CElementAccess = CElementAccess_1 = __decorate([
        template_1.CodeTemplate("{simpleAccessor}", [ts.SyntaxKind.ElementAccessExpression, ts.SyntaxKind.PropertyAccessExpression, ts.SyntaxKind.Identifier])
    ], CElementAccess);
    return CElementAccess;
    var CElementAccess_1;
}());
exports.CElementAccess = CElementAccess;
var CSimpleElementAccess = /** @class */ (function () {
    function CSimpleElementAccess(scope, type, elementAccess, argumentExpression) {
        this.elementAccess = elementAccess;
        this.argumentExpression = argumentExpression;
        this.isDynamicArray = false;
        this.isStaticArray = false;
        this.isStruct = false;
        this.isDict = false;
        this.isString = false;
        this.isSimpleVar = typeof type === 'string' && type != types_1.UniversalVarType && type != types_1.PointerVarType;
        this.isDynamicArray = type instanceof types_1.ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof types_1.ArrayType && !type.isDynamicArray;
        this.arrayCapacity = type instanceof types_1.ArrayType && !type.isDynamicArray && type.capacity + "";
        this.isDict = type instanceof types_1.DictType;
        this.isStruct = type instanceof types_1.StructType;
        this.isString = type === types_1.StringVarType;
        if (this.isString && this.argumentExpression == "length")
            scope.root.headerFlags.str_len = true;
    }
    CSimpleElementAccess = __decorate([
        template_1.CodeTemplate("\n{#if isString && argumentExpression == 'length'}\n    str_len({elementAccess})\n{#elseif isSimpleVar || argumentExpression == null}\n    {elementAccess}\n{#elseif isDynamicArray && argumentExpression == 'length'}\n    {elementAccess}->size\n{#elseif isDynamicArray}\n    {elementAccess}->data[{argumentExpression}]\n{#elseif isStaticArray && argumentExpression == 'length'}\n    {arrayCapacity}\n{#elseif isStaticArray}\n    {elementAccess}[{argumentExpression}]\n{#elseif isStruct}\n    {elementAccess}->{argumentExpression}\n{#elseif isDict}\n    DICT_GET({elementAccess}, {argumentExpression})\n{#else}\n    /* Unsupported element access scenario: {elementAccess} {argumentExpression} */\n{/if}")
    ], CSimpleElementAccess);
    return CSimpleElementAccess;
}());
exports.CSimpleElementAccess = CSimpleElementAccess;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":40,"../types":41}],5:[function(require,module,exports){
(function (global){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var assignment_1 = require("./assignment");
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require("../template");
var types_1 = require("../types");
var variable_1 = require("./variable");
var regexfunc_1 = require("./regexfunc");
var CBinaryExpression = /** @class */ (function () {
    function CBinaryExpression(scope, node) {
        if (node.operatorToken.kind == ts.SyntaxKind.FirstAssignment) {
            this.expression = assignment_1.AssignmentHelper.create(scope, node.left, node.right, true);
            return;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.CommaToken) {
            var nodeAsStatement = ts.createNode(ts.SyntaxKind.ExpressionStatement);
            nodeAsStatement.expression = node.left;
            nodeAsStatement.parent = node.getSourceFile();
            scope.statements.push(template_1.CodeTemplateFactory.createForNode(scope, nodeAsStatement));
            this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.right);
            return;
        }
        var leftType = scope.root.typeHelper.getCType(node.left);
        var left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
        var rightType = scope.root.typeHelper.getCType(node.right);
        var right = template_1.CodeTemplateFactory.createForNode(scope, node.right);
        this.expression = new CSimpleBinaryExpression(scope, left, leftType, right, rightType, node.operatorToken.kind, node);
    }
    CBinaryExpression = __decorate([
        template_1.CodeTemplate("{expression}", ts.SyntaxKind.BinaryExpression)
    ], CBinaryExpression);
    return CBinaryExpression;
}());
var CSimpleBinaryExpression = /** @class */ (function () {
    function CSimpleBinaryExpression(scope, left, leftType, right, rightType, operatorKind, node) {
        this.left = left;
        this.right = right;
        this.replacedWithCall = false;
        this.replacedWithVar = false;
        this.replacedWithVarAssignment = false;
        this.gcVarName = null;
        this.strPlusStr = false;
        this.strPlusNumber = false;
        this.numberPlusStr = false;
        var operatorMap = {};
        var callReplaceMap = {};
        if (leftType == types_1.RegexVarType && operatorKind == ts.SyntaxKind.PlusToken) {
            leftType = types_1.StringVarType;
            this.left = new regexfunc_1.CRegexAsString(left);
        }
        if (rightType == types_1.RegexVarType && operatorKind == ts.SyntaxKind.PlusToken) {
            rightType = types_1.StringVarType;
            this.right = new regexfunc_1.CRegexAsString(right);
        }
        operatorMap[ts.SyntaxKind.AmpersandAmpersandToken] = '&&';
        operatorMap[ts.SyntaxKind.BarBarToken] = '||';
        if (leftType == types_1.NumberVarType && rightType == types_1.NumberVarType) {
            operatorMap[ts.SyntaxKind.GreaterThanToken] = '>';
            operatorMap[ts.SyntaxKind.GreaterThanEqualsToken] = '>=';
            operatorMap[ts.SyntaxKind.LessThanToken] = '<';
            operatorMap[ts.SyntaxKind.LessThanEqualsToken] = '<=';
            operatorMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.ExclamationEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = '==';
            operatorMap[ts.SyntaxKind.EqualsEqualsToken] = '==';
            operatorMap[ts.SyntaxKind.AsteriskToken] = '*';
            operatorMap[ts.SyntaxKind.SlashToken] = '/';
            operatorMap[ts.SyntaxKind.PercentToken] = '%';
            operatorMap[ts.SyntaxKind.PlusToken] = '+';
            operatorMap[ts.SyntaxKind.MinusToken] = '-';
            operatorMap[ts.SyntaxKind.FirstCompoundAssignment] = '+=';
            operatorMap[ts.SyntaxKind.AmpersandToken] = '&';
            operatorMap[ts.SyntaxKind.BarToken] = '|';
            operatorMap[ts.SyntaxKind.CaretToken] = '^';
            operatorMap[ts.SyntaxKind.GreaterThanGreaterThanToken] = '>>';
            operatorMap[ts.SyntaxKind.LessThanLessThanToken] = '<<';
        }
        else if (leftType == types_1.StringVarType && rightType == types_1.StringVarType) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['strcmp', ' == 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['strcmp', ' == 0'];
            if (callReplaceMap[operatorKind])
                scope.root.headerFlags.strings = true;
            if (operatorKind == ts.SyntaxKind.PlusToken || operatorKind == ts.SyntaxKind.FirstCompoundAssignment) {
                var tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                scope.func.variables.push(new variable_1.CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                this.replacedWithVar = true;
                this.replacedWithVarAssignment = operatorKind == ts.SyntaxKind.FirstCompoundAssignment;
                this.replacementVarName = tempVarName;
                this.strPlusStr = true;
                scope.root.headerFlags.strings = true;
                scope.root.headerFlags.malloc = true;
            }
        }
        else if (leftType == types_1.NumberVarType && rightType == types_1.StringVarType
            || leftType == types_1.StringVarType && rightType == types_1.NumberVarType) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['str_int16_t_cmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['str_int16_t_cmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['str_int16_t_cmp', ' == 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['str_int16_t_cmp', ' == 0'];
            if (callReplaceMap[operatorKind]) {
                scope.root.headerFlags.str_int16_t_cmp = true;
                // str_int16_t_cmp expects certain order of arguments (string, number)
                if (leftType == types_1.NumberVarType) {
                    var tmp = this.left;
                    this.left = this.right;
                    this.right = tmp;
                }
            }
            if (operatorKind == ts.SyntaxKind.PlusToken || operatorKind == ts.SyntaxKind.FirstCompoundAssignment) {
                var tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                scope.func.variables.push(new variable_1.CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                this.replacedWithVar = true;
                this.replacedWithVarAssignment = operatorKind == ts.SyntaxKind.FirstCompoundAssignment;
                this.replacementVarName = tempVarName;
                if (leftType == types_1.NumberVarType)
                    this.numberPlusStr = true;
                else
                    this.strPlusNumber = true;
                scope.root.headerFlags.strings = true;
                scope.root.headerFlags.malloc = true;
                scope.root.headerFlags.str_int16_t_cat = true;
            }
        }
        this.operator = operatorMap[operatorKind];
        if (callReplaceMap[operatorKind]) {
            this.replacedWithCall = true;
            _a = callReplaceMap[operatorKind], this.call = _a[0], this.callCondition = _a[1];
        }
        this.nodeText = node.getText();
        if (this.gcVarName) {
            scope.root.headerFlags.gc_iterator = true;
            scope.root.headerFlags.array = true;
        }
        var _a;
    }
    CSimpleBinaryExpression = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if replacedWithVar && strPlusStr}\n        {replacementVarName} = malloc(strlen({left}) + strlen({right}) + 1);\n        assert({replacementVarName} != NULL);\n        strcpy({replacementVarName}, {left});\n        strcat({replacementVarName}, {right});\n    {#elseif replacedWithVar && strPlusNumber}\n        {replacementVarName} = malloc(strlen({left}) + STR_INT16_T_BUFLEN + 1);\n        assert({replacementVarName} != NULL);\n        {replacementVarName}[0] = '\\0';\n        strcat({replacementVarName}, {left});\n        str_int16_t_cat({replacementVarName}, {right});\n    {#elseif replacedWithVar && numberPlusStr}\n        {replacementVarName} = malloc(strlen({right}) + STR_INT16_T_BUFLEN + 1);\n        assert({replacementVarName} != NULL);\n        {replacementVarName}[0] = '\\0';\n        str_int16_t_cat({replacementVarName}, {left});\n        strcat({replacementVarName}, {right});\n    {/if}\n    {#if replacedWithVar && gcVarName}\n        ARRAY_PUSH({gcVarName}, {replacementVarName});\n    {/if}\n\n{/statements}\n{#if operator}\n    {left} {operator} {right}\n{#elseif replacedWithCall}\n    {call}({left}, {right}){callCondition}\n{#elseif replacedWithVarAssignment}\n    ({left} = {replacementVarName})\n{#elseif replacedWithVar}\n    {replacementVarName}\n{#else}\n    /* unsupported expression {nodeText} */\n{/if}")
    ], CSimpleBinaryExpression);
    return CSimpleBinaryExpression;
}());
exports.CSimpleBinaryExpression = CSimpleBinaryExpression;
var CUnaryExpression = /** @class */ (function () {
    function CUnaryExpression(scope, node) {
        this.replacedWithCall = false;
        var operatorMap = {};
        var callReplaceMap = {};
        var type = scope.root.typeHelper.getCType(node.operand);
        operatorMap[ts.SyntaxKind.ExclamationToken] = '!';
        if (type == types_1.NumberVarType) {
            operatorMap[ts.SyntaxKind.PlusPlusToken] = '++';
            operatorMap[ts.SyntaxKind.MinusMinusToken] = '--';
            operatorMap[ts.SyntaxKind.MinusToken] = '-';
            operatorMap[ts.SyntaxKind.PlusToken] = '+';
            operatorMap[ts.SyntaxKind.TildeToken] = '~';
        }
        if (type == types_1.StringVarType) {
            callReplaceMap[ts.SyntaxKind.PlusToken] = ["atoi", ""];
            if (callReplaceMap[node.operator])
                scope.root.headerFlags.atoi = true;
        }
        this.operator = operatorMap[node.operator];
        if (callReplaceMap[node.operator]) {
            this.replacedWithCall = true;
            _a = callReplaceMap[node.operator], this.call = _a[0], this.callCondition = _a[1];
        }
        this.operand = template_1.CodeTemplateFactory.createForNode(scope, node.operand);
        this.isPostfix = node.kind == ts.SyntaxKind.PostfixUnaryExpression;
        this.nodeText = node.getText();
        var _a;
    }
    CUnaryExpression = __decorate([
        template_1.CodeTemplate("\n{#if isPostfix && operator}\n    {operand}{operator}\n{#elseif !isPostfix && operator}\n    {operator}{operand}\n{#elseif replacedWithCall}\n    {call}({operand}){callCondition}\n{#else}\n    /* unsupported expression {nodeText} */\n{/if}", [ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression])
    ], CUnaryExpression);
    return CUnaryExpression;
}());
var CTernaryExpression = /** @class */ (function () {
    function CTernaryExpression(scope, node) {
        this.condition = template_1.CodeTemplateFactory.createForNode(scope, node.condition);
        this.whenTrue = template_1.CodeTemplateFactory.createForNode(scope, node.whenTrue);
        this.whenFalse = template_1.CodeTemplateFactory.createForNode(scope, node.whenFalse);
    }
    CTernaryExpression = __decorate([
        template_1.CodeTemplate("{condition} ? {whenTrue} : {whenFalse}", ts.SyntaxKind.ConditionalExpression)
    ], CTernaryExpression);
    return CTernaryExpression;
}());
var CGroupingExpression = /** @class */ (function () {
    function CGroupingExpression(scope, node) {
        this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
    }
    CGroupingExpression = __decorate([
        template_1.CodeTemplate("({expression})", ts.SyntaxKind.ParenthesizedExpression)
    ], CGroupingExpression);
    return CGroupingExpression;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":40,"../types":41,"./assignment":2,"./regexfunc":8,"./variable":10}],6:[function(require,module,exports){
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
var template_1 = require("../template");
var variable_1 = require("./variable");
var anonymousNameCounter = 0;
var CFunctionPrototype = /** @class */ (function () {
    function CFunctionPrototype(scope, node) {
        this.parameters = [];
        this.returnType = scope.root.typeHelper.getTypeString(node);
        this.name = node.name.getText();
        this.parameters = node.parameters.map(function (p) { return new variable_1.CVariable(scope, p.name.getText(), p.name, { removeStorageSpecifier: true }); });
    }
    CFunctionPrototype = __decorate([
        template_1.CodeTemplate("{returnType} {name}({parameters {, }=> {this}});")
    ], CFunctionPrototype);
    return CFunctionPrototype;
}());
exports.CFunctionPrototype = CFunctionPrototype;
var CFunction = /** @class */ (function () {
    function CFunction(root, node) {
        var _this = this;
        this.root = root;
        this.func = this;
        this.parameters = [];
        this.variables = [];
        this.statements = [];
        this.parent = root;
        if (node.name) {
            this.name = node.name.getText();
        }
        else {
            this.name = "anonymousFunction" + anonymousNameCounter++;
        }
        this.funcDecl = new variable_1.CVariable(root, this.name, node, { removeStorageSpecifier: true });
        this.parameters = node.parameters.map(function (p) {
            return new variable_1.CVariable(_this, p.name.getText(), p.name, { removeStorageSpecifier: true });
        });
        this.variables = [];
        this.gcVarNames = root.memoryManager.getGCVariablesForScope(node);
        var _loop_1 = function (gcVarName) {
            if (root.variables.filter(function (v) { return v.name == gcVarName; }).length)
                return "continue";
            var gcType = gcVarName.indexOf("arrays") == -1 ? "ARRAY(void *)" : "ARRAY(ARRAY(void *))";
            root.variables.push(new variable_1.CVariable(root, gcVarName, gcType));
        };
        for (var _i = 0, _a = this.gcVarNames; _i < _a.length; _i++) {
            var gcVarName = _a[_i];
            _loop_1(gcVarName);
        }
        node.body.statements.forEach(function (s) { return _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, s)); });
        if (node.body.statements[node.body.statements.length - 1].kind != ts.SyntaxKind.ReturnStatement) {
            this.destructors = new variable_1.CVariableDestructors(this, node);
        }
    }
    CFunction = __decorate([
        template_1.CodeTemplate("\n{funcDecl}({parameters {, }=> {this}})\n{\n    {variables  {    }=> {this};\n}\n    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}\n\n    {statements {    }=> {this}}\n\n    {destructors}\n}", ts.SyntaxKind.FunctionDeclaration)
    ], CFunction);
    return CFunction;
}());
exports.CFunction = CFunction;
var CFunctionExpression = /** @class */ (function () {
    function CFunctionExpression(scope, expression) {
        var dynamicFunction = new CFunction(scope.root, expression);
        scope.root.functions.push(dynamicFunction);
        this.name = dynamicFunction.name;
    }
    CFunctionExpression = __decorate([
        template_1.CodeTemplate("{name}", ts.SyntaxKind.FunctionExpression)
    ], CFunctionExpression);
    return CFunctionExpression;
}());
exports.CFunctionExpression = CFunctionExpression;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":40,"./variable":10}],7:[function(require,module,exports){
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
var template_1 = require("../template");
var types_1 = require("../types");
var variable_1 = require("./variable");
var assignment_1 = require("./assignment");
var regexfunc_1 = require("./regexfunc");
var CArrayLiteralExpression = /** @class */ (function () {
    function CArrayLiteralExpression(scope, node) {
        var arrSize = node.elements.length;
        var type = scope.root.typeHelper.getCType(node);
        if (type instanceof types_1.ArrayType) {
            var varName = void 0;
            var canUseInitializerList = node.elements.every(function (e) { return e.kind == ts.SyntaxKind.NumericLiteral || e.kind == ts.SyntaxKind.StringLiteral; });
            if (!type.isDynamicArray && canUseInitializerList) {
                varName = scope.root.symbolsHelper.addTemp(node, "tmp_array");
                var s = "{ ";
                for (var i = 0; i < arrSize; i++) {
                    if (i != 0)
                        s += ", ";
                    var cExpr = template_1.CodeTemplateFactory.createForNode(scope, node.elements[i]);
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
                for (var i = 0; i < arrSize; i++) {
                    var assignment = new assignment_1.CAssignment(scope, varName, i + "", type, node.elements[i]);
                    scope.statements.push(assignment);
                }
            }
            this.expression = type.isDynamicArray ? "((void *)" + varName + ")" : varName;
        }
        else
            this.expression = "/* Unsupported use of array literal expression */";
    }
    CArrayLiteralExpression = __decorate([
        template_1.CodeTemplate("{expression}", ts.SyntaxKind.ArrayLiteralExpression)
    ], CArrayLiteralExpression);
    return CArrayLiteralExpression;
}());
var CObjectLiteralExpression = /** @class */ (function () {
    function CObjectLiteralExpression(scope, node) {
        var _this = this;
        this.expression = '';
        var type = scope.root.typeHelper.getCType(node);
        this.isStruct = type instanceof types_1.StructType;
        this.isDict = type instanceof types_1.DictType;
        if (this.isStruct || this.isDict) {
            var varName_1 = scope.root.memoryManager.getReservedTemporaryVarName(node);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.func.variables.push(new variable_1.CVariable(scope, varName_1, type, { initializer: "NULL" }));
            this.allocator = new variable_1.CVariableAllocation(scope, varName_1, type, node);
            this.initializers = node.properties
                .filter(function (p) { return p.kind == ts.SyntaxKind.PropertyAssignment; })
                .map(function (p) { return p; })
                .map(function (p) { return new assignment_1.CAssignment(scope, varName_1, _this.isDict ? '"' + p.name.getText() + '"' : p.name.getText(), type, p.initializer); });
            this.expression = varName_1;
        }
        else
            this.expression = "/* Unsupported use of object literal expression */";
    }
    CObjectLiteralExpression = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if isStruct || isDict}\n        {allocator}\n        {initializers}\n    {/if}\n{/statements}\n{expression}", ts.SyntaxKind.ObjectLiteralExpression)
    ], CObjectLiteralExpression);
    return CObjectLiteralExpression;
}());
var regexNames = {};
var CRegexLiteralExpression = /** @class */ (function () {
    function CRegexLiteralExpression(scope, node) {
        this.expression = '';
        var template = node.text;
        if (!regexNames[template]) {
            regexNames[template] = scope.root.symbolsHelper.addTemp(null, "regex");
            scope.root.functions.splice(scope.parent ? -2 : -1, 0, new regexfunc_1.CRegexSearchFunction(scope, template, regexNames[template]));
        }
        this.expression = regexNames[template];
        scope.root.headerFlags.regex = true;
    }
    CRegexLiteralExpression = __decorate([
        template_1.CodeTemplate("{expression}", ts.SyntaxKind.RegularExpressionLiteral)
    ], CRegexLiteralExpression);
    return CRegexLiteralExpression;
}());
var CString = /** @class */ (function () {
    function CString(scope, value) {
        var s = typeof value === 'string' ? '"' + value + '"' : value.getText();
        s = s.replace(/\\u([A-Fa-f0-9]{4})/g, function (match, g1) { return String.fromCharCode(parseInt(g1, 16)); });
        if (s.indexOf("'") == 0)
            this.value = '"' + s.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            this.value = s;
    }
    CString = __decorate([
        template_1.CodeTemplate("{value}", ts.SyntaxKind.StringLiteral)
    ], CString);
    return CString;
}());
exports.CString = CString;
var CNumber = /** @class */ (function () {
    function CNumber(scope, value) {
        this.value = value.getText();
    }
    CNumber = __decorate([
        template_1.CodeTemplate("{value}", ts.SyntaxKind.NumericLiteral)
    ], CNumber);
    return CNumber;
}());
exports.CNumber = CNumber;
var CBoolean = /** @class */ (function () {
    function CBoolean(scope, value) {
        this.value = value.kind == ts.SyntaxKind.TrueKeyword ? "TRUE" : "FALSE";
        scope.root.headerFlags.bool = true;
    }
    CBoolean = __decorate([
        template_1.CodeTemplate("{value}", [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword])
    ], CBoolean);
    return CBoolean;
}());
exports.CBoolean = CBoolean;
var CNull = /** @class */ (function () {
    function CNull(scope, value) {
    }
    CNull = __decorate([
        template_1.CodeTemplate("NULL", ts.SyntaxKind.NullKeyword)
    ], CNull);
    return CNull;
}());
exports.CNull = CNull;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":40,"../types":41,"./assignment":2,"./regexfunc":8,"./variable":10}],8:[function(require,module,exports){
"use strict";
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
var CRegexSearchFunction = /** @class */ (function () {
    function CRegexSearchFunction(scope, template, regexName, regexMachine) {
        if (regexMachine === void 0) { regexMachine = null; }
        this.regexName = regexName;
        this.stateBlocks = [];
        this.groupNumber = 0;
        this.templateString = new literals_1.CString(scope, template.replace(/\\/g, '\\\\').replace(/"/g, '\\"'));
        if (/\/[a-z]+$/.test(template))
            throw new Error("Flags not supported in regex literals yet (" + template + ").");
        regexMachine = regexMachine || regex_1.RegexBuilder.build(template.slice(1, -1));
        var max = function (arr, func) { return arr && arr.reduce(function (acc, t) { return Math.max(acc, func(t), 0); }, 0) || 0; };
        this.groupNumber = max(regexMachine.states, function (s) { return max(s.transitions, function (t) { return max(t.startGroup, function (g) { return g; }); }); });
        this.hasChars = regexMachine.states.filter(function (s) { return s && s.transitions.filter(function (c) { return typeof c.condition == "string" || c.condition.fromChar || c.condition.tokens.length > 0; }); }).length > 0;
        for (var s = 0; s < regexMachine.states.length; s++) {
            if (regexMachine.states[s] == null || regexMachine.states[s].transitions.length == 0)
                continue;
            this.stateBlocks.push(new CStateBlock(scope, s + "", regexMachine.states[s], this.groupNumber));
        }
        this.finals = regexMachine.states.length > 0 ? regexMachine.states.map(function (s, i) { return s.final ? i : -1; }).filter(function (f) { return f > -1; }).map(function (f) { return f + ""; }) : ["-1"];
        if (this.groupNumber > 0)
            scope.root.headerFlags.malloc = true;
        scope.root.headerFlags.strings = true;
        scope.root.headerFlags.bool = true;
    }
    CRegexSearchFunction = __decorate([
        template_1.CodeTemplate("\nstruct regex_match_struct_t {regexName}_search(const char *str, int16_t capture) {\n    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;\n    struct regex_match_struct_t result;\n{#if hasChars}\n        char ch;\n{/if}\n{#if groupNumber}\n        int16_t started[{groupNumber}];\n        if (capture) {\n            result.matches = malloc({groupNumber} * sizeof(*result.matches));\n            assert(result.matches != NULL);\n            regex_clear_matches(&result, {groupNumber});\n            memset(started, 0, sizeof started);\n        }\n{/if}\n    for (iterator = 0; iterator < len; iterator++) {\n{#if hasChars}\n            ch = str[iterator];\n{/if}\n\n{stateBlocks}\n\n        if (next == -1) {\n            if ({finals { || }=> state == {this}})\n                break;\n            iterator = index;\n            index++;\n            state = 0;\n            end = -1;\n{#if groupNumber}\n                if (capture) {\n                    regex_clear_matches(&result, {groupNumber});\n                    memset(started, 0, sizeof started);\n                }\n{/if}\n        } else {\n            state = next;\n            next = -1;\n        }\n\n        if (iterator == len-1 && index < len-1 && {finals { && }=> state != {this}}) {\n            if (end > -1)\n                break;\n            iterator = index;\n            index++;\n            state = 0;\n{#if groupNumber}\n                if (capture) {\n                    regex_clear_matches(&result, {groupNumber});\n                    memset(started, 0, sizeof started);\n                }\n{/if}\n        }\n    }\n    if (end == -1 && {finals { && }=> state != {this}})\n        index = -1;\n    result.index = index;\n    result.end = end == -1 ? iterator : end;\n    result.matches_count = {groupNumber};\n    return result;\n}\nstruct regex_struct_t {regexName} = { {templateString}, {regexName}_search };\n")
    ], CRegexSearchFunction);
    return CRegexSearchFunction;
}());
exports.CRegexSearchFunction = CRegexSearchFunction;
var CStateBlock = /** @class */ (function () {
    function CStateBlock(scope, stateNumber, state, groupNumber) {
        this.stateNumber = stateNumber;
        this.groupNumber = groupNumber;
        this.conditions = [];
        this.groupsToReset = [];
        this.final = state.final;
        var allGroups = [];
        state.transitions.forEach(function (t) { return allGroups = allGroups.concat(t.startGroup || []).concat(t.endGroup || []); });
        for (var i = 0; i < groupNumber; i++)
            if (allGroups.indexOf(i + 1) == -1)
                this.groupsToReset.push(i + "");
        for (var _i = 0, _a = state.transitions; _i < _a.length; _i++) {
            var tr = _a[_i];
            this.conditions.push(new CharCondition(tr, groupNumber));
        }
    }
    CStateBlock = __decorate([
        template_1.CodeTemplate("\n        if (state == {stateNumber}) {\n{#if final}\n                end = iterator;\n{/if}\n{conditions {\n}=> {this}}\n{#if groupNumber && groupsToReset.length}\n                if (capture && next == -1) {\n                    {groupsToReset {\n                    }=> started[{this}] = 0;}\n                }\n{/if}\n        }\n")
    ], CStateBlock);
    return CStateBlock;
}());
var CharCondition = /** @class */ (function () {
    function CharCondition(tr, groupN) {
        this.anyCharExcept = false;
        this.anyChar = false;
        this.charClass = false;
        this.fixedConditions = '';
        if (tr.fixedStart)
            this.fixedConditions = " && iterator == 0";
        else if (tr.fixedEnd)
            this.fixedConditions = " && iterator == len - 1";
        if (typeof tr.condition === "string")
            this.ch = tr.condition.replace('\\', '\\\\').replace("'", "\\'");
        else if (tr.condition.fromChar) {
            this.charClass = true;
            this.chFrom = tr.condition.fromChar;
            this.ch = tr.condition.toChar;
        }
        else if (tr.condition.tokens.length) {
            this.anyCharExcept = true;
            this.except = tr.condition.tokens.map(function (ch) { return ch.replace('\\', '\\\\').replace("'", "\\'"); });
        }
        else
            this.anyChar = true;
        var groupCaptureCode = '';
        for (var _i = 0, _a = tr.startGroup || []; _i < _a.length; _i++) {
            var g = _a[_i];
            groupCaptureCode += " if (capture && (!started[" + (g - 1) + "] || iterator > result.matches[" + (g - 1) + "].end)) { started[" + (g - 1) + "] = 1; result.matches[" + (g - 1) + "].index = iterator; }";
        }
        for (var _b = 0, _c = tr.endGroup || []; _b < _c.length; _b++) {
            var g = _c[_b];
            groupCaptureCode += " if (capture && started[" + (g - 1) + "]) result.matches[" + (g - 1) + "].end = iterator + 1;";
        }
        this.nextCode = "next = " + tr.next + ";";
        if (groupCaptureCode)
            this.nextCode = "{ " + this.nextCode + groupCaptureCode + " }";
    }
    CharCondition = __decorate([
        template_1.CodeTemplate("\n{#if anyCharExcept}\n                if (next == -1 && {except { && }=> ch != '{this}'}{fixedConditions}) {nextCode}\n{#elseif anyChar}\n                if (next == -1{fixedConditions}) {nextCode}\n{#elseif charClass}\n                if (ch >= '{chFrom}' && ch <= '{ch}'{fixedConditions}) {nextCode}\n{#else}\n                if (ch == '{ch}'{fixedConditions}) {nextCode}\n{/if}")
    ], CharCondition);
    return CharCondition;
}());
var CRegexAsString = /** @class */ (function () {
    function CRegexAsString(expression) {
        this.expression = expression;
    }
    CRegexAsString = __decorate([
        template_1.CodeTemplate("{expression}.str")
    ], CRegexAsString);
    return CRegexAsString;
}());
exports.CRegexAsString = CRegexAsString;

},{"../regex":12,"../template":40,"./literals":7}],9:[function(require,module,exports){
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
var template_1 = require("../template");
var types_1 = require("../types");
var variable_1 = require("./variable");
var elementaccess_1 = require("./elementaccess");
var assignment_1 = require("./assignment");
var CBreakStatement = /** @class */ (function () {
    function CBreakStatement(scope, node) {
    }
    CBreakStatement = __decorate([
        template_1.CodeTemplate("break;\n", ts.SyntaxKind.BreakStatement)
    ], CBreakStatement);
    return CBreakStatement;
}());
exports.CBreakStatement = CBreakStatement;
var CContinueStatement = /** @class */ (function () {
    function CContinueStatement(scope, node) {
    }
    CContinueStatement = __decorate([
        template_1.CodeTemplate("continue;\n", ts.SyntaxKind.ContinueStatement)
    ], CContinueStatement);
    return CContinueStatement;
}());
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
var CReturnStatement = /** @class */ (function () {
    function CReturnStatement(scope, node) {
        this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        this.destructors = new variable_1.CVariableDestructors(scope, node);
    }
    CReturnStatement = __decorate([
        template_1.CodeTemplate("\n{destructors}\nreturn {expression};\n", ts.SyntaxKind.ReturnStatement)
    ], CReturnStatement);
    return CReturnStatement;
}());
exports.CReturnStatement = CReturnStatement;
var CIfStatement = /** @class */ (function () {
    function CIfStatement(scope, node) {
        this.condition = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        this.thenBlock = new CBlock(scope, node.thenStatement);
        this.hasElseBlock = !!node.elseStatement;
        this.elseBlock = this.hasElseBlock && new CBlock(scope, node.elseStatement);
    }
    CIfStatement = __decorate([
        template_1.CodeTemplate("\nif ({condition})\n{thenBlock}\n{#if hasElseBlock}\n    else\n    {elseBlock}\n{/if}\n", ts.SyntaxKind.IfStatement)
    ], CIfStatement);
    return CIfStatement;
}());
exports.CIfStatement = CIfStatement;
var CWhileStatement = /** @class */ (function () {
    function CWhileStatement(scope, node) {
        this.block = new CBlock(scope, node.statement);
        this.condition = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
    }
    CWhileStatement = __decorate([
        template_1.CodeTemplate("\nwhile ({condition})\n{block}", ts.SyntaxKind.WhileStatement)
    ], CWhileStatement);
    return CWhileStatement;
}());
exports.CWhileStatement = CWhileStatement;
var CDoWhileStatement = /** @class */ (function () {
    function CDoWhileStatement(scope, node) {
        this.block = new CBlock(scope, node.statement);
        this.condition = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
    }
    CDoWhileStatement = __decorate([
        template_1.CodeTemplate("\ndo\n{block}\nwhile ({condition});", ts.SyntaxKind.DoStatement)
    ], CDoWhileStatement);
    return CDoWhileStatement;
}());
exports.CDoWhileStatement = CDoWhileStatement;
var CForStatement = /** @class */ (function () {
    function CForStatement(scope, node) {
        this.varDecl = null;
        this.block = new CBlock(scope, node.statement);
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            var declList = node.initializer;
            this.varDecl = new variable_1.CVariableDeclaration(scope, declList.declarations[0]);
            this.init = "";
        }
        else
            this.init = template_1.CodeTemplateFactory.createForNode(scope, node.initializer);
        this.condition = template_1.CodeTemplateFactory.createForNode(scope, node.condition);
        this.increment = template_1.CodeTemplateFactory.createForNode(scope, node.incrementor);
    }
    CForStatement = __decorate([
        template_1.CodeTemplate("\n{#if varDecl}\n    {varDecl}\n{/if}\nfor ({init};{condition};{increment})\n{block}", ts.SyntaxKind.ForStatement)
    ], CForStatement);
    return CForStatement;
}());
exports.CForStatement = CForStatement;
var CForOfStatement = /** @class */ (function () {
    function CForOfStatement(scope, node) {
        this.variables = [];
        this.statements = [];
        this.cast = "";
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
        this.arrayAccess = new elementaccess_1.CElementAccess(scope, node.expression);
        var arrayVarType = scope.root.typeHelper.getCType(node.expression);
        if (arrayVarType && arrayVarType instanceof types_1.ArrayType) {
            this.isDynamicArray = arrayVarType.isDynamicArray;
            this.arrayCapacity = arrayVarType.capacity + "";
            var elemType = arrayVarType.elementType;
            if (elemType instanceof types_1.ArrayType && elemType.isDynamicArray)
                this.cast = "(void *)";
        }
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            var declInit = node.initializer.declarations[0];
            scope.variables.push(new variable_1.CVariable(scope, declInit.name.getText(), declInit.name));
            this.init = declInit.name.getText();
        }
        else {
            this.init = new elementaccess_1.CElementAccess(scope, node.initializer);
        }
        this.statements.push(template_1.CodeTemplateFactory.createForNode(this, node.statement));
        scope.variables = scope.variables.concat(this.variables);
        this.variables = [];
    }
    CForOfStatement = __decorate([
        template_1.CodeTemplate("\n{#if isDynamicArray}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {arrayAccess}->size; {iteratorVarName}++)\n    {\n        {variables {    }=> {this};\n}\n        {init} = {cast}{arrayAccess}->data[{iteratorVarName}];\n        {statements {    }=> {this}}\n    }\n{#else}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {arrayCapacity}; {iteratorVarName}++)\n    {\n        {variables {    }=> {this};\n}\n        {init} = {cast}{arrayAccess}[{iteratorVarName}];\n        {statements {    }=> {this}}\n    }\n{/if}\n", ts.SyntaxKind.ForOfStatement)
    ], CForOfStatement);
    return CForOfStatement;
}());
exports.CForOfStatement = CForOfStatement;
var CForInStatement = /** @class */ (function () {
    function CForInStatement(scope, node) {
        this.variables = [];
        this.statements = [];
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
        this.varAccess = new elementaccess_1.CElementAccess(scope, node.expression);
        var dictVarType = scope.root.typeHelper.getCType(node.expression);
        // TODO: do something with dictVarType
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            var declInit = node.initializer.declarations[0];
            scope.variables.push(new variable_1.CVariable(scope, declInit.name.getText(), declInit.name));
            this.init = declInit.name.getText();
        }
        else
            this.init = new elementaccess_1.CElementAccess(scope, node.initializer);
        if (node.statement.kind == ts.SyntaxKind.Block) {
            var block = node.statement;
            for (var _i = 0, _a = block.statements; _i < _a.length; _i++) {
                var s = _a[_i];
                this.statements.push(template_1.CodeTemplateFactory.createForNode(this, s));
            }
        }
        else
            this.statements.push(template_1.CodeTemplateFactory.createForNode(this, node.statement));
        scope.variables = scope.variables.concat(this.variables);
        this.variables = [];
    }
    CForInStatement = __decorate([
        template_1.CodeTemplate("\nfor ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->index->size; {iteratorVarName}++)\n{\n    {variables {    }=> {this};\n}\n    {init} = {varAccess}->index->data[{iteratorVarName}];\n    {statements {    }=> {this}}\n}\n", ts.SyntaxKind.ForInStatement)
    ], CForInStatement);
    return CForInStatement;
}());
exports.CForInStatement = CForInStatement;
var CProperty = /** @class */ (function () {
    function CProperty(varAccess, index, name, init) {
        this.varAccess = varAccess;
        this.index = index;
        this.name = name;
        this.init = init;
    }
    return CProperty;
}());
var CExpressionStatement = /** @class */ (function () {
    function CExpressionStatement(scope, node) {
        this.SemicolonCR = ';\n';
        if (node.expression.kind == ts.SyntaxKind.BinaryExpression) {
            var binExpr = node.expression;
            if (binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                this.expression = assignment_1.AssignmentHelper.create(scope, binExpr.left, binExpr.right);
                ;
                this.SemicolonCR = '';
            }
        }
        if (!this.expression)
            this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
    }
    CExpressionStatement = __decorate([
        template_1.CodeTemplate("{expression}{SemicolonCR}", ts.SyntaxKind.ExpressionStatement)
    ], CExpressionStatement);
    return CExpressionStatement;
}());
exports.CExpressionStatement = CExpressionStatement;
var CBlock = /** @class */ (function () {
    function CBlock(scope, node) {
        var _this = this;
        this.variables = [];
        this.statements = [];
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        if (node.kind == ts.SyntaxKind.Block) {
            var block = node;
            block.statements.forEach(function (s) { return _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, s)); });
        }
        else
            this.statements.push(template_1.CodeTemplateFactory.createForNode(this, node));
    }
    CBlock = __decorate([
        template_1.CodeTemplate("\n{#if statements.length > 1 || variables.length > 0}\n    {\n        {variables {    }=> {this};\n}\n        {statements {    }=> {this}}\n    }\n{/if}\n{#if statements.length == 1 && variables.length == 0}\n        {statements}\n{/if}\n{#if statements.length == 0 && variables.length == 0}\n        /* no statements */;\n{/if}", ts.SyntaxKind.Block)
    ], CBlock);
    return CBlock;
}());
exports.CBlock = CBlock;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":40,"../types":41,"./assignment":2,"./elementaccess":4,"./variable":10}],10:[function(require,module,exports){
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
var template_1 = require("../template");
var types_1 = require("../types");
var assignment_1 = require("./assignment");
var CVariableStatement = /** @class */ (function () {
    function CVariableStatement(scope, node) {
        this.declarations = node.declarationList.declarations.map(function (d) { return template_1.CodeTemplateFactory.createForNode(scope, d); });
    }
    CVariableStatement = __decorate([
        template_1.CodeTemplate("{declarations}", ts.SyntaxKind.VariableStatement)
    ], CVariableStatement);
    return CVariableStatement;
}());
exports.CVariableStatement = CVariableStatement;
var CVariableDeclarationList = /** @class */ (function () {
    function CVariableDeclarationList(scope, node) {
        this.declarations = node.declarations.map(function (d) { return template_1.CodeTemplateFactory.createForNode(scope, d); });
    }
    CVariableDeclarationList = __decorate([
        template_1.CodeTemplate("{declarations}", ts.SyntaxKind.VariableDeclarationList)
    ], CVariableDeclarationList);
    return CVariableDeclarationList;
}());
exports.CVariableDeclarationList = CVariableDeclarationList;
var CVariableDeclaration = /** @class */ (function () {
    function CVariableDeclaration(scope, varDecl) {
        this.allocator = '';
        this.initializer = '';
        var name = scope.root.typeChecker.getSymbolAtLocation(varDecl.name).name;
        var type = scope.root.typeHelper.getCType(varDecl.name);
        if (type instanceof types_1.ArrayType && !type.isDynamicArray && ts.isArrayLiteralExpression(varDecl.initializer)) {
            var canUseInitializerList = varDecl.initializer.elements.every(function (e) { return e.kind == ts.SyntaxKind.NumericLiteral || e.kind == ts.SyntaxKind.StringLiteral; });
            if (canUseInitializerList) {
                var s = "{ ";
                for (var i = 0; i < type.capacity; i++) {
                    if (i != 0)
                        s += ", ";
                    var cExpr = template_1.CodeTemplateFactory.createForNode(scope, varDecl.initializer.elements[i]);
                    s += typeof cExpr === 'string' ? cExpr : cExpr.resolve();
                }
                s += " }";
                scope.variables.push(new CVariable(scope, name, type, { initializer: s }));
                return;
            }
        }
        scope.variables.push(new CVariable(scope, name, type));
        if (varDecl.initializer)
            this.initializer = assignment_1.AssignmentHelper.create(scope, varDecl.name, varDecl.initializer);
    }
    CVariableDeclaration = __decorate([
        template_1.CodeTemplate("{initializer}", ts.SyntaxKind.VariableDeclaration)
    ], CVariableDeclaration);
    return CVariableDeclaration;
}());
exports.CVariableDeclaration = CVariableDeclaration;
var CVariableAllocation = /** @class */ (function () {
    function CVariableAllocation(scope, varName, varType, refNode) {
        this.varName = varName;
        this.needAllocateArray = varType instanceof types_1.ArrayType && varType.isDynamicArray;
        this.needAllocateStruct = varType instanceof types_1.StructType;
        this.needAllocateDict = varType instanceof types_1.DictType;
        this.initialCapacity = 4;
        this.gcVarName = scope.root.memoryManager.getGCVariableForNode(refNode);
        if (varType instanceof types_1.ArrayType) {
            this.initialCapacity = Math.max(varType.capacity * 2, 4);
            this.size = varType.capacity;
        }
        if (this.needAllocateStruct || this.needAllocateArray || this.needAllocateDict)
            scope.root.headerFlags.malloc = true;
        if (this.gcVarName || this.needAllocateArray)
            scope.root.headerFlags.array = true;
        if (this.needAllocateDict)
            scope.root.headerFlags.dict = true;
        if (this.gcVarName)
            scope.root.headerFlags.gc_iterator = true;
    }
    CVariableAllocation = __decorate([
        template_1.CodeTemplate("\n{#if needAllocateArray}\n    ARRAY_CREATE({varName}, {initialCapacity}, {size});\n{#elseif needAllocateDict}\n    DICT_CREATE({varName}, {initialCapacity});\n{#elseif needAllocateStruct}\n    {varName} = malloc(sizeof(*{varName}));\n    assert({varName} != NULL);\n{/if}\n{#if gcVarName && (needAllocateStruct || needAllocateArray || needAllocateDict)}\n    ARRAY_PUSH({gcVarName}, (void *){varName});\n{/if}\n")
    ], CVariableAllocation);
    return CVariableAllocation;
}());
exports.CVariableAllocation = CVariableAllocation;
var CVariableDestructors = /** @class */ (function () {
    function CVariableDestructors(scope, node) {
        var _this = this;
        this.gcVarName = null;
        this.gcArraysVarName = null;
        this.gcArraysCVarName = null;
        this.gcDictsVarName = null;
        this.arrayDestructors = [];
        var gcVarNames = scope.root.memoryManager.getGCVariablesForScope(node);
        for (var _i = 0, gcVarNames_1 = gcVarNames; _i < gcVarNames_1.length; _i++) {
            var gc = gcVarNames_1[_i];
            if (gc.indexOf("_arrays_c") > -1)
                this.gcArraysCVarName = gc;
            else if (gc.indexOf("_dicts") > -1)
                this.gcDictsVarName = gc;
            else if (gc.indexOf("_arrays") > -1)
                this.gcArraysVarName = gc;
            else
                this.gcVarName = gc;
        }
        this.destructors = [];
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
    }
    CVariableDestructors = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {arrayDestructors => for (gc_i = 0; gc_i < ({this} ? {this}->size : 0); gc_i++) free((void*){this}->data[gc_i]);\n}\n    {destructors => free({this});\n}\n    {#if gcArraysCVarName}\n        for (gc_i = 0; gc_i < {gcArraysCVarName}->size; gc_i++) {\n            for (gc_j = 0; gc_j < ({gcArraysCVarName}->data[gc_i] ? {gcArraysCVarName}->data[gc_i]->size : 0); gc_j++)\n                free((void*){gcArraysCVarName}->data[gc_i]->data[gc_j]);\n\n            free({gcArraysCVarName}->data[gc_i] ? {gcArraysCVarName}->data[gc_i]->data : NULL);\n            free({gcArraysCVarName}->data[gc_i]);\n        }\n        free({gcArraysCVarName}->data);\n        free({gcArraysCVarName});\n    {/if}\n    {#if gcArraysVarName}\n        for (gc_i = 0; gc_i < {gcArraysVarName}->size; gc_i++) {\n            free({gcArraysVarName}->data[gc_i]->data);\n            free({gcArraysVarName}->data[gc_i]);\n        }\n        free({gcArraysVarName}->data);\n        free({gcArraysVarName});\n    {/if}\n    {#if gcDictsVarName}\n        for (gc_i = 0; gc_i < {gcDictsVarName}->size; gc_i++) {\n            free({gcDictsVarName}->data[gc_i]->index->data);\n            free({gcDictsVarName}->data[gc_i]->index);\n            free({gcDictsVarName}->data[gc_i]->values->data);\n            free({gcDictsVarName}->data[gc_i]->values);\n            free({gcDictsVarName}->data[gc_i]);\n        }\n        free({gcDictsVarName}->data);\n        free({gcDictsVarName});\n    {/if}\n    {#if gcVarName}\n        for (gc_i = 0; gc_i < {gcVarName}->size; gc_i++)\n            free({gcVarName}->data[gc_i]);\n        free({gcVarName}->data);\n        free({gcVarName});\n    {/if}\n{/statements}")
    ], CVariableDestructors);
    return CVariableDestructors;
}());
exports.CVariableDestructors = CVariableDestructors;
var CVariable = /** @class */ (function () {
    function CVariable(scope, name, typeSource, options) {
        this.name = name;
        var type = types_1.isNode(typeSource) ? scope.root.typeHelper.getCType(typeSource) : typeSource;
        if (type instanceof types_1.StructType)
            scope.root.symbolsHelper.ensureStruct(type, name);
        else if (type instanceof types_1.ArrayType && type.isDynamicArray)
            scope.root.symbolsHelper.ensureArrayStruct(type.elementType);
        if (this.typeHasNumber(type))
            scope.root.headerFlags.int16_t = true;
        else if (type == types_1.BooleanVarType)
            scope.root.headerFlags.uint8_t = true;
        // root scope, make variables file-scoped by default
        if (scope.parent == null)
            this.static = true;
        if (options && options.removeStorageSpecifier)
            this.static = false;
        if (options && options.initializer)
            this.initializer = options.initializer;
        this.type = type;
        this.typeHelper = scope.root.typeHelper;
    }
    CVariable.prototype.typeHasNumber = function (type) {
        var _this = this;
        return type == types_1.NumberVarType
            || type instanceof types_1.ArrayType && type.elementType == types_1.NumberVarType
            || type instanceof types_1.ArrayType && type.isDynamicArray
            || type instanceof types_1.StructType && Object.keys(type.properties).some(function (k) { return _this.typeHasNumber(type.properties[k]); })
            || type instanceof types_1.DictType;
    };
    CVariable.prototype.resolve = function () {
        var varString = this.typeHelper.getTypeString(this.type);
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
}());
exports.CVariable = CVariable;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":40,"../types":41,"./assignment":2}],11:[function(require,module,exports){
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
var types_1 = require("./types");
var symbols_1 = require("./symbols");
var memory_1 = require("./memory");
var template_1 = require("./template");
var function_1 = require("./nodes/function");
var variable_1 = require("./nodes/variable");
// these imports are here only because it is necessary to run decorators
require("./nodes/statements");
require("./nodes/expressions");
require("./nodes/call");
require("./nodes/literals");
require("./standard/global/parseInt");
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
require("./standard/console/log");
var HeaderFlags = /** @class */ (function () {
    function HeaderFlags() {
        this.strings = false;
        this.printf = false;
        this.malloc = false;
        this.bool = false;
        this.uint8_t = false;
        this.int16_t = false;
        this.js_var = false;
        this.array = false;
        this.array_pop = false;
        this.array_insert = false;
        this.array_remove = false;
        this.array_int16_t_cmp = false;
        this.array_str_cmp = false;
        this.gc_iterator = false;
        this.gc_iterator2 = false;
        this.dict = false;
        this.str_int16_t_cmp = false;
        this.str_int16_t_cat = false;
        this.str_pos = false;
        this.str_rpos = false;
        this.str_len = false;
        this.str_char_code_at = false;
        this.str_substring = false;
        this.str_slice = false;
        this.atoi = false;
        this.parseInt = false;
        this.regex = false;
        this.regex_match = false;
    }
    return HeaderFlags;
}());
var CProgram = /** @class */ (function () {
    function CProgram(tsProgram) {
        var _this = this;
        this.parent = null;
        this.root = this;
        this.func = this;
        this.variables = [];
        this.statements = [];
        this.functions = [];
        this.functionPrototypes = [];
        this.headerFlags = new HeaderFlags();
        this.typeChecker = tsProgram.getTypeChecker();
        this.typeHelper = new types_1.TypeHelper(this.typeChecker);
        this.symbolsHelper = new symbols_1.SymbolsHelper(this.typeChecker, this.typeHelper);
        this.memoryManager = new memory_1.MemoryManager(this.typeChecker, this.typeHelper, this.symbolsHelper);
        var nodes;
        for (var _i = 0, _a = tsProgram.getSourceFiles(); _i < _a.length; _i++) {
            var source = _a[_i];
            nodes = source.getChildren();
            var i = 0;
            while (i < nodes.length)
                nodes.push.apply(nodes, nodes[i++].getChildren());
        }
        this.typeHelper.inferTypes(nodes);
        this.memoryManager.scheduleNodeDisposals(nodes);
        this.gcVarNames = this.memoryManager.getGCVariablesForScope(null);
        for (var _b = 0, _c = this.gcVarNames; _b < _c.length; _b++) {
            var gcVarName = _c[_b];
            var gcType = "ARRAY(void *)";
            if (gcVarName.indexOf("_arrays") > -1)
                gcType = "ARRAY(ARRAY(void *))";
            if (gcVarName.indexOf("_arrays_c") > -1)
                gcType = "ARRAY(ARRAY(ARRAY(void *)))";
            this.variables.push(new variable_1.CVariable(this, gcVarName, gcType));
            this.headerFlags.array = true;
        }
        for (var _d = 0, _e = tsProgram.getSourceFiles(); _d < _e.length; _d++) {
            var source = _e[_d];
            for (var _f = 0, _g = source.statements; _f < _g.length; _f++) {
                var s = _g[_f];
                if (s.kind == ts.SyntaxKind.FunctionDeclaration)
                    this.functions.push(new function_1.CFunction(this, s));
                else
                    this.statements.push(template_1.CodeTemplateFactory.createForNode(this, s));
            }
        }
        var structs = this.symbolsHelper.getStructsAndFunctionPrototypes()[0];
        this.userStructs = structs.map(function (s) { return ({
            name: s.name,
            properties: s.properties.map(function (p) { return new variable_1.CVariable(_this, p.name, p.type, { removeStorageSpecifier: true }); })
        }); });
        this.functionPrototypes = []; //functionPrototypes.map(fp => new CFunctionPrototype(this, fp));
        this.destructors = new variable_1.CVariableDestructors(this, null);
    }
    CProgram = __decorate([
        template_1.CodeTemplate("\n{#if headerFlags.strings || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat\n    || headerFlags.str_pos || headerFlags.str_rpos || headerFlags.array_str_cmp\n    || headerFlags.str_substring\n    || headerFlags.array_insert || headerFlags.array_remove || headerFlags.dict}\n    #include <string.h>\n{/if}\n{#if headerFlags.malloc || headerFlags.atoi || headerFlags.array || headerFlags.str_substring \n    || headerFlags.str_slice}\n    #include <stdlib.h>\n{/if}\n{#if headerFlags.malloc || headerFlags.array || headerFlags.str_substring || headerFlags.str_slice}\n    #include <assert.h>\n{/if}\n{#if headerFlags.printf || headerFlags.parseInt}\n    #include <stdio.h>\n{/if}\n{#if headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat}\n    #include <limits.h>\n{/if}\n\n{#if headerFlags.bool}\n    #define TRUE 1\n    #define FALSE 0\n{/if}\n{#if headerFlags.bool || headerFlags.js_var}\n    typedef unsigned char uint8_t;\n{/if}\n{#if headerFlags.int16_t || headerFlags.js_var || headerFlags.array ||\n     headerFlags.str_int16_t_cmp || headerFlags.str_pos || headerFlags.str_len ||\n     headerFlags.str_char_code_at || headerFlags.str_substring || headerFlags.str_slice ||\n     headerFlags.regex }\n    typedef short int16_t;\n{/if}\n{#if headerFlags.regex}\n    struct regex_indices_struct_t {\n        int16_t index;\n        int16_t end;\n    };\n    struct regex_match_struct_t {\n        int16_t index;\n        int16_t end;\n        struct regex_indices_struct_t *matches;\n        int16_t matches_count;\n    };\n    typedef struct regex_match_struct_t regex_func_t(const char*, int16_t);\n    struct regex_struct_t {\n        const char * str;\n        regex_func_t * func;\n    };\n{/if}\n\n{#if headerFlags.js_var}\n    enum js_var_type {JS_VAR_BOOL, JS_VAR_INT, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_STRUCT, JS_VAR_DICT};\n\tstruct js_var {\n\t    enum js_var_type type;\n\t    uint8_t bool;\n\t    int16_t number;\n\t    const char *string;\n\t    void *obj;\n\t};\n{/if}\n\n{#if headerFlags.gc_iterator || headerFlags.dict}\n    #define ARRAY(T) struct {\\\n        int16_t size;\\\n        int16_t capacity;\\\n        T *data;\\\n    } *\n{/if}\n\n{#if headerFlags.array || headerFlags.dict}\n    #define ARRAY_CREATE(array, init_capacity, init_size) {\\\n        array = malloc(sizeof(*array)); \\\n        array->data = malloc((init_capacity) * sizeof(*array->data)); \\\n        assert(array->data != NULL); \\\n        array->capacity = init_capacity; \\\n        array->size = init_size; \\\n    }\n    #define ARRAY_PUSH(array, item) {\\\n        if (array->size == array->capacity) {  \\\n            array->capacity *= 2;  \\\n            array->data = realloc(array->data, array->capacity * sizeof(*array->data)); \\\n            assert(array->data != NULL); \\\n        }  \\\n        array->data[array->size++] = item; \\\n    }\n{/if}\n{#if headerFlags.array_pop}\n\t#define ARRAY_POP(a) (a->size != 0 ? a->data[--a->size] : 0)\n{/if}\n{#if headerFlags.array_insert || headerFlags.dict}\n    #define ARRAY_INSERT(array, pos, item) {\\\n        ARRAY_PUSH(array, item); \\\n        if (pos < array->size - 1) {\\\n            memmove(&(array->data[(pos) + 1]), &(array->data[pos]), (array->size - (pos) - 1) * sizeof(*array->data)); \\\n            array->data[pos] = item; \\\n        } \\\n    }\n{/if}\n{#if headerFlags.array_remove}\n    #define ARRAY_REMOVE(array, pos, num) {\\\n        memmove(&(array->data[pos]), &(array->data[(pos) + num]), (array->size - (pos) - num) * sizeof(*array->data)); \\\n        array->size -= num; \\\n    }\n{/if}\n\n{#if headerFlags.dict}\n    #define DICT(T) struct { \\\n        ARRAY(const char *) index; \\\n        ARRAY(T) values; \\\n    } *\n    #define DICT_CREATE(dict, init_capacity) { \\\n        dict = malloc(sizeof(*dict)); \\\n        ARRAY_CREATE(dict->index, init_capacity, 0); \\\n        ARRAY_CREATE(dict->values, init_capacity, 0); \\\n    }\n\n    int16_t dict_find_pos(const char ** keys, int16_t keys_size, const char * key) {\n        int16_t low = 0;\n        int16_t high = keys_size - 1;\n\n        if (keys_size == 0 || key == NULL)\n            return -1;\n\n        while (low <= high)\n        {\n            int mid = (low + high) / 2;\n            int res = strcmp(keys[mid], key);\n\n            if (res == 0)\n                return mid;\n            else if (res < 0)\n                low = mid + 1;\n            else\n                high = mid - 1;\n        }\n\n        return -1 - low;\n    }\n\n    int16_t tmp_dict_pos;\n    #define DICT_GET(dict, prop) ((tmp_dict_pos = dict_find_pos(dict->index->data, dict->index->size, prop)) < 0 ? 0 : dict->values->data[tmp_dict_pos])\n    #define DICT_SET(dict, prop, value) { \\\n        tmp_dict_pos = dict_find_pos(dict->index->data, dict->index->size, prop); \\\n        if (tmp_dict_pos < 0) { \\\n            tmp_dict_pos = -tmp_dict_pos - 1; \\\n            ARRAY_INSERT(dict->index, tmp_dict_pos, prop); \\\n            ARRAY_INSERT(dict->values, tmp_dict_pos, value); \\\n        } else \\\n            dict->values->data[tmp_dict_pos] = value; \\\n    }\n\n{/if}\n\n{#if headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat}\n    #define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)\n{/if}\n{#if headerFlags.str_int16_t_cmp}\n    int str_int16_t_cmp(const char * str, int16_t num) {\n        char numstr[STR_INT16_T_BUFLEN];\n        sprintf(numstr, \"%d\", num);\n        return strcmp(str, numstr);\n    }\n{/if}\n{#if headerFlags.str_pos}\n    int16_t str_pos(const char * str, const char *search) {\n        int16_t i;\n        const char * found = strstr(str, search);\n        int16_t pos = 0;\n        if (found == 0)\n            return -1;\n        while (*str && str < found) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        return pos;\n    }\n{/if}\n{#if headerFlags.str_rpos}\n    int16_t str_rpos(const char * str, const char *search) {\n        int16_t i;\n        const char * found = strstr(str, search);\n        int16_t pos = 0;\n        const char * end = str + (strlen(str) - strlen(search));\n        if (found == 0)\n            return -1;\n        found = 0;\n        while (end > str && found == 0)\n            found = strstr(end--, search);\n        while (*str && str < found) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        return pos;\n    }\n{/if}\n{#if headerFlags.str_len || headerFlags.str_substring || headerFlags.str_slice}\n    int16_t str_len(const char * str) {\n        int16_t len = 0;\n        int16_t i = 0;\n        while (*str) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            len += i == 4 ? 2 : 1;\n        }\n        return len;\n    }\n{/if}\n{#if headerFlags.str_char_code_at}\n    int16_t str_char_code_at(const char * str, int16_t pos) {\n        int16_t i, res = 0;\n        while (*str) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            if (pos == 0) {\n                res += (unsigned char)*str++;\n                if (i > 1) {\n                    res <<= 6; res -= 0x3080;\n                    res += (unsigned char)*str++;\n                }\n                return res;\n            }\n            str += i;\n            pos -= i == 4 ? 2 : 1;\n        }\n        return -1;\n    }\n{/if}\n{#if headerFlags.str_substring || headerFlags.str_slice}\n    const char * str_substring(const char * str, int16_t start, int16_t end) {\n        int16_t i, tmp, pos, len = str_len(str), byte_start = -1;\n        char *p, *buf;\n        start = start < 0 ? 0 : (start > len ? len : start);\n        end = end < 0 ? 0 : (end > len ? len : end);\n        if (end < start) {\n            tmp = start;\n            start = end;\n            end = tmp;\n        }\n        i = 0;\n        pos = 0;\n        p = (char *)str;\n        while (*p) {\n            if (start == pos)\n                byte_start = p - str;\n            if (end == pos)\n                break;\n            i = 1;\n            if ((*p & 0xE0) == 0xC0) i=2;\n            else if ((*p & 0xF0) == 0xE0) i=3;\n            else if ((*p & 0xF8) == 0xF0) i=4;\n            p += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        len = byte_start == -1 ? 0 : p - str - byte_start;\n        buf = malloc(len + 1);\n        assert(buf != NULL);\n        memcpy(buf, str + byte_start, len);\n        buf[len] = '\\0';\n        return buf;\n    }\n{/if}\n{#if headerFlags.str_slice}\n    const char * str_slice(const char * str, int16_t start, int16_t end) {\n        int16_t len = str_len(str);\n        start = start < 0 ? len + start : start;\n        end = end < 0 ? len + end : end;\n        if (end - start < 0)\n            end = start;\n        return str_substring(str, start, end);\n    }\n{/if}\n{#if headerFlags.str_int16_t_cat}\n    void str_int16_t_cat(char *str, int16_t num) {\n        char numstr[STR_INT16_T_BUFLEN];\n        sprintf(numstr, \"%d\", num);\n        strcat(str, numstr);\n    }\n{/if}\n\n{#if headerFlags.array_int16_t_cmp}\n    int array_int16_t_cmp(const void* a, const void* b) {\n        return ( *(int16_t*)a - *(int16_t*)b );\n    }\n{/if}\n{#if headerFlags.array_str_cmp}\n    int array_str_cmp(const void* a, const void* b) { \n        return strcmp(*(const char **)a, *(const char **)b);\n    }\n{/if}\n\n{#if headerFlags.parseInt}\n    int16_t parse_int16_t(const char * str) {\n        int r;\n        sscanf(str, \"%d\", &r);\n        return (int16_t) r;\n    }\n{/if}\n\n{userStructs => struct {name} {\n    {properties {    }=> {this};\n}};\n}\n\n{#if headerFlags.regex}\n    void regex_clear_matches(struct regex_match_struct_t *match_info, int16_t groupN) {\n        int16_t i;\n        for (i = 0; i < groupN; i++) {\n            match_info->matches[i].index = -1;\n            match_info->matches[i].end = -1;\n        }\n    }\n{/if}\n\n{#if headerFlags.regex_match}\n    struct array_string_t *regex_match(struct regex_struct_t regex, const char * s) {\n        struct regex_match_struct_t match_info;\n        struct array_string_t *match_array = NULL;\n        int16_t i;\n\n        match_info = regex.func(s, TRUE);\n        if (match_info.index != -1) {\n            ARRAY_CREATE(match_array, match_info.matches_count + 1, match_info.matches_count + 1);\n            match_array->data[0] = str_substring(s, match_info.index, match_info.end);\n            for (i = 0;i < match_info.matches_count; i++) {\n                if (match_info.matches[i].index != -1 && match_info.matches[i].end != -1)\n                    match_array->data[i + 1] = str_substring(s, match_info.matches[i].index, match_info.matches[i].end);\n                else\n                    match_array->data[i + 1] = str_substring(s, 0, 0);\n            }\n        }\n        if (match_info.matches_count)\n            free(match_info.matches);\n\n        return match_array;\n    }\n{/if}\n\n{#if headerFlags.gc_iterator}\n    int16_t gc_i;\n{/if}\n{#if headerFlags.gc_iterator2}\n    int16_t gc_j;\n{/if}\n\n{variables => {this};\n}\n\n{functionPrototypes => {this}\n}\n\n{functions => {this}\n}\n\nint main(void) {\n    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}\n\n    {statements {    }=> {this}}\n\n    {destructors}\n    return 0;\n}\n")
    ], CProgram);
    return CProgram;
}());
exports.CProgram = CProgram;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./memory":1,"./nodes/call":3,"./nodes/expressions":5,"./nodes/function":6,"./nodes/literals":7,"./nodes/statements":9,"./nodes/variable":10,"./standard/array/concat":14,"./standard/array/forEach":15,"./standard/array/indexOf":16,"./standard/array/join":17,"./standard/array/lastIndexOf":18,"./standard/array/pop":19,"./standard/array/push":20,"./standard/array/reverse":21,"./standard/array/shift":22,"./standard/array/slice":23,"./standard/array/sort":24,"./standard/array/splice":25,"./standard/array/unshift":26,"./standard/console/log":27,"./standard/global/parseInt":28,"./standard/string/charAt":29,"./standard/string/charCodeAt":30,"./standard/string/concat":31,"./standard/string/indexOf":32,"./standard/string/lastIndexOf":33,"./standard/string/match":34,"./standard/string/search":35,"./standard/string/slice":36,"./standard/string/substring":37,"./standard/string/toString":38,"./symbols":39,"./template":40,"./types":41}],12:[function(require,module,exports){
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
                for (var i = 1; i <= charTransitions_2.length; i++) {
                    if (i < charTransitions_2.length
                        && charTransitions_2[i].condition.charCodeAt(0) == charTransitions_2[i - 1].condition.charCodeAt(0) + 1
                        && charTransitions_2[i].next == charTransitions_2[i - 1].next
                        && charTransitions_2[i].fixedStart == charTransitions_2[i - 1].fixedStart
                        && charTransitions_2[i].fixedEnd == charTransitions_2[i - 1].fixedEnd
                        && charTransitions_2[i].final == charTransitions_2[i - 1].final
                        && JSON.stringify(charTransitions_2[i].startGroup) == JSON.stringify(charTransitions_2[i - 1].startGroup)
                        && JSON.stringify(charTransitions_2[i].endGroup) == JSON.stringify(charTransitions_2[i - 1].endGroup)) {
                        condition.toChar = charTransitions_2[i].condition;
                    }
                    else {
                        if (condition.fromChar == condition.toChar) {
                            classTransitions.push(charTransitions_2[i - 1]);
                        }
                        else {
                            classTransitions.push(__assign({}, charTransitions_2[i - 1], { condition: condition }));
                        }
                        if (i < charTransitions_2.length)
                            condition = { fromChar: charTransitions_2[i].condition, toChar: charTransitions_2[i].condition };
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

},{}],13:[function(require,module,exports){
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
},{}],14:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "concat" && objType instanceof types_1.ArrayType;
    };
    ArrayConcatResolver.prototype.returnType = function (typeHelper, call) {
        var propAccess = call.expression;
        var type = typeHelper.getCType(propAccess.expression);
        return new types_1.ArrayType(type.elementType, 0, true);
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
var CArrayConcat = /** @class */ (function () {
    function CArrayConcat(scope, call) {
        var _this = this;
        this.tempVarName = '';
        this.varAccess = null;
        this.concatValues = [];
        this.sizes = [];
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            var type = scope.root.typeHelper.getCType(propAccess.expression);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, new types_1.ArrayType(type.elementType, 0, true)));
            this.indexVarName = scope.root.symbolsHelper.addIterator(call);
            scope.variables.push(new variable_1.CVariable(scope, this.indexVarName, types_1.NumberVarType));
            var args = call.arguments.map(function (a) { return ({ node: a, template: template_1.CodeTemplateFactory.createForNode(scope, a) }); });
            var toConcatenate = [{ node: propAccess.expression, template: this.varAccess }].concat(args);
            this.sizes = toConcatenate.map(function (a) { return new CGetSize(scope, a.node, a.template); });
            this.concatValues = toConcatenate.map(function (a) { return new CConcatValue(scope, _this.tempVarName, a.node, a.template, _this.indexVarName); });
        }
        scope.root.headerFlags.array = true;
    }
    CArrayConcat = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        ARRAY_CREATE({tempVarName}, {sizes{+}=>{this}}, 0);\n        {tempVarName}->size = {tempVarName}->capacity;\n        {indexVarName} = 0;\n        {concatValues}\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayConcat);
    return CArrayConcat;
}());
var CGetSize = /** @class */ (function () {
    function CGetSize(scope, valueNode, value) {
        this.value = value;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isArray = type instanceof types_1.ArrayType;
        this.staticArraySize = type instanceof types_1.ArrayType && type.capacity;
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
        this.isArray = type instanceof types_1.ArrayType;
        this.staticArraySize = type instanceof types_1.ArrayType && !type.isDynamicArray && type.capacity;
        if (this.isArray) {
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(valueNode);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
        }
    }
    CConcatValue = __decorate([
        template_1.CodeTemplate("\n{#if staticArraySize}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++)\n        {varAccess}->data[{indexVarName}++] = {value}[{iteratorVarName}];\n{#elseif isArray}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {value}->size; {iteratorVarName}++)\n        {varAccess}->data[{indexVarName}++] = {value}->data[{iteratorVarName}];\n{#else}\n    {varAccess}->data[{indexVarName}++] = {value};\n{/if}\n")
    ], CConcatValue);
    return CConcatValue;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],15:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "forEach" && objType instanceof types_1.ArrayType;
    };
    ArrayForEachResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
var CArrayForEach = /** @class */ (function () {
    function CArrayForEach(scope, call) {
        this.iteratorFnAccess = null;
        this.staticArraySize = '';
        this.varAccess = null;
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        var objType = scope.root.typeHelper.getCType(propAccess.expression);
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
        this.staticArraySize = objType.isDynamicArray ? "" : objType.capacity + "";
        if (call.arguments.length === 0)
            throw Error('Array.forEach needs an argument.');
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        this.iteratorFnAccess = args[0];
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
    }
    CArrayForEach = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if staticArraySize}\n        for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++) {\n            {iteratorFnAccess}({varAccess}[{iteratorVarName}]);\n        }\n    {#else}\n        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++) {\n            iteratorFnAccess({varAccess}[{iteratorVarName}]);\n        }\n    {/if}\n{/statements}")
    ], CArrayForEach);
    return CArrayForEach;
}());
var CGetSize = /** @class */ (function () {
    function CGetSize(scope, valueNode, value) {
        this.value = value;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isArray = type instanceof types_1.ArrayType;
        this.staticArraySize = type instanceof types_1.ArrayType && type.capacity;
    }
    CGetSize = __decorate([
        template_1.CodeTemplate("\n{#if staticArraySize}\n    {staticArraySize}\n{#elseif isArray}\n    {value}->size\n{#else}\n    1\n{/if}")
    ], CGetSize);
    return CGetSize;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],16:[function(require,module,exports){
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
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var expressions_1 = require("../../nodes/expressions");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayIndexOfResolver = /** @class */ (function () {
    function ArrayIndexOfResolver() {
    }
    ArrayIndexOfResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "indexOf" && objType instanceof types_1.ArrayType;
    };
    ArrayIndexOfResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
var CArrayIndexOf = /** @class */ (function () {
    function CArrayIndexOf(scope, call) {
        this.tempVarName = '';
        this.staticArraySize = '';
        this.varAccess = null;
        var propAccess = call.expression;
        var objType = scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_pos");
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
            this.staticArraySize = objType.isDynamicArray ? "" : objType.capacity + "";
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.NumberVarType));
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            var arrayElementAccess = new elementaccess_1.CSimpleElementAccess(scope, objType, this.varAccess, this.iteratorVarName);
            this.comparison = new expressions_1.CSimpleBinaryExpression(scope, arrayElementAccess, objType.elementType, args[0], objType.elementType, ts.SyntaxKind.EqualsEqualsToken, call);
            scope.root.headerFlags.array = true;
        }
    }
    CArrayIndexOf = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && staticArraySize}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {#elseif !topExpressionOfStatement}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayIndexOf);
    return CArrayIndexOf;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/expressions":5,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],17:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return (propAccess.name.getText() == "join" || propAccess.name.getText() == "toString") && objType instanceof types_1.ArrayType;
    };
    ArrayConcatResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.StringVarType;
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
var CArrayJoin = /** @class */ (function () {
    function CArrayJoin(scope, call) {
        this.tempVarName = '';
        this.varAccess = null;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            var propAccess = call.expression;
            var type = scope.root.typeHelper.getCType(propAccess.expression);
            this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
            this.arraySize = new CArraySize(scope, this.varAccess, type);
            this.arrayElement = new CArrayElement(scope, this.varAccess, type);
            this.catFuncName = type.elementType == types_1.NumberVarType ? "str_int16_t_cat" : "strcat";
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, "char *"));
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(call);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            this.calculatedStringLength = new CCalculateStringSize(scope, this.varAccess, this.iteratorVarName, type, call);
            if (call.arguments.length > 0 && propAccess.name.getText() == "join")
                this.separator = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
            else
                this.separator = new literals_1.CString(scope, ',');
            scope.root.headerFlags.malloc = true;
            scope.root.headerFlags.strings = true;
            if (type.isDynamicArray)
                scope.root.headerFlags.array = true;
            if (type.elementType == types_1.NumberVarType)
                scope.root.headerFlags.str_int16_t_cat = true;
        }
    }
    CArrayJoin = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {tempVarName} = malloc({calculatedStringLength});\n        assert({tempVarName} != NULL);\n        ((char *){tempVarName})[0] = '\\0';\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n            if ({iteratorVarName} > 0)\n                strcat((char *){tempVarName}, {separator});\n            {catFuncName}((char *){tempVarName}, {arrayElement}[{iteratorVarName}]);\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayJoin);
    return CArrayJoin;
}());
var CArraySize = /** @class */ (function () {
    function CArraySize(scope, varAccess, type) {
        this.varAccess = varAccess;
        this.type = type;
        this.arrayCapacity = type.capacity + "";
    }
    CArraySize = __decorate([
        template_1.CodeTemplate("\n{#if type.isDynamicArray}\n    {varAccess}->size\n{#else}\n    {arrayCapacity}\n{/if}")
    ], CArraySize);
    return CArraySize;
}());
var CArrayElement = /** @class */ (function () {
    function CArrayElement(scope, varAccess, type) {
        this.varAccess = varAccess;
        this.type = type;
    }
    CArrayElement = __decorate([
        template_1.CodeTemplate("\n{#if type.isDynamicArray}\n    {varAccess}->data\n{#else}\n    {varAccess}\n{/if}")
    ], CArrayElement);
    return CArrayElement;
}());
var CCalculateStringSize = /** @class */ (function () {
    function CCalculateStringSize(scope, varAccess, iteratorVarName, type, node) {
        this.varAccess = varAccess;
        this.iteratorVarName = iteratorVarName;
        this.type = type;
        this.arrayOfStrings = type.elementType == types_1.StringVarType;
        this.arrayOfNumbers = type.elementType == types_1.NumberVarType;
        this.arrayCapacity = type.capacity + "";
        this.arraySize = new CArraySize(scope, this.varAccess, type);
        this.arrayElement = new CArrayElement(scope, this.varAccess, type);
        if (this.arrayOfStrings) {
            this.lengthVarName = scope.root.symbolsHelper.addTemp(node, "len");
            scope.variables.push(new variable_1.CVariable(scope, this.lengthVarName, types_1.NumberVarType));
        }
    }
    CCalculateStringSize = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if arrayOfStrings}\n        {lengthVarName} = 0;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)\n            {lengthVarName} += strlen({arrayElement}[{iteratorVarName}]);\n    {/if}\n{/statements}\n{#if type.isDynamicArray && arrayOfStrings}\n    {arraySize} == 0 ? 1 : {lengthVarName} + strlen({separator})*({arraySize}-1) + 1\n{#elseif arrayCapacity > 0 && arrayOfStrings}\n    {lengthVarName} + strlen({separator})*({arraySize}-1) + 1\n{#elseif type.isDynamicArray && arrayOfNumbers}\n    {varAccess}->size == 0 ? 1 : STR_INT16_T_BUFLEN*{varAccess}->size + strlen({separator})*({arraySize}-1) + 1\n{#elseif arrayCapacity > 0 && arrayOfNumbers}\n    STR_INT16_T_BUFLEN*{arraySize}+strlen({separator})*({arraySize}-1)+1\n{#else}\n    1\n{/if}")
    ], CCalculateStringSize);
    return CCalculateStringSize;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/literals":7,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],18:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "lastIndexOf" && objType instanceof types_1.ArrayType;
    };
    ArrayLastIndexOfResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
var CArrayLastIndexOf = /** @class */ (function () {
    function CArrayLastIndexOf(scope, call) {
        this.tempVarName = '';
        this.staticArraySize = '';
        this.varAccess = null;
        var propAccess = call.expression;
        var objType = scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_pos");
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
            this.staticArraySize = objType.isDynamicArray ? "" : objType.capacity + "";
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.NumberVarType));
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            var arrayElementAccess = new elementaccess_1.CSimpleElementAccess(scope, objType, this.varAccess, this.iteratorVarName);
            this.comparison = new expressions_1.CSimpleBinaryExpression(scope, arrayElementAccess, objType.elementType, args[0], objType.elementType, ts.SyntaxKind.EqualsEqualsToken, call);
            scope.root.headerFlags.array = true;
        }
    }
    CArrayLastIndexOf = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && staticArraySize}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = {staticArraySize} - 1; {iteratorVarName} >= 0; {iteratorVarName}--) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {#elseif !topExpressionOfStatement}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = {varAccess}->size - 1; {iteratorVarName} >= 0; {iteratorVarName}--) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayLastIndexOf);
    return CArrayLastIndexOf;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/expressions":5,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],19:[function(require,module,exports){
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
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayPopResolver = /** @class */ (function () {
    function ArrayPopResolver() {
    }
    ArrayPopResolver.prototype.matchesNode = function (typeHelper, call, options) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "pop" && (objType instanceof types_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArrayPopResolver.prototype.objectType = function (typeHelper, call) {
        return new types_1.ArrayType(types_1.PointerVarType, 0, true);
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
var CArrayPop = /** @class */ (function () {
    function CArrayPop(scope, call) {
        this.tempVarName = '';
        this.varAccess = null;
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_pop = true;
    }
    CArrayPop = __decorate([
        template_1.CodeTemplate("ARRAY_POP({varAccess})")
    ], CArrayPop);
    return CArrayPop;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":13,"../../template":40,"../../types":41}],20:[function(require,module,exports){
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
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayPushResolver = /** @class */ (function () {
    function ArrayPushResolver() {
    }
    ArrayPushResolver.prototype.matchesNode = function (typeHelper, call, options) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "push" && (objType && objType instanceof types_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArrayPushResolver.prototype.objectType = function (typeHelper, call) {
        var elementType = call.arguments[0] && typeHelper.getCType(call.arguments[0]);
        return new types_1.ArrayType(elementType || types_1.PointerVarType, 0, true);
    };
    ArrayPushResolver.prototype.argumentTypes = function (typeHelper, call) {
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return call.arguments.map(function (a) { return objType instanceof types_1.ArrayType ? objType.elementType : null; });
    };
    ArrayPushResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
var CArrayPush = /** @class */ (function () {
    function CArrayPush(scope, call) {
        var _this = this;
        this.tempVarName = '';
        this.varAccess = null;
        this.pushValues = [];
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        this.pushValues = args.map(function (a) { return new CPushValue(scope, _this.varAccess, a); });
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_size");
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.NumberVarType));
        }
        scope.root.headerFlags.array = true;
    }
    CArrayPush = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {pushValues}\n        {tempVarName} = {varAccess}->size;\n    {/if}\n{/statements}\n{#if topExpressionOfStatement}\n    {pushValues}\n{#else}\n    {tempVarName}\n{/if}")
    ], CArrayPush);
    return CArrayPush;
}());
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],21:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "reverse" && (objType && objType instanceof types_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArraySortResolver.prototype.objectType = function (typeHelper, call) {
        return new types_1.ArrayType(types_1.PointerVarType, 0, true);
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
var CArrayReverse = /** @class */ (function () {
    function CArrayReverse(scope, call) {
        this.varAccess = null;
        var propAccess = call.expression;
        var type = scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.iteratorVar1 = scope.root.symbolsHelper.addIterator(call);
        this.iteratorVar2 = scope.root.symbolsHelper.addIterator(call);
        this.tempVarName = scope.root.symbolsHelper.addTemp(call, "temp");
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVar1, types_1.NumberVarType));
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVar2, types_1.NumberVarType));
        scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, type.elementType));
    }
    CArrayReverse = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {iteratorVar1} = 0;\n    {iteratorVar2} = {varAccess}->size - 1;\n    while ({iteratorVar1} < {iteratorVar2}) {\n        {tempVarName} = {varAccess}->data[{iteratorVar1}];\n        {varAccess}->data[{iteratorVar1}] = {varAccess}->data[{iteratorVar2}];\n        {varAccess}->data[{iteratorVar2}] = {tempVarName};\n        {iteratorVar1}++;\n        {iteratorVar2}--;\n    }\n{/statements}\n{#if !topExpressionOfStatement}\n    {varAccess}\n{/if}")
    ], CArrayReverse);
    return CArrayReverse;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],22:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "shift" && (objType && objType instanceof types_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArrayShiftResolver.prototype.objectType = function (typeHelper, call) {
        return new types_1.ArrayType(types_1.PointerVarType, 0, true);
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
var CArrayShift = /** @class */ (function () {
    function CArrayShift(scope, call) {
        this.tempVarName = '';
        this.varAccess = null;
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "value");
        var type = scope.root.typeHelper.getCType(propAccess.expression);
        scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, type.elementType));
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_remove = true;
    }
    CArrayShift = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {tempVarName} = {varAccess}->data[0];\n    ARRAY_REMOVE({varAccess}, 0, 1);\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayShift);
    return CArrayShift;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],23:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "slice" && objType instanceof types_1.ArrayType;
    };
    ArraySliceResolver.prototype.returnType = function (typeHelper, call) {
        var _a = getSliceParams(typeHelper, call), size = _a.size, dynamic = _a.dynamic, elementType = _a.elementType;
        return new types_1.ArrayType(elementType, size, dynamic);
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
var CArraySlice = /** @class */ (function () {
    function CArraySlice(scope, call) {
        this.tempVarName = '';
        this.iteratorVarName = '';
        this.sizeVarName = '';
        this.startVarName = '';
        this.endVarName = '';
        this.simpleSlice = false;
        this.simpleSliceSize = 0;
        this.simpleSliceStart = 0;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (this.topExpressionOfStatement)
            return;
        var propAccess = call.expression;
        var varType = scope.root.typeHelper.getCType(propAccess.expression);
        var varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.arraySize = new elementaccess_1.CSimpleElementAccess(scope, varType, varAccess, "length");
        this.arrayDataAccess = new CArrayDataAccess(scope, varAccess, varType.isDynamicArray);
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        this.startIndexArg = args[0];
        this.endIndexArg = args.length == 2 ? args[1] : null;
        var _a = getSliceParams(scope.root.typeHelper, call), start = _a.start, size = _a.size, dynamic = _a.dynamic;
        if (!dynamic) {
            this.simpleSlice = true;
            this.simpleSliceStart = start;
            this.simpleSliceSize = size;
            var reuseVariable = tryReuseExistingVariable(call);
            if (reuseVariable)
                this.tempVarName = reuseVariable.getText();
            else {
                this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "tmp_slice");
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, new types_1.ArrayType(varType.elementType, this.simpleSliceSize, false)));
            }
            return;
        }
        this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
        var arrayType = scope.root.typeHelper.getCType(propAccess.expression);
        var tempVarType = new types_1.ArrayType(arrayType.elementType, 0, true);
        if (!scope.root.memoryManager.variableWasReused(call))
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, tempVarType));
        this.sizeVarName = scope.root.symbolsHelper.addTemp(propAccess, this.tempVarName + "_size");
        scope.variables.push(new variable_1.CVariable(scope, this.sizeVarName, types_1.NumberVarType));
        this.startVarName = scope.root.symbolsHelper.addTemp(propAccess, this.tempVarName + "_start");
        scope.variables.push(new variable_1.CVariable(scope, this.startVarName, types_1.NumberVarType));
        if (args.length == 2) {
            this.endVarName = scope.root.symbolsHelper.addTemp(propAccess, this.tempVarName + "_end");
            scope.variables.push(new variable_1.CVariable(scope, this.endVarName, types_1.NumberVarType));
        }
        scope.root.headerFlags.array = true;
    }
    CArraySlice = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && simpleSlice }\n        for ({iteratorVarName} = 0; {iteratorVarName} < {simpleSliceSize}; {iteratorVarName}++)\n            {tempVarName}[{iteratorVarName}] = {arrayDataAccess}[{iteratorVarName} + {simpleSliceStart}];\n    {#elseif !topExpressionOfStatement && !simpleSlice && !endIndexArg}\n        {sizeVarName} = ({startIndexArg}) < 0 ? -({startIndexArg}) : {arraySize} - ({startIndexArg});\n        {startVarName} = ({startIndexArg}) < 0 ? {arraySize} + ({startIndexArg}) : ({startIndexArg});\n        ARRAY_CREATE({tempVarName}, {sizeVarName}, {sizeVarName});\n        for ({iteratorVarName} = 0; {iteratorVarName} < {sizeVarName}; {iteratorVarName}++)\n            {tempVarName}->data[{iteratorVarName}] = {arrayDataAccess}[{iteratorVarName} + {startVarName}];\n    {#elseif !topExpressionOfStatement && !simpleSlice && endIndexArg}\n        {startVarName} = ({startIndexArg}) < 0 ? {arraySize} + ({startIndexArg}) : ({startIndexArg});\n        {endVarName} = ({endIndexArg}) < 0 ? {arraySize} + ({endIndexArg}) : ({endIndexArg});\n        {sizeVarName} = {endVarName} - {startVarName};\n        ARRAY_CREATE({tempVarName}, {sizeVarName}, {sizeVarName});\n        for ({iteratorVarName} = 0; {iteratorVarName} < {sizeVarName}; {iteratorVarName}++)\n            {tempVarName}->data[{iteratorVarName}] = {arrayDataAccess}[{iteratorVarName} + {startVarName}];\n    {/if}\n{/statements}\n{#if topExpressionOfStatement}\n    /* slice doesn't have side effects, skipping */\n{#else}\n    {tempVarName}\n{/if}")
    ], CArraySlice);
    return CArraySlice;
}());
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
    if (!(objType instanceof types_1.ArrayType))
        return params;
    params.elementType = objType.elementType;
    var reuseVar = tryReuseExistingVariable(call);
    var reuseVarType = reuseVar && typeHelper.getCType(reuseVar);
    var reuseVarIsDynamicArray = reuseVar && reuseVarType instanceof types_1.ArrayType && reuseVarType.isDynamicArray;
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],24:[function(require,module,exports){
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
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArraySortResolver = /** @class */ (function () {
    function ArraySortResolver() {
    }
    ArraySortResolver.prototype.matchesNode = function (typeHelper, call, options) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "sort" && (objType && objType instanceof types_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArraySortResolver.prototype.objectType = function (typeHelper, call) {
        return new types_1.ArrayType(types_1.PointerVarType, 0, true);
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
var CArraySort = /** @class */ (function () {
    function CArraySort(scope, call) {
        this.varAccess = null;
        this.arrayOfInts = false;
        this.arrayOfStrings = false;
        var propAccess = call.expression;
        var type = scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.arrayOfInts = type.elementType == types_1.NumberVarType;
        this.arrayOfStrings = type.elementType == types_1.StringVarType;
        if (this.arrayOfInts)
            scope.root.headerFlags.array_int16_t_cmp = true;
        else if (this.arrayOfStrings)
            scope.root.headerFlags.array_str_cmp = true;
    }
    CArraySort = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && arrayOfInts}\n        qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_int16_t_cmp);\n    {#elseif !topExpressionOfStatement && arrayOfStrings}\n        qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_str_cmp);\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {varAccess}\n{#elseif arrayOfInts}\n    qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_int16_t_cmp);\n{#elseif arrayOfStrings}\n    qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_str_cmp);\n{/if}")
    ], CArraySort);
    return CArraySort;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":13,"../../template":40,"../../types":41}],25:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "splice" && (objType && objType instanceof types_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArraySpliceResolver.prototype.objectType = function (typeHelper, call) {
        return new types_1.ArrayType(types_1.PointerVarType, 0, true);
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
var CArraySplice = /** @class */ (function () {
    function CArraySplice(scope, call) {
        var _this = this;
        this.tempVarName = '';
        this.varAccess = null;
        this.insertValues = [];
        this.needsRemove = false;
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        this.startPosArg = args[0];
        this.deleteCountArg = args[1];
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            var type = scope.root.typeHelper.getCType(propAccess.expression);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, type));
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(propAccess);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
        }
        if (call.arguments.length > 2) {
            this.insertValues = args.slice(2).reverse().map(function (a) { return new CInsertValue(scope, _this.varAccess, _this.startPosArg, a); });
            scope.root.headerFlags.array_insert = true;
        }
        if (call.arguments[1].kind == ts.SyntaxKind.NumericLiteral) {
            this.needsRemove = call.arguments[1].getText() != "0";
        }
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_insert = true;
        scope.root.headerFlags.array_remove = true;
    }
    CArraySplice = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        ARRAY_CREATE({tempVarName}, {deleteCountArg}, {deleteCountArg});\n        for ({iteratorVarName} = 0; {iteratorVarName} < {deleteCountArg}; {iteratorVarName}++)\n            {tempVarName}->data[{iteratorVarName}] = {varAccess}->data[{iteratorVarName}+(({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}))];\n        ARRAY_REMOVE({varAccess}, ({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}), {deleteCountArg});\n        {insertValues}\n    {/if}\n{/statements}\n{#if topExpressionOfStatement && needsRemove}\n    ARRAY_REMOVE({varAccess}, ({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}), {deleteCountArg});\n    {insertValues}\n{#elseif topExpressionOfStatement && !needsRemove}\n    {insertValues}\n{#else}\n    {tempVarName}\n{/if}")
    ], CArraySplice);
    return CArraySplice;
}());
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],26:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "unshift" && (objType && objType instanceof types_1.ArrayType && objType.isDynamicArray || options && options.determineObjectType);
    };
    ArrayUnshiftResolver.prototype.objectType = function (typeHelper, call) {
        var elementType = call.arguments[0] && typeHelper.getCType(call.arguments[0]);
        return new types_1.ArrayType(elementType || types_1.PointerVarType, 0, true);
    };
    ArrayUnshiftResolver.prototype.argumentTypes = function (typeHelper, call) {
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return call.arguments.map(function (a) { return objType instanceof types_1.ArrayType ? objType.elementType : null; });
    };
    ArrayUnshiftResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
var CArrayUnshift = /** @class */ (function () {
    function CArrayUnshift(scope, call) {
        var _this = this;
        this.tempVarName = '';
        this.varAccess = null;
        this.unshiftValues = [];
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        this.unshiftValues = args.map(function (a) { return new CUnshiftValue(scope, _this.varAccess, a); });
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(propAccess, "arr_size");
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.NumberVarType));
        }
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_insert = true;
    }
    CArrayUnshift = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {unshiftValues}\n        {tempVarName} = {varAccess}->size;\n    {/if}\n{/statements}\n{#if topExpressionOfStatement}\n    {unshiftValues}\n{#else}\n    {tempVarName}\n{/if}")
    ], CArrayUnshift);
    return CArrayUnshift;
}());
var CUnshiftValue = /** @class */ (function () {
    function CUnshiftValue(scope, varAccess, value) {
        this.varAccess = varAccess;
        this.value = value;
    }
    CUnshiftValue = __decorate([
        template_1.CodeTemplate("ARRAY_INSERT({varAccess}, 0, {value});\n")
    ], CUnshiftValue);
    return CUnshiftValue;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],27:[function(require,module,exports){
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
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var standard_1 = require("../../standard");
var ConsoleLogResolver = /** @class */ (function () {
    function ConsoleLogResolver() {
    }
    ConsoleLogResolver.prototype.matchesNode = function (typeHelper, call) {
        if (!ts.isPropertyAccessExpression(call.expression))
            return false;
        return call.expression.getText() == "console.log";
    };
    ConsoleLogResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.VoidType;
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
var CConsoleLog = /** @class */ (function () {
    function CConsoleLog(scope, node) {
        this.printfCalls = [];
        this.printfCall = null;
        var printfs = [];
        var printNodes = node.arguments;
        var _loop_1 = function (i) {
            var printNode = printNodes[i];
            var type = scope.root.typeHelper.getCType(printNode);
            var nodeExpressions = processBinaryExpressions(scope, printNode);
            var stringLit = '';
            nodeExpressions = nodeExpressions.reduce(function (a, c) {
                if (c.node.kind == ts.SyntaxKind.StringLiteral)
                    stringLit += c.expression.resolve().slice(1, -1);
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
                    nodeExpressions.push({ node: printNode, expression: stringLit, prefix: '', postfix: '' });
            }
            for (var j = 0; j < nodeExpressions.length; j++) {
                var _a = nodeExpressions[j], node_1 = _a.node, expression = _a.expression, prefix = _a.prefix, postfix = _a.postfix;
                var accessor = expression["resolve"] ? expression["resolve"]() : expression;
                var options = {
                    prefix: (i > 0 && j == 0 ? " " : "") + prefix,
                    postfix: postfix + (i == printNodes.length - 1 && j == nodeExpressions.length - 1 ? "\\n" : "")
                };
                printfs.push(new CPrintf(scope, node_1, accessor, type, options));
            }
        };
        for (var i = 0; i < printNodes.length; i++) {
            _loop_1(i);
        }
        this.printfCalls = printfs.slice(0, -1);
        this.printfCall = printfs[printfs.length - 1];
        scope.root.headerFlags.printf = true;
    }
    CConsoleLog = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if printfCalls.length}\n        {printfCalls => {this}\n}\n    {/if}\n{/statements}\n{printfCall}")
    ], CConsoleLog);
    return CConsoleLog;
}());
function processBinaryExpressions(scope, printNode) {
    var type = scope.root.typeHelper.getCType(printNode);
    if (type == types_1.StringVarType && printNode.kind == ts.SyntaxKind.BinaryExpression) {
        var binExpr = printNode;
        if (scope.root.typeHelper.getCType(binExpr.left) == types_1.StringVarType
            && scope.root.typeHelper.getCType(binExpr.right) == types_1.StringVarType) {
            var left = processBinaryExpressions(scope, binExpr.left);
            var right = processBinaryExpressions(scope, binExpr.right);
            return [].concat(left, right);
        }
    }
    return [{ node: printNode, expression: template_1.CodeTemplateFactory.createForNode(scope, printNode), prefix: '', postfix: '' }];
}
var CPrintf = /** @class */ (function () {
    function CPrintf(scope, printNode, accessor, varType, options) {
        this.accessor = accessor;
        this.isStringLiteral = false;
        this.isQuotedCString = false;
        this.isCString = false;
        this.isRegex = false;
        this.isInteger = false;
        this.isBoolean = false;
        this.isDict = false;
        this.isStruct = false;
        this.isArray = false;
        this.isStaticArray = false;
        this.elementPrintfs = [];
        this.elementFormatString = '';
        this.propPrefix = '';
        this.INDENT = '';
        this.isStringLiteral = varType == types_1.StringVarType && printNode.kind == ts.SyntaxKind.StringLiteral;
        this.isQuotedCString = varType == types_1.StringVarType && options.quotedString;
        this.isCString = varType == types_1.StringVarType && !options.quotedString;
        this.isRegex = varType == types_1.RegexVarType;
        this.isInteger = varType == types_1.NumberVarType;
        this.isBoolean = varType == types_1.BooleanVarType;
        this.PREFIX = options.prefix || '';
        this.POSTFIX = options.postfix || '';
        if (options.propName)
            this.PREFIX = this.PREFIX + options.propName + ": ";
        if (options.indent)
            this.INDENT = options.indent;
        if (varType instanceof types_1.ArrayType) {
            this.isArray = true;
            this.isStaticArray = !varType.isDynamicArray;
            this.elementFormatString = varType.elementType == types_1.NumberVarType ? '%d'
                : varType.elementType == types_1.StringVarType ? '\\"%s\\"' : '';
            this.arraySize = varType.isDynamicArray ? accessor + "->size" : varType.capacity + "";
            if (!this.isStaticArray || !this.elementFormatString || varType.capacity > 3) {
                this.iteratorVarName = scope.root.symbolsHelper.addIterator(printNode);
                scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
                var elementAccessor = accessor + (varType.isDynamicArray ? "->data" : "") + "[" + this.iteratorVarName + "]";
                var opts = { quotedString: true, indent: this.INDENT + "    " };
                this.elementPrintfs = [
                    new CPrintf_1(scope, printNode, elementAccessor, varType.elementType, opts)
                ];
            }
        }
        else if (varType instanceof types_1.DictType) {
            this.isDict = true;
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(printNode);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            var opts = { quotedString: true, indent: this.INDENT + "    " };
            this.elementPrintfs = [
                new CPrintf_1(scope, printNode, accessor + "->values->data[" + this.iteratorVarName + "]", varType.elementType, opts)
            ];
        }
        else if (varType instanceof types_1.StructType) {
            this.isStruct = true;
            for (var k in varType.properties) {
                var propAccessor = accessor + "->" + k;
                var opts = { quotedString: true, propName: k, indent: this.INDENT + "    " };
                this.elementPrintfs.push(new CPrintf_1(scope, printNode, propAccessor, varType.properties[k], opts));
            }
        }
    }
    CPrintf_1 = CPrintf;
    CPrintf = CPrintf_1 = __decorate([
        template_1.CodeTemplate("\n{#if isStringLiteral}\n    printf(\"{PREFIX}{accessor}{POSTFIX}\");\n{#elseif isQuotedCString}\n    printf(\"{PREFIX}\\\"%s\\\"{POSTFIX}\", {accessor});\n{#elseif isCString}\n    printf(\"{PREFIX}%s{POSTFIX}\", {accessor});\n{#elseif isRegex}\n    printf(\"{PREFIX}%s{POSTFIX}\", {accessor}.str);\n{#elseif isInteger}\n    printf(\"{PREFIX}%d{POSTFIX}\", {accessor});\n{#elseif isBoolean && !PREFIX && !POSTFIX}\n    printf({accessor} ? \"true\" : \"false\");\n{#elseif isBoolean && (PREFIX || POSTFIX)}\n    printf(\"{PREFIX}%s{POSTFIX}\", {accessor} ? \"true\" : \"false\");\n{#elseif isDict}\n    printf(\"{PREFIX}{ \");\n    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {accessor}->index->size; {iteratorVarName}++) {\n    {INDENT}    if ({iteratorVarName} != 0)\n    {INDENT}        printf(\", \");\n    {INDENT}    printf(\"\\\"%s\\\": \", {accessor}->index->data[{iteratorVarName}]);\n    {INDENT}    {elementPrintfs}\n    {INDENT}}\n    {INDENT}printf(\" }{POSTFIX}\");\n{#elseif isStruct}\n    printf(\"{PREFIX}{ \");\n    {INDENT}{elementPrintfs {    printf(\", \");\n    }=> {this}}\n    {INDENT}printf(\" }{POSTFIX}\");\n{#elseif isStaticArray && elementFormatString && +arraySize==1}\n    printf(\"{PREFIX}[ {elementFormatString} ]{POSTFIX}\", {accessor}[0]);\n{#elseif isStaticArray && elementFormatString && +arraySize==2}\n    printf(\"{PREFIX}[ {elementFormatString}, {elementFormatString} ]{POSTFIX}\", {accessor}[0], {accessor}[1]);\n{#elseif isStaticArray && elementFormatString && +arraySize==3}\n    printf(\"{PREFIX}[ {elementFormatString}, {elementFormatString}, {elementFormatString} ]{POSTFIX}\", {accessor}[0], {accessor}[1], {accessor}[2]);\n{#elseif isArray}\n    printf(\"{PREFIX}[ \");\n    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n    {INDENT}    if ({iteratorVarName} != 0)\n    {INDENT}        printf(\", \");\n    {INDENT}    {elementPrintfs}\n    {INDENT}}\n    {INDENT}printf(\" ]{POSTFIX}\");\n{#else}\n    printf(/* Unsupported printf expression */);\n{/if}")
    ], CPrintf);
    return CPrintf;
    var CPrintf_1;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],28:[function(require,module,exports){
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
var types_1 = require("../../types");
var ParseIntResolver = /** @class */ (function () {
    function ParseIntResolver() {
    }
    ParseIntResolver.prototype.matchesNode = function (typeHelper, call) {
        return call.expression.kind === ts.SyntaxKind.Identifier && call.expression.getText() === "parseInt";
    };
    ParseIntResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
var CParseInt = /** @class */ (function () {
    function CParseInt(scope, call) {
        this.arguments = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        scope.root.headerFlags.parseInt = true;
    }
    CParseInt = __decorate([
        template_1.CodeTemplate("parse_int16_t({arguments {, }=> {this}})")
    ], CParseInt);
    return CParseInt;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../standard":13,"../../template":40,"../../types":41}],29:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "charAt" && objType == types_1.StringVarType;
    };
    StringCharAtResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.StringVarType;
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
var CStringCharAt = /** @class */ (function () {
    function CStringCharAt(scope, call) {
        this.varAccess = null;
        this.start = null;
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 0) {
                console.log("Error in " + call.getText() + ". Parameter expected!");
            }
            else {
                this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.StringVarType));
                this.start = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
            }
        }
        scope.root.headerFlags.str_substring = true;
    }
    CStringCharAt = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && start != null}\n        {tempVarName} = str_substring({varAccess}, {start}, ({start}) + 1);\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement && start != null}\n    {tempVarName}\n{#elseif !topExpressionOfStatement && start == null}\n    /* Error: parameter expected for charAt */\n{/if}")
    ], CStringCharAt);
    return CStringCharAt;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],30:[function(require,module,exports){
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
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringCharCodeAtResolver = /** @class */ (function () {
    function StringCharCodeAtResolver() {
    }
    StringCharCodeAtResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "charCodeAt" && objType == types_1.StringVarType;
    };
    StringCharCodeAtResolver.prototype.objectType = function (typeHelper, call) {
        return types_1.StringVarType;
    };
    StringCharCodeAtResolver.prototype.argumentTypes = function (typeHelper, call) {
        return call.arguments.map(function (a, i) { return i == 0 ? types_1.NumberVarType : null; });
    };
    StringCharCodeAtResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
var CStringSearch = /** @class */ (function () {
    function CStringSearch(scope, call) {
        var propAccess = call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                this.strAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                this.position = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                scope.root.headerFlags.str_char_code_at = true;
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
    }
    CStringSearch = __decorate([
        template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    str_char_code_at({strAccess}, {position})\n{/if}")
    ], CStringSearch);
    return CStringSearch;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":13,"../../template":40,"../../types":41}],31:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "concat" && objType == types_1.StringVarType;
    };
    StringConcatResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.StringVarType;
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
var CStringConcat = /** @class */ (function () {
    function CStringConcat(scope, call) {
        var _this = this;
        this.tempVarName = '';
        this.varAccess = null;
        this.concatValues = [];
        this.sizes = [];
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, "char *"));
            var args = call.arguments.map(function (a) { return ({ node: a, template: template_1.CodeTemplateFactory.createForNode(scope, a) }); });
            var toConcatenate = [{ node: propAccess.expression, template: this.varAccess }].concat(args);
            this.sizes = toConcatenate.map(function (a) { return new CGetSize(scope, a.node, a.template); });
            this.concatValues = toConcatenate.map(function (a) { return new CConcatValue(scope, _this.tempVarName, a.node, a.template); });
        }
        scope.root.headerFlags.strings = true;
        scope.root.headerFlags.malloc = true;
        scope.root.headerFlags.str_int16_t_cat = true;
    }
    CStringConcat = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {tempVarName} = malloc({sizes{+}=>{this}} + 1);\n        assert({tempVarName} != NULL);\n        ((char *){tempVarName})[0] = '\\0';\n        {concatValues}\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CStringConcat);
    return CStringConcat;
}());
var CGetSize = /** @class */ (function () {
    function CGetSize(scope, valueNode, value) {
        this.value = value;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isNumber = type == types_1.NumberVarType;
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
        this.isNumber = type == types_1.NumberVarType;
    }
    CConcatValue = __decorate([
        template_1.CodeTemplate("\n{#if isNumber}\n    str_int16_t_cat((char *){tempVarName}, {value});\n{#else}\n    strcat((char *){tempVarName}, {value});\n{/if}\n")
    ], CConcatValue);
    return CConcatValue;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],32:[function(require,module,exports){
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
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringIndexOfResolver = /** @class */ (function () {
    function StringIndexOfResolver() {
    }
    StringIndexOfResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "indexOf" && objType == types_1.StringVarType;
    };
    StringIndexOfResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
var CStringIndexOf = /** @class */ (function () {
    function CStringIndexOf(scope, call) {
        var propAccess = call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                this.stringAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                this.arg1 = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                scope.root.headerFlags.str_pos = true;
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
    }
    CStringIndexOf = __decorate([
        template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    str_pos({stringAccess}, {arg1})\n{/if}")
    ], CStringIndexOf);
    return CStringIndexOf;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":13,"../../template":40,"../../types":41}],33:[function(require,module,exports){
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
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringIndexOfResolver = /** @class */ (function () {
    function StringIndexOfResolver() {
    }
    StringIndexOfResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "lastIndexOf" && objType == types_1.StringVarType;
    };
    StringIndexOfResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
var CStringIndexOf = /** @class */ (function () {
    function CStringIndexOf(scope, call) {
        var propAccess = call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                this.stringAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                this.arg1 = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                scope.root.headerFlags.str_rpos = true;
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
    }
    CStringIndexOf = __decorate([
        template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    str_rpos({stringAccess}, {arg1})\n{/if}")
    ], CStringIndexOf);
    return CStringIndexOf;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":13,"../../template":40,"../../types":41}],34:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "match" && objType == types_1.StringVarType;
    };
    StringMatchResolver.prototype.objectType = function (typeHelper, call) {
        return types_1.StringVarType;
    };
    StringMatchResolver.prototype.argumentTypes = function (typeHelper, call) {
        return call.arguments.map(function (a, i) { return i == 0 ? types_1.RegexVarType : null; });
    };
    StringMatchResolver.prototype.returnType = function (typeHelper, call) {
        return new types_1.ArrayType(types_1.StringVarType, 1, true);
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
var CStringMatch = /** @class */ (function () {
    function CStringMatch(scope, call) {
        this.topExpressionOfStatement = false;
        this.gcVarName = null;
        scope.root.headerFlags.str_substring = true;
        var propAccess = call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                this.argAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                this.regexVar = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(call);
                this.matchArrayVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new variable_1.CVariable(scope, this.matchArrayVarName, new types_1.ArrayType(types_1.StringVarType, 0, true)));
                scope.root.headerFlags.regex_match = true;
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.gc_iterator = true;
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
    }
    CStringMatch = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {matchArrayVarName} = regex_match({regexVar}, {argAccess});\n    {/if}\n    {#if !topExpressionOfStatement && gcVarName}\n        ARRAY_PUSH({gcVarName}, (void *){matchArrayVarName});\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {matchArrayVarName}\n{/if}")
    ], CStringMatch);
    return CStringMatch;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],35:[function(require,module,exports){
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
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringSearchResolver = /** @class */ (function () {
    function StringSearchResolver() {
    }
    StringSearchResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "search" && objType == types_1.StringVarType;
    };
    StringSearchResolver.prototype.objectType = function (typeHelper, call) {
        return types_1.StringVarType;
    };
    StringSearchResolver.prototype.argumentTypes = function (typeHelper, call) {
        return call.arguments.map(function (a, i) { return i == 0 ? types_1.RegexVarType : null; });
    };
    StringSearchResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
var CStringSearch = /** @class */ (function () {
    function CStringSearch(scope, call) {
        var propAccess = call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                this.argAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                this.regexVar = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
    }
    CStringSearch = __decorate([
        template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    {regexVar}.func({argAccess}, FALSE).index\n{/if}")
    ], CStringSearch);
    return CStringSearch;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../standard":13,"../../template":40,"../../types":41}],36:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "slice" && objType == types_1.StringVarType;
    };
    StringSliceResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.StringVarType;
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
var CStringSlice = /** @class */ (function () {
    function CStringSlice(scope, call) {
        this.varAccess = null;
        this.start = null;
        this.end = null;
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 0) {
                console.log("Error in " + call.getText() + ". At least one parameter expected!");
            }
            else {
                this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.StringVarType));
                this.start = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                if (call.arguments.length >= 2)
                    this.end = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[1]);
            }
        }
        scope.root.headerFlags.str_slice = true;
    }
    CStringSlice = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && start && end}\n        {tempVarName} = str_slice({varAccess}, {start}, {end});\n    {#elseif !topExpressionOfStatement && start && !end}\n        {tempVarName} = str_slice({varAccess}, {start}, str_len({varAccess}));\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement && start}\n    {tempVarName}\n{#elseif !topExpressionOfStatement && !start}\n    /* Error: String.slice requires at least one parameter! */\n{/if}")
    ], CStringSlice);
    return CStringSlice;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],37:[function(require,module,exports){
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
var types_1 = require("../../types");
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
        return propAccess.name.getText() == "substring" && objType == types_1.StringVarType;
    };
    StringSubstringResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.StringVarType;
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
var CStringSubstring = /** @class */ (function () {
    function CStringSubstring(scope, call) {
        this.varAccess = null;
        this.start = null;
        this.end = null;
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 0) {
                console.log("Error in " + call.getText() + ". At least one parameter expected!");
            }
            else {
                this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                if (!scope.root.memoryManager.variableWasReused(call))
                    scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.StringVarType));
                this.start = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                if (call.arguments.length >= 2)
                    this.end = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[1]);
            }
        }
        scope.root.headerFlags.str_substring = true;
    }
    CStringSubstring = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && start && end}\n        {tempVarName} = str_substring({varAccess}, {start}, {end});\n    {#elseif !topExpressionOfStatement && start && !end}\n        {tempVarName} = str_substring({varAccess}, {start}, str_len({varAccess}));\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement && start}\n    {tempVarName}\n{#elseif !topExpressionOfStatement && !start}\n    /* Error: String.substring requires at least one parameter! */\n{/if}")
    ], CStringSubstring);
    return CStringSubstring;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":10,"../../standard":13,"../../template":40,"../../types":41}],38:[function(require,module,exports){
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
var types_1 = require("../../types");
var StringToStringResolver = /** @class */ (function () {
    function StringToStringResolver() {
    }
    StringToStringResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return ["toString", "valueOf"].indexOf(propAccess.name.getText()) > -1 && objType == types_1.StringVarType;
    };
    StringToStringResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.StringVarType;
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
},{"../../standard":13,"../../template":40,"../../types":41}],39:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var types_1 = require("./types");
var SymbolsHelper = /** @class */ (function () {
    function SymbolsHelper(typeChecker, typeHelper) {
        this.typeChecker = typeChecker;
        this.typeHelper = typeHelper;
        this.userStructs = {};
        this.arrayStructs = [];
        this.temporaryVariables = {};
        this.iteratorVarNames = ['i', 'j', 'k', 'l', 'm', 'n'];
    }
    SymbolsHelper.prototype.getStructsAndFunctionPrototypes = function () {
        var _this = this;
        for (var _i = 0, _a = this.arrayStructs; _i < _a.length; _i++) {
            var arrElemType = _a[_i];
            var elementTypeText = this.typeHelper.getTypeString(arrElemType);
            var structName = types_1.ArrayType.getArrayStructName(elementTypeText);
            this.userStructs[structName] = new types_1.StructType({
                size: { type: types_1.NumberVarType, order: 1 },
                capacity: { type: types_1.NumberVarType, order: 2 },
                data: { type: elementTypeText + "*", order: 3 }
            });
            this.userStructs[structName].structName = structName;
        }
        var structs = Object.keys(this.userStructs).map(function (k) { return ({
            name: k,
            properties: Object.keys(_this.userStructs[k].properties).map(function (pk) { return ({
                name: pk,
                type: _this.userStructs[k].properties[pk]
            }); })
        }); });
        return [structs];
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
        var userStructCode = this.getStructureBodyString(structType.properties);
        for (var s in this.userStructs) {
            if (this.getStructureBodyString(this.userStructs[s].properties) == userStructCode)
                return s;
        }
        return null;
    };
    SymbolsHelper.prototype.getStructureBodyString = function (properties) {
        var userStructCode = '{\n';
        for (var propName in properties) {
            var propType = properties[propName];
            if (typeof propType === 'string') {
                userStructCode += '    ' + propType + ' ' + propName + ';\n';
            }
            else if (propType instanceof types_1.ArrayType) {
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
        var parentFunc = types_1.findParentFunction(scopeNode);
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
    SymbolsHelper.prototype.addTemp = function (scopeNode, proposedName) {
        var parentFunc = types_1.findParentFunction(scopeNode);
        var scopeId = parentFunc && parentFunc.pos + 1 || 'main';
        var existingSymbolNames = scopeNode == null ? [] : this.typeChecker.getSymbolsInScope(scopeNode, ts.SymbolFlags.Variable).map(function (s) { return s.name; });
        if (!this.temporaryVariables[scopeId])
            this.temporaryVariables[scopeId] = [];
        existingSymbolNames = existingSymbolNames.concat(this.temporaryVariables[scopeId]);
        if (existingSymbolNames.indexOf(proposedName) > -1) {
            var i = 2;
            while (existingSymbolNames.indexOf(proposedName + "_" + i) > -1)
                i++;
            proposedName = proposedName + "_" + i;
        }
        this.temporaryVariables[scopeId].push(proposedName);
        return proposedName;
    };
    return SymbolsHelper;
}());
exports.SymbolsHelper = SymbolsHelper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./types":41}],40:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
;
var nodeKindTemplates = {};
var CodeTemplateFactory = /** @class */ (function () {
    function CodeTemplateFactory() {
    }
    CodeTemplateFactory.createForNode = function (scope, node) {
        return nodeKindTemplates[node.kind] && new nodeKindTemplates[node.kind](scope, node)
            || "/* Unsupported node: " + node.getText().replace(/[\n\s]+/g, ' ') + " */;\n";
    };
    return CodeTemplateFactory;
}());
exports.CodeTemplateFactory = CodeTemplateFactory;
function CodeTemplate(tempString, nodeKind) {
    return function (target) {
        var newConstructor = function (scope) {
            var rest = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                rest[_i - 1] = arguments[_i];
            }
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

},{}],41:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var standard_1 = require("./standard");
exports.UniversalVarType = "struct js_var *";
exports.VoidType = "void";
exports.PointerVarType = "void *";
exports.StringVarType = "const char *";
exports.NumberVarType = "int16_t";
exports.BooleanVarType = "uint8_t";
exports.RegexVarType = "struct regex_struct_t";
exports.RegexMatchVarType = "struct regex_match_struct_t";
var getTypeBodyText = function (t) { return typeof t === "string" ? t : t.getBodyText(); };
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
        elementTypeText = elementTypeText.replace(/^struct ([a-z0-9_]+)_t \*$/, function (all, g1) { return g1; });
        //elementTypeText = elementTypeText.replace(/^struct array_(.*)_t \*$/, (all, g1) => "array_" + g1);
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
        return 'struct ' + this.structName + ' *';
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
        var elementType = this.elementType;
        var elementTypeText;
        if (typeof elementType === 'string')
            elementTypeText = elementType;
        else
            elementTypeText = elementType.getText();
        return "DICT(" + elementTypeText + ")";
    };
    DictType.prototype.getBodyText = function () {
        return "{" + getTypeBodyText(this.elementType) + "}";
    };
    return DictType;
}());
exports.DictType = DictType;
function findParentFunction(node) {
    var parentFunc = node;
    while (parentFunc && parentFunc.kind != ts.SyntaxKind.FunctionDeclaration) {
        parentFunc = parentFunc.parent;
    }
    return parentFunc;
}
exports.findParentFunction = findParentFunction;
function getDeclaration(typechecker, n) {
    var s = typechecker.getSymbolAtLocation(n);
    return s && s.valueDeclaration;
}
exports.getDeclaration = getDeclaration;
function isNode(n) {
    return n && n.kind !== undefined && n.flags !== undefined && n.pos !== undefined && n.end !== undefined;
}
exports.isNode = isNode;
function isEqualsExpression(n) {
    return n && n.kind == ts.SyntaxKind.BinaryExpression && n.operatorToken.kind == ts.SyntaxKind.EqualsToken;
}
exports.isEqualsExpression = isEqualsExpression;
function isMethodCall(n) {
    return ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression);
}
exports.isMethodCall = isMethodCall;
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
var TypeHelper = /** @class */ (function () {
    function TypeHelper(typeChecker) {
        this.typeChecker = typeChecker;
        this.arrayLiteralsTypes = {};
        this.objectLiteralsTypes = {};
        this.typeOfNodeDict = {};
        this.typesDict = {};
    }
    /** Get C type of TypeScript node */
    TypeHelper.prototype.getCType = function (node) {
        if (!node || !node.kind)
            return null;
        var found = this.typeOfNodeDict[node.pos + "_" + node.end];
        if (found)
            return found.type;
        switch (node.kind) {
            case ts.SyntaxKind.NumericLiteral:
                return exports.NumberVarType;
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
                return exports.BooleanVarType;
            case ts.SyntaxKind.StringLiteral:
                return exports.StringVarType;
            case ts.SyntaxKind.RegularExpressionLiteral:
                return exports.RegexVarType;
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
        var tsType = this.typeChecker.getTypeAtLocation(node);
        var type = tsType && this.convertType(tsType);
        if (type != exports.UniversalVarType && type != exports.PointerVarType)
            return type;
        return null;
    };
    /** Get textual representation of type of the parameter for inserting into the C code */
    TypeHelper.prototype.getTypeString = function (source) {
        var cType = source;
        if (source.flags != null && source.intrinsicName != null) // ts.Type
            cType = this.convertType(source);
        else if (source.flags != null && source.callSignatures != null && source.constructSignatures != null) // ts.Type
            cType = this.convertType(source);
        else if (source.kind != null && source.flags != null) // ts.Node
            cType = this.getCType(source);
        if (cType instanceof ArrayType) {
            return cType.getText();
        }
        else if (cType instanceof StructType)
            return cType.getText();
        else if (cType instanceof DictType)
            return cType.getText();
        else if (typeof cType === 'string')
            return cType;
        else
            throw new Error("Cannot determine variable type from source " + (source && source.getText ? source.getText() : JSON.stringify(source)));
    };
    /** Postprocess TypeScript AST for better type inference */
    /** Creates typeOfNodeDict that is later used in getCType */
    TypeHelper.prototype.inferTypes = function (allNodes) {
        var _this = this;
        var type = function (t) { return ({ getType: typeof (t) === "string" ? function (_) { return t; } : t }); };
        var struct = function (prop, pos, elemType) {
            if (elemType === void 0) { elemType = exports.PointerVarType; }
            return new StructType((_a = {}, _a[prop] = { type: elemType, order: pos }, _a));
            var _a;
        };
        var typeEqualities = [];
        var addEquality = function (typeGuard, node1, node2) {
            if (typeof node2 == "function")
                typeEqualities.push([typeGuard, node1, { getNode: node2 }]);
            else
                typeEqualities.push([typeGuard, node1, node2]);
        };
        addEquality(ts.isIdentifier, function (n) { return n; }, function (n) { return getDeclaration(_this.typeChecker, n); });
        addEquality(isEqualsExpression, function (n) { return n.left; }, function (n) { return n.right; });
        addEquality(ts.isConditionalExpression, function (n) { return n.whenTrue; }, function (n) { return n.whenFalse; });
        addEquality(ts.isConditionalExpression, function (n) { return n; }, function (n) { return n.whenTrue; });
        addEquality(ts.isVariableDeclaration, function (n) { return n; }, function (n) { return n.initializer; });
        addEquality(ts.isPropertyAssignment, function (n) { return n; }, function (n) { return n.initializer; });
        addEquality(ts.isPropertyAssignment, function (n) { return n.parent; }, type(function (n) { return struct(n.name.getText(), n.pos, _this.getCType(n) || exports.PointerVarType); }));
        addEquality(ts.isPropertyAssignment, function (n) { return n; }, type(function (n) {
            var type = _this.getCType(n.parent);
            return type instanceof StructType ? type.properties[n.name.getText()] : null;
        }));
        addEquality(isFieldPropertyAccess, function (n) { return n.expression; }, type(function (n) { return struct(n.name.getText(), n.pos, _this.getCType(n) || exports.PointerVarType); }));
        addEquality(isFieldPropertyAccess, function (n) { return n; }, type(function (n) {
            var type = _this.getCType(n.expression);
            return type instanceof StructType ? type.properties[n.name.getText()]
                : type instanceof ArrayType && n.name.getText() == "length" ? exports.NumberVarType
                    : type == exports.StringVarType && n.name.getText() == "length" ? exports.NumberVarType
                        : null;
        }));
        addEquality(isFieldElementAccess, function (n) { return n.expression; }, type(function (n) {
            var type = _this.getCType(n.argumentExpression);
            var elementType = _this.getCType(n) || exports.PointerVarType;
            return ts.isStringLiteral(n.argumentExpression) ? struct(n.argumentExpression.getText().slice(1, -1), n.pos, elementType)
                : ts.isNumericLiteral(n.argumentExpression) ? new ArrayType(elementType, 0, false)
                    : type == exports.NumberVarType ? new ArrayType(elementType, 0, false)
                        : type == exports.StringVarType ? new DictType(elementType)
                            : null;
        }));
        addEquality(isFieldElementAccess, function (n) { return n; }, type(function (n) {
            var type = _this.getCType(n.expression);
            return ts.isStringLiteral(n.argumentExpression) && type instanceof StructType ? type.properties[n.argumentExpression.getText().slice(1, -1)]
                : ts.isStringLiteral(n.argumentExpression) && type instanceof ArrayType && n.argumentExpression.getText().slice(1, -1) == "length" ? exports.NumberVarType
                    : ts.isStringLiteral(n.argumentExpression) && type == exports.StringVarType && n.argumentExpression.getText().slice(1, -1) == "length" ? exports.NumberVarType
                        : type instanceof ArrayType || type instanceof DictType ? type.elementType
                            : null;
        }));
        addEquality(ts.isCallExpression, function (n) { return n; }, function (n) { return getDeclaration(_this.typeChecker, n.expression); });
        var _loop_1 = function (i) {
            addEquality(ts.isCallExpression, function (n) { return n.arguments[i]; }, function (n) {
                var func = getDeclaration(_this.typeChecker, n.expression);
                return func ? func.parameters[i] : null;
            });
        };
        for (var i = 0; i < 10; i++) {
            _loop_1(i);
        }
        addEquality(ts.isParameter, function (n) { return n; }, function (n) { return n.name; });
        addEquality(ts.isParameter, function (n) { return n; }, function (n) { return n.initializer; });
        addEquality(isMethodCall, function (n) { return n.expression.expression; }, type(function (n) { return standard_1.StandardCallHelper.getObjectType(_this, n); }));
        var _loop_2 = function (i) {
            addEquality(isMethodCall, function (n) { return n.arguments[i]; }, type(function (n) { return isLiteral(n.arguments[i]) ? null : standard_1.StandardCallHelper.getArgumentTypes(_this, n)[i]; }));
        };
        for (var i = 0; i < 10; i++) {
            _loop_2(i);
        }
        addEquality(ts.isFunctionDeclaration, function (n) { return n; }, type(exports.VoidType));
        addEquality(isForOfWithSimpleInitializer, function (n) { return n.expression; }, type(function (n) { return new ArrayType(_this.getCType(n.initializer.declarations[0]) || exports.PointerVarType, 0, false); }));
        addEquality(isForOfWithSimpleInitializer, function (n) { return n.initializer.declarations[0]; }, type(function (n) {
            var type = _this.getCType(n.expression);
            return type instanceof ArrayType ? type.elementType : null;
        }));
        addEquality(isForOfWithIdentifierInitializer, function (n) { return n.expression; }, type(function (n) { return new ArrayType(_this.getCType(n.initializer) || exports.PointerVarType, 0, false); }));
        addEquality(isForOfWithIdentifierInitializer, function (n) { return n.initializer; }, type(function (n) {
            var type = _this.getCType(n.expression);
            return type instanceof ArrayType ? type.elementType : null;
        }));
        addEquality(ts.isForInStatement, function (n) { return n.initializer; }, type(exports.StringVarType));
        addEquality(ts.isReturnStatement, function (n) { return n.expression; }, function (n) { return findParentFunction(n); });
        this.resolveTypes(allNodes, typeEqualities);
    };
    TypeHelper.prototype.resolveTypes = function (allNodes, typeEqualities) {
        var _this = this;
        allNodes.forEach(function (n) { return _this.setNodeType(n, _this.getCType(n)); });
        var equalities = [];
        typeEqualities.forEach(function (teq) {
            return allNodes.forEach(function (node) { if (teq[0].bind(_this)(node))
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
                var type1 = this.getCType(node1);
                var node2 = node2_resolver.getNode ? node2_resolver.getNode(node) : null;
                var type2 = node2_resolver.getType ? node2_resolver.getType(node) : this.getCType(node2);
                if (!node2 && !type2)
                    continue;
                var _b = this.mergeTypes(type1, type2), type = _b.type, replaced = _b.replaced;
                if (type && replaced) {
                    if (type != type1)
                        changed = true;
                    if (node2 && type != type2)
                        changed = true;
                    this.setNodeType(node1, type);
                    if (node2)
                        this.setNodeType(node2, type);
                }
            }
        } while (changed);
        /*
        allNodes
            .filter(n => !ts.isToken(n) && !ts.isBlock(n) && n.kind != ts.SyntaxKind.SyntaxList)
            .forEach(n => console.log(n.getText(), "|", ts.SyntaxKind[n.kind], "|", JSON.stringify(this.getCType(n))));
        
        allNodes
            .filter(n => ts.isIdentifier(n) && n.getText() == "string1")
            .forEach(n => console.log(
                n.getText(),
                "(" + n.parent.getText() + "/" + ts.SyntaxKind[n.parent.kind] + ")",
                "decl.", getDeclaration(this.typeChecker, n).getText() + "/" + ts.SyntaxKind[getDeclaration(this.typeChecker, n).kind],
                "|", ts.SyntaxKind[n.kind],
                "|", JSON.stringify(this.getCType(n))
            ));
        */
    };
    TypeHelper.prototype.setNodeType = function (n, t) {
        if (n && t)
            this.typeOfNodeDict[n.pos + "_" + n.end] = { node: n, type: t };
    };
    TypeHelper.prototype.ensureNoTypeDuplicates = function (t) {
        if (!t)
            return null;
        var typeBodyText = getTypeBodyText(t);
        var type = this.typesDict[typeBodyText];
        if (type instanceof ArrayType)
            type.capacity = Math.max(type.capacity, t.capacity);
        if (!type)
            type = this.typesDict[typeBodyText] = t;
        return type;
    };
    /** Convert ts.Type to CType */
    TypeHelper.prototype.convertType = function (tsType, ident) {
        if (!tsType || tsType.flags == ts.TypeFlags.Void)
            return exports.VoidType;
        if (tsType.flags == ts.TypeFlags.String || tsType.flags == ts.TypeFlags.StringLiteral)
            return exports.StringVarType;
        if (tsType.flags == ts.TypeFlags.Number || tsType.flags == ts.TypeFlags.NumberLiteral)
            return exports.NumberVarType;
        if (tsType.flags == ts.TypeFlags.Boolean || tsType.flags == (ts.TypeFlags.Boolean + ts.TypeFlags.Union))
            return exports.BooleanVarType;
        if (tsType.flags & ts.TypeFlags.Object && tsType.getProperties().length > 0)
            return this.generateStructure(tsType);
        if (tsType.flags == ts.TypeFlags.Any)
            return exports.PointerVarType;
        if (this.typeChecker.typeToString(tsType) != "{}")
            console.log("WARNING: Non-standard type: " + this.typeChecker.typeToString(tsType));
        return exports.PointerVarType;
    };
    TypeHelper.prototype.generateStructure = function (tsType) {
        var userStructInfo = {};
        for (var _i = 0, _a = tsType.getProperties(); _i < _a.length; _i++) {
            var prop = _a[_i];
            var declaration = prop.valueDeclaration;
            var propTsType = this.typeChecker.getTypeOfSymbolAtLocation(prop, declaration);
            var propType = this.convertType(propTsType, declaration.name);
            if (propType == exports.PointerVarType && ts.isPropertyAssignment(declaration)) {
                if (declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer))
                    propType = this.determineArrayType(declaration.initializer);
            }
            userStructInfo[prop.name] = { type: propType, order: declaration.pos };
        }
        return this.ensureNoTypeDuplicates(new StructType(userStructInfo));
    };
    TypeHelper.prototype.determineArrayType = function (arrLiteral) {
        var elementType = exports.PointerVarType;
        var cap = arrLiteral.elements.length;
        if (cap > 0)
            elementType = this.convertType(this.typeChecker.getTypeAtLocation(arrLiteral.elements[0]));
        var type = new ArrayType(elementType, cap, false);
        this.arrayLiteralsTypes[arrLiteral.pos] = type;
        return type;
    };
    TypeHelper.prototype.mergeTypes = function (type1, type2) {
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
        else if (type1 == exports.VoidType)
            return type2_result;
        else if (type1 == exports.PointerVarType)
            return type2_result;
        else if (type1 == exports.UniversalVarType)
            return type2_result;
        else if (type2 == exports.VoidType)
            return type1_result;
        else if (type2 == exports.PointerVarType)
            return type1_result;
        else if (type2 == exports.UniversalVarType)
            return type1_result;
        else if (type1 == exports.StringVarType && type2 instanceof StructType) {
            if (Object.keys(type2.properties).length == 1 && (type2.properties["length"] == exports.PointerVarType || type2.properties["length"] == exports.NumberVarType))
                return type1_result;
        }
        else if (type1 instanceof StructType && type2 == exports.StringVarType) {
            if (Object.keys(type1.properties).length == 1 && (type1.properties["length"] == exports.PointerVarType || type1.properties["length"] == exports.NumberVarType))
                return type2_result;
        }
        else if (type1 instanceof ArrayType && type2 instanceof ArrayType) {
            var cap = Math.max(type2.capacity, type1.capacity);
            var isDynamicArray = type2.isDynamicArray || type1.isDynamicArray;
            var elementTypeMergeResult = this.mergeTypes(type1.elementType, type2.elementType);
            if (type1.capacity != cap || type2.capacity != cap
                || type1.isDynamicArray != isDynamicArray || type2.isDynamicArray != isDynamicArray
                || elementTypeMergeResult.replaced)
                return { type: this.ensureNoTypeDuplicates(new ArrayType(elementTypeMergeResult.type, cap, isDynamicArray)), replaced: true };
            return noChanges;
        }
        else if (type1 instanceof DictType && type2 instanceof ArrayType) {
            return type1_result;
        }
        else if (type1 instanceof ArrayType && type2 instanceof DictType) {
            return type2_result;
        }
        else if (type1 instanceof StructType && type2 instanceof StructType) {
            var props = Object.keys(type1.properties).concat(Object.keys(type2.properties));
            var changed = false;
            var newProps = {};
            for (var _i = 0, props_1 = props; _i < props_1.length; _i++) {
                var p = props_1[_i];
                var result = this.mergeTypes(type1.properties[p], type2.properties[p]);
                var order = Math.max(type1.propertyDefs[p] ? type1.propertyDefs[p].order : 0, type2.propertyDefs[p] ? type2.propertyDefs[p].order : 0);
                newProps[p] = { type: result.type, order: order };
                if (result.replaced)
                    changed = true;
            }
            return changed ? { type: this.ensureNoTypeDuplicates(new StructType(newProps)), replaced: true } : noChanges;
        }
        else if (type1 instanceof ArrayType && type2 instanceof StructType) {
            return this.mergeArrayAndStruct(type1, type2);
        }
        else if (type1 instanceof StructType && type2 instanceof ArrayType) {
            return this.mergeArrayAndStruct(type2, type1);
        }
        else if (type1 instanceof StructType && type2 instanceof DictType) {
            return type2_result;
        }
        else if (type1 instanceof DictType && type2 instanceof StructType) {
            return type1_result;
        }
        else if (type1 instanceof DictType && type2 instanceof DictType) {
            if (type1.elementType != exports.PointerVarType && type2.elementType == exports.PointerVarType)
                return type1_result;
            if (type2.elementType != exports.PointerVarType && type1.elementType == exports.PointerVarType)
                return type2_result;
            return noChanges;
        }
        throw new Error("Error: Not supported yet. This code requires universal variable types, that aren't yet implemented. " +
            "Variable is assigned incompatible values: " + this.getTypeString(type1) + " and " + this.getTypeString(type2));
    };
    TypeHelper.prototype.mergeArrayAndStruct = function (arrayType, structType) {
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
            return { type: this.ensureNoTypeDuplicates(new DictType(exports.UniversalVarType)), replaced: true };
        else if (needPromoteToDictionary)
            return { type: this.ensureNoTypeDuplicates(new DictType(arrayType.elementType)), replaced: true };
        else if (needPromoteToTuple)
            return { type: this.ensureNoTypeDuplicates(new ArrayType(exports.UniversalVarType, arrayType.capacity, arrayType.isDynamicArray)), replaced: true };
        else
            return { type: arrayType, replaced: true };
    };
    return TypeHelper;
}());
exports.TypeHelper = TypeHelper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./standard":13}],42:[function(require,module,exports){
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
},{"./src/program":11}]},{},[42])(42)
});
