(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
  try {
    cachedSetTimeout = setTimeout;
  } catch (e) {
    cachedSetTimeout = function () {
      throw new Error('setTimeout is not defined');
    }
  }
  try {
    cachedClearTimeout = clearTimeout;
  } catch (e) {
    cachedClearTimeout = function () {
      throw new Error('clearTimeout is not defined');
    }
  }
} ())
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = cachedSetTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    cachedClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        cachedSetTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var types_1 = require("./types");
var resolver_1 = require("./resolver");
var match_1 = require("./standard/string/match");
var MemoryManager = (function () {
    function MemoryManager(typeChecker, typeHelper) {
        this.typeChecker = typeChecker;
        this.typeHelper = typeHelper;
        this.scopes = {};
        this.scopesOfVariables = {};
    }
    MemoryManager.prototype.preprocessVariables = function () {
        for (var k in this.typeHelper.variables) {
            var v = this.typeHelper.variables[k];
            if (v.requiresAllocation)
                this.scheduleNodeDisposal(v.declaration);
        }
    };
    MemoryManager.prototype.preprocessTemporaryVariables = function (node) {
        var _this = this;
        switch (node.kind) {
            case ts.SyntaxKind.ArrayLiteralExpression:
                {
                    if (node.parent.kind == ts.SyntaxKind.VariableDeclaration)
                        break;
                    if (node.parent.kind == ts.SyntaxKind.BinaryExpression && node.parent.parent.kind == ts.SyntaxKind.ExpressionStatement) {
                        var binExpr = node.parent;
                        if (binExpr.left.kind == ts.SyntaxKind.Identifier)
                            break;
                    }
                    var type = this.typeHelper.getCType(node);
                    if (type && type instanceof types_1.ArrayType && type.isDynamicArray)
                        this.scheduleNodeDisposal(node);
                }
                break;
            case ts.SyntaxKind.ObjectLiteralExpression:
                {
                    if (node.parent.kind == ts.SyntaxKind.VariableDeclaration)
                        break;
                    if (node.parent.kind == ts.SyntaxKind.BinaryExpression && node.parent.parent.kind == ts.SyntaxKind.ExpressionStatement) {
                        var binExpr = node.parent;
                        if (binExpr.left.kind == ts.SyntaxKind.Identifier)
                            break;
                    }
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
                            this.scheduleNodeDisposal(binExpr);
                        if (binExpr.left.kind == ts.SyntaxKind.BinaryExpression)
                            this.preprocessTemporaryVariables(binExpr.left);
                        if (binExpr.right.kind == ts.SyntaxKind.BinaryExpression)
                            this.preprocessTemporaryVariables(binExpr.right);
                        return;
                    }
                }
                break;
            case ts.SyntaxKind.CallExpression:
                {
                    if (resolver_1.StandardCallHelper.needsDisposal(this.typeHelper, node))
                        this.scheduleNodeDisposal(node);
                }
                break;
        }
        node.getChildren().forEach(function (c) { return _this.preprocessTemporaryVariables(c); });
    };
    MemoryManager.prototype.getGCVariablesForScope = function (node) {
        var parentDecl = this.findParentFunctionNode(node);
        var scopeId = parentDecl && parentDecl.pos + 1 + "" || "main";
        var realScopeId = this.scopes[scopeId] && this.scopes[scopeId].length && this.scopes[scopeId][0].scopeId;
        var gcVars = [];
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(function (v) { return !v.simple && !v.array && !v.dict; }).length) {
            gcVars.push("gc_" + realScopeId);
        }
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(function (v) { return !v.simple && v.array; }).length) {
            gcVars.push("gc_" + realScopeId + "_arrays");
        }
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(function (v) { return !v.simple && v.dict; }).length) {
            gcVars.push("gc_" + realScopeId + "_dicts");
        }
        return gcVars;
    };
    MemoryManager.prototype.getGCVariableForNode = function (node) {
        var parentDecl = this.findParentFunctionNode(node);
        var key = node.pos + "_" + node.end;
        if (this.scopesOfVariables[key] && !this.scopesOfVariables[key].simple) {
            if (this.scopesOfVariables[key].array)
                return "gc_" + this.scopesOfVariables[key].scopeId + "_arrays";
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
            for (var _i = 0, _a = this.scopes[scopeId].filter(function (v) { return v.simple; }); _i < _a.length; _i++) {
                var simpleVarScopeInfo = _a[_i];
                destructors.push({ node: simpleVarScopeInfo.node, varName: simpleVarScopeInfo.varName });
            }
        }
        return destructors;
    };
    MemoryManager.prototype.getReservedTemporaryVarName = function (node) {
        if (this.scopesOfVariables[node.pos + "_" + node.end])
            return this.scopesOfVariables[node.pos + "_" + node.end].varName;
        else
            return null;
    };
    MemoryManager.prototype.scheduleNodeDisposal = function (heapNode) {
        var varFuncNode = this.findParentFunctionNode(heapNode);
        var topScope = varFuncNode && varFuncNode.pos + 1 || "main";
        var isSimple = true;
        if (this.isInsideLoop(heapNode))
            isSimple = false;
        if (heapNode.kind == ts.SyntaxKind.CallExpression && new match_1.StringMatchResolver().matchesNode(this.typeHelper, heapNode))
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
                var varIdent = node;
                var nodeVarInfo = this.typeHelper.getVariableInfo(varIdent);
                if (!nodeVarInfo) {
                    console.log("WARNING: Cannot find references for " + node.getText());
                    continue;
                }
                refs = this.typeHelper.getVariableInfo(varIdent).references;
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
                            var isStandardCall = resolver_1.StandardCallHelper.isStandardCall(this.typeHelper, call) || call.expression.getText() == "console.log";
                            if (isStandardCall) {
                                var standardCallEscapeNode = resolver_1.StandardCallHelper.getEscapeNode(this.typeHelper, call);
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
        if (heapNode.kind == ts.SyntaxKind.ArrayLiteralExpression)
            varName = this.typeHelper.addNewTemporaryVariable(heapNode, "tmp_array");
        else if (heapNode.kind == ts.SyntaxKind.ObjectLiteralExpression)
            varName = this.typeHelper.addNewTemporaryVariable(heapNode, "tmp_obj");
        else if (heapNode.kind == ts.SyntaxKind.BinaryExpression)
            varName = this.typeHelper.addNewTemporaryVariable(heapNode, "tmp_string");
        else if (heapNode.kind == ts.SyntaxKind.CallExpression)
            varName = this.typeHelper.addNewTemporaryVariable(heapNode, resolver_1.StandardCallHelper.getTempVarName(this.typeHelper, heapNode));
        else
            varName = heapNode.getText().replace(/\./g, "->");
        var foundScopes = topScope == "main" ? [topScope] : Object.keys(scopeTree);
        var scopeInfo = {
            node: heapNode,
            simple: isSimple,
            array: type && type instanceof types_1.ArrayType && type.isDynamicArray,
            dict: type && type instanceof types_1.DictType,
            varName: varName,
            scopeId: foundScopes.join("_")
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
    MemoryManager.prototype.getSymbolId = function (node) {
        return this.typeChecker.getSymbolAtLocation(node)["id"];
    };
    return MemoryManager;
}());
exports.MemoryManager = MemoryManager;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./resolver":15,"./standard/string/match":34,"./types":40}],4:[function(require,module,exports){
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
var match_1 = require("../standard/string/match");
var AssignmentHelper = (function () {
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
var CAssignment = CAssignment_1 = (function () {
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
        this.isRegexMatch = false;
        this.CR = inline ? "" : ";\n";
        this.isSimpleVar = typeof type === 'string';
        this.isDynamicArray = type instanceof types_1.ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof types_1.ArrayType && !type.isDynamicArray;
        this.isDict = type instanceof types_1.DictType;
        this.isStruct = type instanceof types_1.StructType;
        if (right.kind == ts.SyntaxKind.CallExpression)
            this.isRegexMatch = new match_1.StringMatchResolver().matchesNode(scope.root.typeHelper, right);
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
    }
    return CAssignment;
}());
CAssignment = CAssignment_1 = __decorate([
    template_1.CodeTemplate("\n{#if isObjLiteralAssignment}\n    {objInitializers}\n{#elseif isArrayLiteralAssignment}\n    {arrInitializers}\n{#elseif isDynamicArray && argumentExpression == null}\n    {accessor} = ((void *){expression}){CR}\n{#elseif isRegexMatch}\n    /* regex match assignment removed */\n{#elseif argumentExpression == null}\n    {accessor} = {expression}{CR}\n{#elseif isStruct}\n    {accessor}->{argumentExpression} = {expression}{CR}\n{#elseif isDict}\n    DICT_SET({accessor}, {argumentExpression}, {expression}){CR}\n{#elseif isDynamicArray}\n    {accessor}->data[{argumentExpression}] = {expression}{CR}\n{#elseif isStaticArray}\n    {accessor}[{argumentExpression}] = {expression}{CR}\n{#else}\n    /* Unsupported assignment {accessor}[{argumentExpression}] = {nodeText} */{CR}\n{/if}")
], CAssignment);
exports.CAssignment = CAssignment;
var CAssignment_1;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../standard/string/match":34,"../template":39,"../types":40,"./elementaccess":6}],5:[function(require,module,exports){
(function (global){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var resolver_1 = require("../resolver");
var log_1 = require("../standard/console/log");
var template_1 = require("../template");
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var CCallExpression = (function () {
    function CCallExpression(scope, call) {
        this.printfCalls = [];
        this.printfCall = null;
        this.funcName = call.expression.getText();
        this.standardCall = resolver_1.StandardCallHelper.createTemplate(scope, call);
        if (this.standardCall)
            return;
        if (this.funcName != "console.log") {
            this.arguments = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        }
        if (call.expression.kind == ts.SyntaxKind.Identifier && this.funcName == "parseInt") {
            scope.root.headerFlags.int16_t = true;
            scope.root.headerFlags.parseInt = true;
        }
        if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
            var propAccess = call.expression;
            if (this.funcName == "console.log" && call.arguments.length) {
                for (var i = 0; i < call.arguments.length - 1; i++)
                    this.printfCalls.push(log_1.ConsoleLogHelper.create(scope, call.arguments[i], i == call.arguments.length - 1));
                this.printfCall = log_1.ConsoleLogHelper.create(scope, call.arguments[call.arguments.length - 1], true);
                scope.root.headerFlags.printf = true;
            }
        }
    }
    return CCallExpression;
}());
CCallExpression = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if printfCalls.length}\n        {printfCalls => {this}\n}\n    {/if}\n{/statements}\n{#if standardCall}\n    {standardCall}\n{#elseif printfCall}\n    {printfCall}\n{#else}\n    {funcName}({arguments {, }=> {this}})\n{/if}", ts.SyntaxKind.CallExpression)
], CCallExpression);
exports.CCallExpression = CCallExpression;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../resolver":15,"../standard/console/log":28,"../template":39}],6:[function(require,module,exports){
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
var CElementAccess = CElementAccess_1 = (function () {
    function CElementAccess(scope, node) {
        var type = null;
        var elementAccess = null;
        var argumentExpression = null;
        if (node.kind == ts.SyntaxKind.Identifier) {
            type = scope.root.typeHelper.getCType(node);
            elementAccess = node.getText();
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
    return CElementAccess;
}());
CElementAccess = CElementAccess_1 = __decorate([
    template_1.CodeTemplate("{simpleAccessor}", [ts.SyntaxKind.ElementAccessExpression, ts.SyntaxKind.PropertyAccessExpression, ts.SyntaxKind.Identifier])
], CElementAccess);
exports.CElementAccess = CElementAccess;
var CSimpleElementAccess = (function () {
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
    return CSimpleElementAccess;
}());
CSimpleElementAccess = __decorate([
    template_1.CodeTemplate("\n{#if isString && argumentExpression == 'length'}\n    str_len({elementAccess})\n{#elseif isSimpleVar || argumentExpression == null}\n    {elementAccess}\n{#elseif isDynamicArray && argumentExpression == 'length'}\n    {elementAccess}->size\n{#elseif isDynamicArray}\n    {elementAccess}->data[{argumentExpression}]\n{#elseif isStaticArray && argumentExpression == 'length'}\n    {arrayCapacity}\n{#elseif isStaticArray}\n    {elementAccess}[{argumentExpression}]\n{#elseif isStruct}\n    {elementAccess}->{argumentExpression}\n{#elseif isDict}\n    DICT_GET({elementAccess}, {argumentExpression})\n{#else}\n    /* Unsupported element access scenario: {elementAccess} {argumentExpression} */\n{/if}")
], CSimpleElementAccess);
exports.CSimpleElementAccess = CSimpleElementAccess;
var CElementAccess_1;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":39,"../types":40}],7:[function(require,module,exports){
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
var CBinaryExpression = (function () {
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
    return CBinaryExpression;
}());
CBinaryExpression = __decorate([
    template_1.CodeTemplate("{expression}", ts.SyntaxKind.BinaryExpression)
], CBinaryExpression);
var CSimpleBinaryExpression = (function () {
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
            operatorMap[ts.SyntaxKind.PlusToken] = '+';
            operatorMap[ts.SyntaxKind.MinusToken] = '-';
            operatorMap[ts.SyntaxKind.FirstCompoundAssignment] = '+=';
            operatorMap[ts.SyntaxKind.AmpersandToken] = '&';
            operatorMap[ts.SyntaxKind.BarToken] = '|';
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
    return CSimpleBinaryExpression;
}());
CSimpleBinaryExpression = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if replacedWithVar && strPlusStr}\n        {replacementVarName} = malloc(strlen({left}) + strlen({right}) + 1);\n        assert({replacementVarName} != NULL);\n        strcpy({replacementVarName}, {left});\n        strcat({replacementVarName}, {right});\n    {#elseif replacedWithVar && strPlusNumber}\n        {replacementVarName} = malloc(strlen({left}) + STR_INT16_T_BUFLEN + 1);\n        assert({replacementVarName} != NULL);\n        {replacementVarName}[0] = '\\0';\n        strcat({replacementVarName}, {left});\n        str_int16_t_cat({replacementVarName}, {right});\n    {#elseif replacedWithVar && numberPlusStr}\n        {replacementVarName} = malloc(strlen({right}) + STR_INT16_T_BUFLEN + 1);\n        assert({replacementVarName} != NULL);\n        {replacementVarName}[0] = '\\0';\n        str_int16_t_cat({replacementVarName}, {left});\n        strcat({replacementVarName}, {right});\n    {/if}\n    {#if replacedWithVar && gcVarName}\n        ARRAY_PUSH({gcVarName}, {replacementVarName});\n    {/if}\n\n{/statements}\n{#if operator}\n    {left} {operator} {right}\n{#elseif replacedWithCall}\n    {call}({left}, {right}){callCondition}\n{#elseif replacedWithVarAssignment}\n    ({left} = {replacementVarName})\n{#elseif replacedWithVar}\n    {replacementVarName}\n{#else}\n    /* unsupported expression {nodeText} */\n{/if}")
], CSimpleBinaryExpression);
exports.CSimpleBinaryExpression = CSimpleBinaryExpression;
var CUnaryExpression = (function () {
    function CUnaryExpression(scope, node) {
        this.replacedWithCall = false;
        var operatorMap = {};
        var callReplaceMap = {};
        var type = scope.root.typeHelper.getCType(node.operand);
        if (type == types_1.NumberVarType) {
            operatorMap[ts.SyntaxKind.PlusPlusToken] = '++';
            operatorMap[ts.SyntaxKind.MinusMinusToken] = '--';
            operatorMap[ts.SyntaxKind.MinusToken] = '-';
            operatorMap[ts.SyntaxKind.ExclamationToken] = '!';
            operatorMap[ts.SyntaxKind.PlusToken] = '+';
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
    return CUnaryExpression;
}());
CUnaryExpression = __decorate([
    template_1.CodeTemplate("\n{#if isPostfix && operator}\n    {operand}{operator}\n{#elseif !isPostfix && operator}\n    {operator}{operand}\n{#elseif replacedWithCall}\n    {call}({operand}){callCondition}\n{#else}\n    /* unsupported expression {nodeText} */\n{/if}", [ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression])
], CUnaryExpression);
var CTernaryExpression = (function () {
    function CTernaryExpression(scope, node) {
        this.condition = template_1.CodeTemplateFactory.createForNode(scope, node.condition);
        this.whenTrue = template_1.CodeTemplateFactory.createForNode(scope, node.whenTrue);
        this.whenFalse = template_1.CodeTemplateFactory.createForNode(scope, node.whenFalse);
    }
    return CTernaryExpression;
}());
CTernaryExpression = __decorate([
    template_1.CodeTemplate("{condition} ? {whenTrue} : {whenFalse}", ts.SyntaxKind.ConditionalExpression)
], CTernaryExpression);
var CGroupingExpression = (function () {
    function CGroupingExpression(scope, node) {
        this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
    }
    return CGroupingExpression;
}());
CGroupingExpression = __decorate([
    template_1.CodeTemplate("({expression})", ts.SyntaxKind.ParenthesizedExpression)
], CGroupingExpression);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":39,"../types":40,"./assignment":4,"./regexfunc":10,"./variable":12}],8:[function(require,module,exports){
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
var CFunctionPrototype = (function () {
    function CFunctionPrototype(scope, node) {
        this.parameters = [];
        this.returnType = scope.root.typeHelper.getTypeString(node);
        this.name = node.name.getText();
        this.parameters = node.parameters.map(function (p) { return new variable_1.CVariable(scope, p.name.getText(), p.name, { removeStorageSpecifier: true }); });
    }
    return CFunctionPrototype;
}());
CFunctionPrototype = __decorate([
    template_1.CodeTemplate("{returnType} {name}({parameters {, }=> {this}});")
], CFunctionPrototype);
exports.CFunctionPrototype = CFunctionPrototype;
var CFunction = (function () {
    function CFunction(root, funcDecl) {
        var _this = this;
        this.root = root;
        this.func = this;
        this.parameters = [];
        this.variables = [];
        this.statements = [];
        this.parent = root;
        this.returnType = root.typeHelper.getTypeString(funcDecl);
        this.name = funcDecl.name.getText();
        this.parameters = funcDecl.parameters.map(function (p) { return new variable_1.CVariable(_this, p.name.getText(), p.name, { removeStorageSpecifier: true }); });
        this.variables = [];
        this.gcVarNames = root.memoryManager.getGCVariablesForScope(funcDecl);
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
        funcDecl.body.statements.forEach(function (s) { return _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, s)); });
        if (funcDecl.body.statements[funcDecl.body.statements.length - 1].kind != ts.SyntaxKind.ReturnStatement) {
            this.destructors = new variable_1.CVariableDestructors(this, funcDecl);
        }
    }
    return CFunction;
}());
CFunction = __decorate([
    template_1.CodeTemplate("\n{returnType} {name}({parameters {, }=> {this}})\n{\n    {variables  {    }=> {this};\n}\n    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}\n\n    {statements {    }=> {this}}\n\n    {destructors}\n}", ts.SyntaxKind.FunctionDeclaration)
], CFunction);
exports.CFunction = CFunction;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":39,"./variable":12}],9:[function(require,module,exports){
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
var CArrayLiteralExpression = (function () {
    function CArrayLiteralExpression(scope, node) {
        var arrSize = node.elements.length;
        var type = scope.root.typeHelper.getCType(node);
        if (type instanceof types_1.ArrayType) {
            var varName = void 0;
            var canUseInitializerList = node.elements.every(function (e) { return e.kind == ts.SyntaxKind.NumericLiteral || e.kind == ts.SyntaxKind.StringLiteral; });
            if (!type.isDynamicArray && canUseInitializerList) {
                varName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_array");
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
                    varName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_array");
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
    return CArrayLiteralExpression;
}());
CArrayLiteralExpression = __decorate([
    template_1.CodeTemplate("{expression}", ts.SyntaxKind.ArrayLiteralExpression)
], CArrayLiteralExpression);
var CObjectLiteralExpression = (function () {
    function CObjectLiteralExpression(scope, node) {
        var _this = this;
        this.expression = '';
        var type = scope.root.typeHelper.getCType(node);
        this.isStruct = type instanceof types_1.StructType;
        this.isDict = type instanceof types_1.DictType;
        if (this.isStruct || this.isDict) {
            var varName_1 = scope.root.memoryManager.getReservedTemporaryVarName(node);
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
    return CObjectLiteralExpression;
}());
CObjectLiteralExpression = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if isStruct || isDict}\n        {allocator}\n        {initializers}\n    {/if}\n{/statements}\n{expression}", ts.SyntaxKind.ObjectLiteralExpression)
], CObjectLiteralExpression);
var regexNames = {};
var CRegexLiteralExpression = (function () {
    function CRegexLiteralExpression(scope, node) {
        this.expression = '';
        var template = node.text;
        if (!regexNames[template]) {
            regexNames[template] = scope.root.typeHelper.addNewTemporaryVariable(null, "regex");
            scope.root.functions.splice(scope.parent ? -2 : -1, 0, new regexfunc_1.CRegexSearchFunction(scope, template, regexNames[template]));
        }
        this.expression = regexNames[template];
        scope.root.headerFlags.regex = true;
    }
    return CRegexLiteralExpression;
}());
CRegexLiteralExpression = __decorate([
    template_1.CodeTemplate("{expression}", ts.SyntaxKind.RegularExpressionLiteral)
], CRegexLiteralExpression);
var CString = (function () {
    function CString(scope, value) {
        var s = typeof value === 'string' ? '"' + value + '"' : value.getText();
        s = s.replace(/\\u([A-Fa-f0-9]{4})/g, function (match, g1) { return String.fromCharCode(parseInt(g1, 16)); });
        if (s.indexOf("'") == 0)
            this.value = '"' + s.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            this.value = s;
    }
    return CString;
}());
CString = __decorate([
    template_1.CodeTemplate("{value}", ts.SyntaxKind.StringLiteral)
], CString);
exports.CString = CString;
var CNumber = (function () {
    function CNumber(scope, value) {
        this.value = value.getText();
    }
    return CNumber;
}());
CNumber = __decorate([
    template_1.CodeTemplate("{value}", ts.SyntaxKind.NumericLiteral)
], CNumber);
exports.CNumber = CNumber;
var CBoolean = (function () {
    function CBoolean(scope, value) {
        this.value = value.kind == ts.SyntaxKind.TrueKeyword ? "TRUE" : "FALSE";
        scope.root.headerFlags.bool = true;
    }
    return CBoolean;
}());
CBoolean = __decorate([
    template_1.CodeTemplate("{value}", [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword])
], CBoolean);
exports.CBoolean = CBoolean;
var CNull = (function () {
    function CNull(scope, value) {
    }
    return CNull;
}());
CNull = __decorate([
    template_1.CodeTemplate("NULL", ts.SyntaxKind.NullKeyword)
], CNull);
exports.CNull = CNull;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":39,"../types":40,"./assignment":4,"./regexfunc":10,"./variable":12}],10:[function(require,module,exports){
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
var CRegexSearchFunction = (function () {
    function CRegexSearchFunction(scope, template, regexName, regexMachine) {
        if (regexMachine === void 0) { regexMachine = null; }
        this.regexName = regexName;
        this.stateBlocks = [];
        this.templateString = new literals_1.CString(scope, template.replace(/\\/g, '\\\\').replace(/"/g, '\\"'));
        regexMachine = regexMachine || regex_1.RegexBuilder.build(template.slice(1, -1));
        this.hasChars = regexMachine.states.filter(function (s) { return s && s.transitions.filter(function (c) { return typeof c.condition == "string" || c.condition.fromChar || c.condition.tokens.length > 0; }); }).length > 0;
        for (var s = 0; s < regexMachine.states.length - 1; s++) {
            if (regexMachine.states[s] == null)
                continue;
            this.stateBlocks.push(new CStateBlock(scope, s + "", regexMachine.states[s]));
        }
        this.finals = regexMachine.states.length > 0 ? regexMachine.states.map(function (s, i) { return s.final ? i : -1; }).filter(function (f) { return f > -1; }).map(function (f) { return f + ""; }) : ["-1"];
        scope.root.headerFlags.strings = true;
    }
    return CRegexSearchFunction;
}());
CRegexSearchFunction = __decorate([
    template_1.CodeTemplate("\nstruct regex_match_struct_t {regexName}_search(const char *str) {\n    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0;\n    struct regex_match_struct_t result;\n{#if hasChars}\n        char ch;\n{/if}\n    for (iterator = 0; iterator < len; iterator++) {\n{#if hasChars}\n            ch = str[iterator];\n{/if}\n\n{stateBlocks}\n\n        if (next == -1) {\n            if ({finals { || }=> state == {this}})\n                break;\n            iterator = index;\n            index++;\n            state = 0;\n        } else {\n            state = next;\n            next = -1;\n        }\n\n        if (iterator == len-1 && index < len-1 && {finals { && }=> state != {this}}) {\n            iterator = index;\n            index++;\n            state = 0;\n        }\n    }\n    if ({finals { && }=> state != {this}})\n        index = -1;\n    result.index = index;\n    result.end = iterator;\n    return result;\n}\nstruct regex_struct_t {regexName} = { {templateString}, {regexName}_search };\n")
], CRegexSearchFunction);
exports.CRegexSearchFunction = CRegexSearchFunction;
var CStateBlock = (function () {
    function CStateBlock(scope, stateNumber, state) {
        this.stateNumber = stateNumber;
        this.conditions = [];
        for (var _i = 0, _a = state.transitions; _i < _a.length; _i++) {
            var tr = _a[_i];
            this.conditions.push(new CharCondition(tr.condition, tr.next, tr.fixedStart, tr.fixedEnd));
        }
    }
    return CStateBlock;
}());
CStateBlock = __decorate([
    template_1.CodeTemplate("\n        if (state == {stateNumber}) {\n{conditions}\n        }\n")
], CStateBlock);
var CharCondition = (function () {
    function CharCondition(condition, next, fixedStart, fixedEnd) {
        this.next = next;
        this.anyCharExcept = false;
        this.anyChar = false;
        this.charClass = false;
        this.fixedConditions = '';
        if (fixedStart)
            this.fixedConditions = " && iterator == 0";
        else if (fixedEnd)
            this.fixedConditions = " && iterator == len - 1";
        if (typeof condition === "string")
            this.ch = condition.replace('\\', '\\\\').replace("'", "\\'");
        else if (condition.fromChar) {
            this.charClass = true;
            this.chFrom = condition.fromChar;
            this.ch = condition.toChar;
        }
        else if (condition.tokens.length) {
            this.anyCharExcept = true;
            this.except = condition.tokens.map(function (ch) { return ch.replace('\\', '\\\\').replace("'", "\\'"); });
        }
        else
            this.anyChar = true;
    }
    return CharCondition;
}());
CharCondition = __decorate([
    template_1.CodeTemplate("\n{#if anyCharExcept}\n                if (next == -1 && {except { && }=> ch != '{this}'}{fixedConditions}) next = {next};\n{#elseif anyChar}\n                if (next == -1{fixedConditions}) next = {next};\n{#elseif charClass}\n                if (ch >= '{chFrom}' && ch <= '{ch}'{fixedConditions}) next = {next};\n{#else}\n                if (ch == '{ch}'{fixedConditions}) next = {next};\n{/if}\n")
], CharCondition);
var CRegexAsString = (function () {
    function CRegexAsString(expression) {
        this.expression = expression;
    }
    return CRegexAsString;
}());
CRegexAsString = __decorate([
    template_1.CodeTemplate("{expression}.str")
], CRegexAsString);
exports.CRegexAsString = CRegexAsString;

},{"../regex":14,"../template":39,"./literals":9}],11:[function(require,module,exports){
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
var CBreakStatement = (function () {
    function CBreakStatement(scope, node) {
    }
    return CBreakStatement;
}());
CBreakStatement = __decorate([
    template_1.CodeTemplate("break;\n", ts.SyntaxKind.BreakStatement)
], CBreakStatement);
exports.CBreakStatement = CBreakStatement;
var CContinueStatement = (function () {
    function CContinueStatement(scope, node) {
    }
    return CContinueStatement;
}());
CContinueStatement = __decorate([
    template_1.CodeTemplate("continue;\n", ts.SyntaxKind.ContinueStatement)
], CContinueStatement);
exports.CContinueStatement = CContinueStatement;
var CEmptyStatement = (function () {
    function CEmptyStatement(scope, node) {
    }
    return CEmptyStatement;
}());
CEmptyStatement = __decorate([
    template_1.CodeTemplate(";\n", ts.SyntaxKind.EmptyStatement)
], CEmptyStatement);
exports.CEmptyStatement = CEmptyStatement;
var CReturnStatement = (function () {
    function CReturnStatement(scope, node) {
        this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        this.destructors = new variable_1.CVariableDestructors(scope, node);
    }
    return CReturnStatement;
}());
CReturnStatement = __decorate([
    template_1.CodeTemplate("\n{destructors}\nreturn {expression};\n", ts.SyntaxKind.ReturnStatement)
], CReturnStatement);
exports.CReturnStatement = CReturnStatement;
var CIfStatement = (function () {
    function CIfStatement(scope, node) {
        this.condition = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        this.thenBlock = new CBlock(scope, node.thenStatement);
        this.hasElseBlock = !!node.elseStatement;
        this.elseBlock = this.hasElseBlock && new CBlock(scope, node.elseStatement);
    }
    return CIfStatement;
}());
CIfStatement = __decorate([
    template_1.CodeTemplate("\nif ({condition})\n{thenBlock}\n{#if hasElseBlock}\n    else\n    {elseBlock}\n{/if}\n", ts.SyntaxKind.IfStatement)
], CIfStatement);
exports.CIfStatement = CIfStatement;
var CWhileStatement = (function () {
    function CWhileStatement(scope, node) {
        this.block = new CBlock(scope, node.statement);
        this.condition = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
    }
    return CWhileStatement;
}());
CWhileStatement = __decorate([
    template_1.CodeTemplate("\nwhile ({condition})\n{block}", ts.SyntaxKind.WhileStatement)
], CWhileStatement);
exports.CWhileStatement = CWhileStatement;
var CDoWhileStatement = (function () {
    function CDoWhileStatement(scope, node) {
        this.block = new CBlock(scope, node.statement);
        this.condition = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
    }
    return CDoWhileStatement;
}());
CDoWhileStatement = __decorate([
    template_1.CodeTemplate("\ndo\n{block}\nwhile ({condition});", ts.SyntaxKind.DoStatement)
], CDoWhileStatement);
exports.CDoWhileStatement = CDoWhileStatement;
var CForStatement = (function () {
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
    return CForStatement;
}());
CForStatement = __decorate([
    template_1.CodeTemplate("\n{#if varDecl}\n    {varDecl}\n{/if}\nfor ({init};{condition};{increment})\n{block}", ts.SyntaxKind.ForStatement)
], CForStatement);
exports.CForStatement = CForStatement;
var CForOfStatement = (function () {
    function CForOfStatement(scope, node) {
        this.variables = [];
        this.statements = [];
        this.cast = "";
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(node);
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
    return CForOfStatement;
}());
CForOfStatement = __decorate([
    template_1.CodeTemplate("\n{#if isDynamicArray}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {arrayAccess}->size; {iteratorVarName}++)\n    {\n        {init} = {cast}{arrayAccess}->data[{iteratorVarName}];\n        {statements {    }=> {this}}\n    }\n{#else}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {arrayCapacity}; {iteratorVarName}++)\n    {\n        {init} = {cast}{arrayAccess}[{iteratorVarName}];\n        {statements {    }=> {this}}\n    }\n{/if}\n", ts.SyntaxKind.ForOfStatement)
], CForOfStatement);
exports.CForOfStatement = CForOfStatement;
var CForInStatement = (function () {
    function CForInStatement(scope, node) {
        this.variables = [];
        this.statements = [];
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(node);
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
    return CForInStatement;
}());
CForInStatement = __decorate([
    template_1.CodeTemplate("\nfor ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->index->size; {iteratorVarName}++)\n{\n    {init} = {varAccess}->index->data[{iteratorVarName}];\n    {statements {    }=> {this}}\n}\n", ts.SyntaxKind.ForInStatement)
], CForInStatement);
exports.CForInStatement = CForInStatement;
var CProperty = (function () {
    function CProperty(varAccess, index, name, init) {
        this.varAccess = varAccess;
        this.index = index;
        this.name = name;
        this.init = init;
    }
    return CProperty;
}());
var CExpressionStatement = (function () {
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
    return CExpressionStatement;
}());
CExpressionStatement = __decorate([
    template_1.CodeTemplate("{expression}{SemicolonCR}", ts.SyntaxKind.ExpressionStatement)
], CExpressionStatement);
exports.CExpressionStatement = CExpressionStatement;
var CBlock = (function () {
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
    return CBlock;
}());
CBlock = __decorate([
    template_1.CodeTemplate("\n{#if statements.length > 1 || variables.length > 0}\n    {\n        {variables {    }=> {this};\n}\n        {statements {    }=> {this}}\n    }\n{/if}\n{#if statements.length == 1 && variables.length == 0}\n        {statements}\n{/if}\n{#if statements.length == 0 && variables.length == 0}\n        /* no statements */;\n{/if}", ts.SyntaxKind.Block)
], CBlock);
exports.CBlock = CBlock;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":39,"../types":40,"./assignment":4,"./elementaccess":6,"./variable":12}],12:[function(require,module,exports){
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
var CVariableStatement = (function () {
    function CVariableStatement(scope, node) {
        this.declarations = node.declarationList.declarations.map(function (d) { return template_1.CodeTemplateFactory.createForNode(scope, d); });
    }
    return CVariableStatement;
}());
CVariableStatement = __decorate([
    template_1.CodeTemplate("{declarations}", ts.SyntaxKind.VariableStatement)
], CVariableStatement);
exports.CVariableStatement = CVariableStatement;
var CVariableDeclarationList = (function () {
    function CVariableDeclarationList(scope, node) {
        this.declarations = node.declarations.map(function (d) { return template_1.CodeTemplateFactory.createForNode(scope, d); });
    }
    return CVariableDeclarationList;
}());
CVariableDeclarationList = __decorate([
    template_1.CodeTemplate("{declarations}", ts.SyntaxKind.VariableDeclarationList)
], CVariableDeclarationList);
exports.CVariableDeclarationList = CVariableDeclarationList;
var CVariableDeclaration = (function () {
    function CVariableDeclaration(scope, varDecl) {
        this.allocator = '';
        this.initializer = '';
        var varInfo = scope.root.typeHelper.getVariableInfo(varDecl.name);
        scope.variables.push(new CVariable(scope, varInfo.name, varInfo.type));
        if (varInfo.requiresAllocation)
            this.allocator = new CVariableAllocation(scope, varInfo.name, varInfo.type, varDecl.name);
        if (varDecl.initializer)
            this.initializer = assignment_1.AssignmentHelper.create(scope, varDecl.name, varDecl.initializer);
    }
    return CVariableDeclaration;
}());
CVariableDeclaration = __decorate([
    template_1.CodeTemplate("\n{allocator}\n{initializer}", ts.SyntaxKind.VariableDeclaration)
], CVariableDeclaration);
exports.CVariableDeclaration = CVariableDeclaration;
var CVariableAllocation = (function () {
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
    return CVariableAllocation;
}());
CVariableAllocation = __decorate([
    template_1.CodeTemplate("\n{#if needAllocateArray}\n    ARRAY_CREATE({varName}, {initialCapacity}, {size});\n{#elseif needAllocateDict}\n    DICT_CREATE({varName}, {initialCapacity});\n{#elseif needAllocateStruct}\n    {varName} = malloc(sizeof(*{varName}));\n    assert({varName} != NULL);\n{/if}\n{#if gcVarName && (needAllocateStruct || needAllocateArray || needAllocateDict)}\n    ARRAY_PUSH({gcVarName}, (void *){varName});\n{/if}\n")
], CVariableAllocation);
exports.CVariableAllocation = CVariableAllocation;
var CVariableDestructors = (function () {
    function CVariableDestructors(scope, node) {
        var _this = this;
        this.gcVarName = null;
        this.gcArraysVarName = null;
        this.gcDictsVarName = null;
        var gcVarNames = scope.root.memoryManager.getGCVariablesForScope(node);
        for (var _i = 0, gcVarNames_1 = gcVarNames; _i < gcVarNames_1.length; _i++) {
            var gc = gcVarNames_1[_i];
            if (gc.indexOf("_arrays") > -1)
                this.gcArraysVarName = gc;
            else if (gc.indexOf("_dicts") > -1)
                this.gcDictsVarName = gc;
            else
                this.gcVarName = gc;
        }
        this.destructors = [];
        scope.root.memoryManager.getDestructorsForScope(node)
            .forEach(function (r) {
            var type = scope.root.typeHelper.getCType(r.node);
            if (type instanceof types_1.ArrayType) {
                _this.destructors.push(r.varName + "->data");
                _this.destructors.push(r.varName);
            }
            else if (type instanceof types_1.DictType) {
                _this.destructors.push(r.varName + "->index->data");
                _this.destructors.push(r.varName + "->index");
                _this.destructors.push(r.varName + "->values->data");
                _this.destructors.push(r.varName + "->values");
                _this.destructors.push(r.varName);
            }
            else if (type == types_1.StringVarType) {
                _this.destructors.push("(char *)" + r.varName);
            }
            else
                _this.destructors.push(r.varName);
        });
    }
    return CVariableDestructors;
}());
CVariableDestructors = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {destructors => free({this});\n}\n    {#if gcArraysVarName}\n        for (gc_i = 0; gc_i < {gcArraysVarName}->size; gc_i++) {\n            free({gcArraysVarName}->data[gc_i]->data);\n            free({gcArraysVarName}->data[gc_i]);\n        }\n        free({gcArraysVarName}->data);\n        free({gcArraysVarName});\n    {/if}\n    {#if gcDictsVarName}\n        for (gc_i = 0; gc_i < {gcDictsVarName}->size; gc_i++) {\n            free({gcDictsVarName}->data[gc_i]->index->data);\n            free({gcDictsVarName}->data[gc_i]->index);\n            free({gcDictsVarName}->data[gc_i]->values->data);\n            free({gcDictsVarName}->data[gc_i]->values);\n            free({gcDictsVarName}->data[gc_i]);\n        }\n        free({gcDictsVarName}->data);\n        free({gcDictsVarName});\n    {/if}\n    {#if gcVarName}\n        for (gc_i = 0; gc_i < {gcVarName}->size; gc_i++)\n            free({gcVarName}->data[gc_i]);\n        free({gcVarName}->data);\n        free({gcVarName});\n    {/if}\n{/statements}")
], CVariableDestructors);
exports.CVariableDestructors = CVariableDestructors;
var CVariable = (function () {
    function CVariable(scope, name, typeSource, options) {
        this.name = name;
        this.typeSource = typeSource;
        var typeString = scope.root.typeHelper.getTypeString(typeSource);
        if (typeString == types_1.NumberVarType)
            scope.root.headerFlags.int16_t = true;
        else if (typeString == types_1.BooleanVarType)
            scope.root.headerFlags.uint8_t = true;
        if (typeString.indexOf('{var}') > -1)
            this.varString = typeString.replace('{var}', name);
        else
            this.varString = typeString + " " + name;
        // root scope, make variables file-scoped by default
        if (scope.parent == null && this.varString.indexOf('static') != 0)
            this.varString = 'static ' + this.varString;
        if (options && options.removeStorageSpecifier)
            this.varString = this.varString.replace(/^static /, '');
        if (options && options.initializer)
            this.varString += " = " + options.initializer;
    }
    CVariable.prototype.resolve = function () {
        return this.varString;
    };
    return CVariable;
}());
exports.CVariable = CVariable;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":39,"../types":40,"./assignment":4}],13:[function(require,module,exports){
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
var memory_1 = require("./memory");
var types_1 = require("./types");
var template_1 = require("./template");
var function_1 = require("./nodes/function");
var variable_1 = require("./nodes/variable");
// these imports are here only because it is necessary to run decorators
require("./nodes/statements");
require("./nodes/expressions");
require("./nodes/call");
require("./nodes/literals");
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
var HeaderFlags = (function () {
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
    }
    return HeaderFlags;
}());
var CProgram = (function () {
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
        this.memoryManager = new memory_1.MemoryManager(this.typeChecker, this.typeHelper);
        var _a = this.typeHelper.figureOutVariablesAndTypes(tsProgram.getSourceFiles()), structs = _a[0], functionPrototypes = _a[1];
        this.userStructs = structs.map(function (s) {
            return {
                name: s.name,
                properties: s.properties.map(function (p) { return new variable_1.CVariable(_this, p.name, p.type, { removeStorageSpecifier: true }); })
            };
        });
        this.functionPrototypes = functionPrototypes.map(function (fp) { return new function_1.CFunctionPrototype(_this, fp); });
        this.memoryManager.preprocessVariables();
        for (var _i = 0, _b = tsProgram.getSourceFiles(); _i < _b.length; _i++) {
            var source = _b[_i];
            this.memoryManager.preprocessTemporaryVariables(source);
        }
        this.gcVarNames = this.memoryManager.getGCVariablesForScope(null);
        for (var _c = 0, _d = this.gcVarNames; _c < _d.length; _c++) {
            var gcVarName = _d[_c];
            var gcType = gcVarName.indexOf("arrays") == -1 ? "ARRAY(void *)" : "ARRAY(ARRAY(void *))";
            this.variables.push(new variable_1.CVariable(this, gcVarName, gcType));
        }
        for (var _e = 0, _f = tsProgram.getSourceFiles(); _e < _f.length; _e++) {
            var source = _f[_e];
            for (var _g = 0, _h = source.statements; _g < _h.length; _g++) {
                var s = _h[_g];
                if (s.kind == ts.SyntaxKind.FunctionDeclaration)
                    this.functions.push(new function_1.CFunction(this, s));
                else
                    this.statements.push(template_1.CodeTemplateFactory.createForNode(this, s));
            }
        }
        this.destructors = new variable_1.CVariableDestructors(this, null);
    }
    return CProgram;
}());
CProgram = __decorate([
    template_1.CodeTemplate("\n{#if headerFlags.strings || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat\n    || headerFlags.str_pos || headerFlags.str_rpos || headerFlags.array_str_cmp\n    || headerFlags.str_substring\n    || headerFlags.array_insert || headerFlags.array_remove || headerFlags.dict}\n    #include <string.h>\n{/if}\n{#if headerFlags.malloc || headerFlags.atoi || headerFlags.array || headerFlags.str_substring \n    || headerFlags.str_slice}\n    #include <stdlib.h>\n{/if}\n{#if headerFlags.malloc || headerFlags.array || headerFlags.str_substring || headerFlags.str_slice}\n    #include <assert.h>\n{/if}\n{#if headerFlags.printf || headerFlags.parseInt}\n    #include <stdio.h>\n{/if}\n{#if headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat}\n    #include <limits.h>\n{/if}\n\n{#if headerFlags.bool}\n    #define TRUE 1\n    #define FALSE 0\n{/if}\n{#if headerFlags.bool || headerFlags.js_var}\n    typedef unsigned char uint8_t;\n{/if}\n{#if headerFlags.int16_t || headerFlags.js_var || headerFlags.array ||\n     headerFlags.str_int16_t_cmp || headerFlags.str_pos || headerFlags.str_len ||\n     headerFlags.str_char_code_at || headerFlags.str_substring || headerFlags.str_slice ||\n     headerFlags.regex }\n    typedef int int16_t;\n{/if}\n{#if headerFlags.regex}\n    struct regex_match_struct_t {\n        int16_t index;\n        int16_t end;\n        struct regex_match_struct_t *matches;\n        int16_t matches_count;\n    };\n    typedef struct regex_match_struct_t regex_func_t(const char*);\n    struct regex_struct_t {\n        const char * str;\n        regex_func_t * func;\n    };\n{/if}\n\n{#if headerFlags.js_var}\n    enum js_var_type {JS_VAR_BOOL, JS_VAR_INT, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_STRUCT, JS_VAR_DICT};\n\tstruct js_var {\n\t    enum js_var_type type;\n\t    uint8_t bool;\n\t    int16_t number;\n\t    const char *string;\n\t    void *obj;\n\t};\n{/if}\n\n{#if headerFlags.gc_iterator || headerFlags.dict}\n    #define ARRAY(T) struct {\\\n        int16_t size;\\\n        int16_t capacity;\\\n        T *data;\\\n    } *\n{/if}\n\n{#if headerFlags.array || headerFlags.dict}\n    #define ARRAY_CREATE(array, init_capacity, init_size) {\\\n        array = malloc(sizeof(*array)); \\\n        array->data = malloc((init_capacity) * sizeof(*array->data)); \\\n        assert(array->data != NULL); \\\n        array->capacity = init_capacity; \\\n        array->size = init_size; \\\n    }\n    #define ARRAY_PUSH(array, item) {\\\n        if (array->size == array->capacity) {  \\\n            array->capacity *= 2;  \\\n            array->data = realloc(array->data, array->capacity * sizeof(*array->data)); \\\n            assert(array->data != NULL); \\\n        }  \\\n        array->data[array->size++] = item; \\\n    }\n{/if}\n{#if headerFlags.array_pop}\n\t#define ARRAY_POP(a) (a->size != 0 ? a->data[--a->size] : 0)\n{/if}\n{#if headerFlags.array_insert || headerFlags.dict}\n    #define ARRAY_INSERT(array, pos, item) {\\\n        ARRAY_PUSH(array, item); \\\n        if (pos < array->size - 1) {\\\n            memmove(&(array->data[(pos) + 1]), &(array->data[pos]), (array->size - (pos) - 1) * sizeof(*array->data)); \\\n            array->data[pos] = item; \\\n        } \\\n    }\n{/if}\n{#if headerFlags.array_remove}\n    #define ARRAY_REMOVE(array, pos, num) {\\\n        memmove(&(array->data[pos]), &(array->data[(pos) + num]), (array->size - (pos) - num) * sizeof(*array->data)); \\\n        array->size -= num; \\\n    }\n{/if}\n\n{#if headerFlags.dict}\n    #define DICT(T) struct { \\\n        ARRAY(const char *) index; \\\n        ARRAY(T) values; \\\n    } *\n    #define DICT_CREATE(dict, init_capacity) { \\\n        dict = malloc(sizeof(*dict)); \\\n        ARRAY_CREATE(dict->index, init_capacity, 0); \\\n        ARRAY_CREATE(dict->values, init_capacity, 0); \\\n    }\n\n    int16_t dict_find_pos(const char ** keys, int16_t keys_size, const char * key) {\n        int16_t low = 0;\n        int16_t high = keys_size - 1;\n\n        if (keys_size == 0 || key == NULL)\n            return -1;\n\n        while (low <= high)\n        {\n            int mid = (low + high) / 2;\n            int res = strcmp(keys[mid], key);\n\n            if (res == 0)\n                return mid;\n            else if (res < 0)\n                low = mid + 1;\n            else\n                high = mid - 1;\n        }\n\n        return -1 - low;\n    }\n\n    int16_t tmp_dict_pos;\n    #define DICT_GET(dict, prop) ((tmp_dict_pos = dict_find_pos(dict->index->data, dict->index->size, prop)) < 0 ? 0 : dict->values->data[tmp_dict_pos])\n    #define DICT_SET(dict, prop, value) { \\\n        tmp_dict_pos = dict_find_pos(dict->index->data, dict->index->size, prop); \\\n        if (tmp_dict_pos < 0) { \\\n            tmp_dict_pos = -tmp_dict_pos - 1; \\\n            ARRAY_INSERT(dict->index, tmp_dict_pos, prop); \\\n            ARRAY_INSERT(dict->values, tmp_dict_pos, value); \\\n        } else \\\n            dict->values->data[tmp_dict_pos] = value; \\\n    }\n\n{/if}\n\n{#if headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat}\n    #define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)\n{/if}\n{#if headerFlags.str_int16_t_cmp}\n    int str_int16_t_cmp(const char * str, int16_t num) {\n        char numstr[STR_INT16_T_BUFLEN];\n        sprintf(numstr, \"%d\", num);\n        return strcmp(str, numstr);\n    }\n{/if}\n{#if headerFlags.str_pos}\n    int16_t str_pos(const char * str, const char *search) {\n        int16_t i;\n        const char * found = strstr(str, search);\n        int16_t pos = 0;\n        if (found == 0)\n            return -1;\n        while (*str && str < found) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        return pos;\n    }\n{/if}\n{#if headerFlags.str_rpos}\n    int16_t str_rpos(const char * str, const char *search) {\n        int16_t i;\n        const char * found = strstr(str, search);\n        int16_t pos = 0;\n        const char * end = str + (strlen(str) - strlen(search));\n        if (found == 0)\n            return -1;\n        found = 0;\n        while (end > str && found == 0)\n            found = strstr(end--, search);\n        while (*str && str < found) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        return pos;\n    }\n{/if}\n{#if headerFlags.str_len || headerFlags.str_substring || headerFlags.str_slice}\n    int16_t str_len(const char * str) {\n        int16_t len = 0;\n        int16_t i = 0;\n        while (*str) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            len += i == 4 ? 2 : 1;\n        }\n        return len;\n    }\n{/if}\n{#if headerFlags.str_char_code_at}\n    int16_t str_char_code_at(const char * str, int16_t pos) {\n        int16_t i, res = 0;\n        while (*str) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            if (pos == 0) {\n                res += (unsigned char)*str++;\n                if (i > 1) {\n                    res <<= 6; res -= 0x3080;\n                    res += (unsigned char)*str++;\n                }\n                return res;\n            }\n            str += i;\n            pos -= i == 4 ? 2 : 1;\n        }\n        return -1;\n    }\n{/if}\n{#if headerFlags.str_substring || headerFlags.str_slice}\n    const char * str_substring(const char * str, int16_t start, int16_t end) {\n        int16_t i, tmp, pos, len = str_len(str), byte_start = -1;\n        char *p, *buf;\n        start = start < 0 ? 0 : (start > len ? len : start);\n        end = end < 0 ? 0 : (end > len ? len : end);\n        if (end < start) {\n            tmp = start;\n            start = end;\n            end = tmp;\n        }\n        i = 0;\n        pos = 0;\n        p = (char *)str;\n        while (*p) {\n            if (start == pos)\n                byte_start = p - str;\n            if (end == pos)\n                break;\n            i = 1;\n            if ((*p & 0xE0) == 0xC0) i=2;\n            else if ((*p & 0xF0) == 0xE0) i=3;\n            else if ((*p & 0xF8) == 0xF0) i=4;\n            p += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        len = byte_start == -1 ? 0 : p - str - byte_start;\n        buf = malloc(len + 1);\n        assert(buf != NULL);\n        memcpy(buf, str + byte_start, len);\n        buf[len] = '\\0';\n        return buf;\n    }\n{/if}\n{#if headerFlags.str_slice}\n    const char * str_slice(const char * str, int16_t start, int16_t end) {\n        int16_t len = str_len(str);\n        start = start < 0 ? len + start : start;\n        end = end < 0 ? len + end : end;\n        if (end - start < 0)\n            end = start;\n        return str_substring(str, start, end);\n    }\n{/if}\n{#if headerFlags.str_int16_t_cat}\n    void str_int16_t_cat(char *str, int16_t num) {\n        char numstr[STR_INT16_T_BUFLEN];\n        sprintf(numstr, \"%d\", num);\n        strcat(str, numstr);\n    }\n{/if}\n\n{#if headerFlags.array_int16_t_cmp}\n    int array_int16_t_cmp(const void* a, const void* b) {\n        return ( *(int*)a - *(int*)b );\n    }\n{/if}\n{#if headerFlags.array_str_cmp}\n    int array_str_cmp(const void* a, const void* b) { \n        return strcmp(*(const char **)a, *(const char **)b);\n    }\n{/if}\n\n{#if headerFlags.parseInt}\n    int16_t parseInt(const char * str) {\n        int r;\n        sscanf(str, \"%d\", &r);\n        return (int16_t) r;\n    }\n{/if}\n\n{#if headerFlags.gc_iterator}\n    int16_t gc_i;\n{/if}\n\n{userStructs => struct {name} {\n    {properties {    }=> {this};\n}};\n}\n\n{variables => {this};\n}\n\n{functionPrototypes => {this}\n}\n\n{functions => {this}\n}\n\nint main(void) {\n    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}\n\n    {statements {    }=> {this}}\n\n    {destructors}\n    return 0;\n}")
], CProgram);
exports.CProgram = CProgram;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./memory":3,"./nodes/call":5,"./nodes/expressions":7,"./nodes/function":8,"./nodes/literals":9,"./nodes/statements":11,"./nodes/variable":12,"./standard/array/concat":16,"./standard/array/indexOf":17,"./standard/array/join":18,"./standard/array/lastIndexOf":19,"./standard/array/pop":20,"./standard/array/push":21,"./standard/array/reverse":22,"./standard/array/shift":23,"./standard/array/slice":24,"./standard/array/sort":25,"./standard/array/splice":26,"./standard/array/unshift":27,"./standard/string/charAt":29,"./standard/string/charCodeAt":30,"./standard/string/concat":31,"./standard/string/indexOf":32,"./standard/string/lastIndexOf":33,"./standard/string/match":34,"./standard/string/search":35,"./standard/string/slice":36,"./standard/string/substring":37,"./standard/string/toString":38,"./template":39,"./types":40}],14:[function(require,module,exports){
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
var RegexParser = (function () {
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
    RegexParser.parse = function (template, group) {
        if (group === void 0) { group = false; }
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
                i += 3, (tok = this.parse(template.slice(i), true)) && tok && tokens.push(tok);
            else if (template[i] == '(')
                i++, (tok = this.parse(template.slice(i), true)) && tok && tokens.push(tok) && (i += tok.template.length);
            else if (template[i] == ')' && group)
                break;
            else if (template.slice(i, i + 2) == '[^')
                i += 2, (_a = this.parseChars(template, i, 'anyCharExcept'), tok = _a[0], i = _a[1], _a) && tok && tokens.push(tok);
            else if (template[i] == '[')
                i++, (_b = this.parseChars(template, i, 'anyOf'), tok = _b[0], i = _b[1], _b) && tok && tokens.push(tok);
            else
                tokens.push(template[i]);
            i++;
        }
        if (rootToken.anyOf)
            rootToken.tokens.push(tokens.length ? { tokens: tokens } : NOTHING);
        else
            rootToken.tokens = tokens;
        rootToken.template = template.slice(0, i);
        return group && rootToken.tokens.length == 0 ? null : rootToken;
        var _a, _b;
    };
    return RegexParser;
}());
var RegexBuilder = (function () {
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
            for (var _i = 0, _a = token.tokens.filter(function (t) { return t != NOTHING && t != FIXED_START && t != FIXED_END; }); _i < _a.length; _i++) {
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
            for (var _b = 0, _c = token.tokens.filter(function (t) { return t != FIXED_START && t != FIXED_END; }); _b < _c.length; _b++) {
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
                        addedTransitions.push({ fromState: anyCharT.fromState, toState: anyCharT.toState, token: charT.token });
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
                states[id].transitions.push({ condition: tr.token, next: closureId, fixedStart: tr.fixedStart, fixedEnd: tr.fixedEnd });
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
                        && charTransitions_2[i].fixedEnd == charTransitions_2[i - 1].fixedEnd) {
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
        var tokenTree = RegexParser.parse(template);
        var _a = this.convert(tokenTree), transitions = _a.transitions, nextFromState = _a.nextFromState;
        var states = this.normalize(transitions, nextFromState);
        return { states: states };
    };
    return RegexBuilder;
}());
exports.RegexBuilder = RegexBuilder;

},{}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var standardCallResolvers = [];
function StandardCallResolver(target) {
    standardCallResolvers.push(new target());
}
exports.StandardCallResolver = StandardCallResolver;
var StandardCallHelper = (function () {
    function StandardCallHelper() {
    }
    StandardCallHelper.isStandardCall = function (typeHelper, node) {
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
    StandardCallHelper.getReturnType = function (typeHelper, node) {
        for (var _i = 0, standardCallResolvers_3 = standardCallResolvers; _i < standardCallResolvers_3.length; _i++) {
            var resolver = standardCallResolvers_3[_i];
            if (resolver.matchesNode(typeHelper, node))
                return resolver.returnType(typeHelper, node);
        }
        return null;
    };
    StandardCallHelper.needsDisposal = function (typeHelper, node) {
        for (var _i = 0, standardCallResolvers_4 = standardCallResolvers; _i < standardCallResolvers_4.length; _i++) {
            var resolver = standardCallResolvers_4[_i];
            if (resolver.matchesNode(typeHelper, node))
                return resolver.needsDisposal(typeHelper, node);
        }
        return false;
    };
    StandardCallHelper.getTempVarName = function (typeHelper, node) {
        for (var _i = 0, standardCallResolvers_5 = standardCallResolvers; _i < standardCallResolvers_5.length; _i++) {
            var resolver = standardCallResolvers_5[_i];
            if (resolver.matchesNode(typeHelper, node))
                return resolver.getTempVarName(typeHelper, node);
        }
        console.log("Internal error: cannot find matching resolver for node '" + node.getText() + "' in StandardCallHelper.getTempVarName");
        return "tmp";
    };
    StandardCallHelper.getEscapeNode = function (typeHelper, node) {
        for (var _i = 0, standardCallResolvers_6 = standardCallResolvers; _i < standardCallResolvers_6.length; _i++) {
            var resolver = standardCallResolvers_6[_i];
            if (resolver.matchesNode(typeHelper, node))
                return resolver.getEscapeNode(typeHelper, node);
        }
        return null;
    };
    return StandardCallHelper;
}());
exports.StandardCallHelper = StandardCallHelper;

},{}],16:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayConcatResolver = (function () {
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
    return ArrayConcatResolver;
}());
ArrayConcatResolver = __decorate([
    resolver_1.StandardCallResolver
], ArrayConcatResolver);
var CArrayConcat = (function () {
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
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, new types_1.ArrayType(type.elementType, 0, true)));
            this.indexVarName = scope.root.typeHelper.addNewIteratorVariable(call);
            scope.variables.push(new variable_1.CVariable(scope, this.indexVarName, types_1.NumberVarType));
            var args = call.arguments.map(function (a) { return ({ node: a, template: template_1.CodeTemplateFactory.createForNode(scope, a) }); });
            var toConcatenate = [{ node: propAccess.expression, template: this.varAccess }].concat(args);
            this.sizes = toConcatenate.map(function (a) { return new CGetSize(scope, a.node, a.template); });
            this.concatValues = toConcatenate.map(function (a) { return new CConcatValue(scope, _this.tempVarName, a.node, a.template, _this.indexVarName); });
        }
        scope.root.headerFlags.array = true;
    }
    return CArrayConcat;
}());
CArrayConcat = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        ARRAY_CREATE({tempVarName}, {sizes{+}=>{this}}, 0);\n        {tempVarName}->size = {tempVarName}->capacity;\n        {indexVarName} = 0;\n        {concatValues}\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
], CArrayConcat);
var CGetSize = (function () {
    function CGetSize(scope, valueNode, value) {
        this.value = value;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isArray = type instanceof types_1.ArrayType;
        this.staticArraySize = type instanceof types_1.ArrayType && type.capacity;
    }
    return CGetSize;
}());
CGetSize = __decorate([
    template_1.CodeTemplate("\n{#if staticArraySize}\n    {staticArraySize}\n{#elseif isArray}\n    {value}->size\n{#else}\n    1\n{/if}")
], CGetSize);
var CConcatValue = (function () {
    function CConcatValue(scope, varAccess, valueNode, value, indexVarName) {
        this.varAccess = varAccess;
        this.value = value;
        this.indexVarName = indexVarName;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isArray = type instanceof types_1.ArrayType;
        this.staticArraySize = type instanceof types_1.ArrayType && !type.isDynamicArray && type.capacity;
        if (this.isArray) {
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(valueNode);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
        }
    }
    return CConcatValue;
}());
CConcatValue = __decorate([
    template_1.CodeTemplate("\n{#if staticArraySize}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++)\n        {varAccess}->data[{indexVarName}++] = {value}[{iteratorVarName}];\n{#elseif isArray}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {value}->size; {iteratorVarName}++)\n        {varAccess}->data[{indexVarName}++] = {value}->data[{iteratorVarName}];\n{#else}\n    {varAccess}->data[{indexVarName}++] = {value};\n{/if}\n")
], CConcatValue);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],17:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var expressions_1 = require("../../nodes/expressions");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayIndexOfResolver = (function () {
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
    return ArrayIndexOfResolver;
}());
ArrayIndexOfResolver = __decorate([
    resolver_1.StandardCallResolver
], ArrayIndexOfResolver);
var CArrayIndexOf = (function () {
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
            this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "arr_pos");
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(propAccess);
            this.staticArraySize = objType.isDynamicArray ? "" : objType.capacity + "";
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.NumberVarType));
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            var arrayElementAccess = new elementaccess_1.CSimpleElementAccess(scope, objType, this.varAccess, this.iteratorVarName);
            this.comparison = new expressions_1.CSimpleBinaryExpression(scope, arrayElementAccess, objType.elementType, args[0], objType.elementType, ts.SyntaxKind.EqualsEqualsToken, call);
            scope.root.headerFlags.array = true;
        }
    }
    return CArrayIndexOf;
}());
CArrayIndexOf = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && staticArraySize}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {#elseif !topExpressionOfStatement}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
], CArrayIndexOf);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/expressions":7,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],18:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var literals_1 = require("../../nodes/literals");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayConcatResolver = (function () {
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
    return ArrayConcatResolver;
}());
ArrayConcatResolver = __decorate([
    resolver_1.StandardCallResolver
], ArrayConcatResolver);
var CArrayJoin = (function () {
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
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, "char *"));
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(call);
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
    return CArrayJoin;
}());
CArrayJoin = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {tempVarName} = malloc({calculatedStringLength});\n        assert({tempVarName} != NULL);\n        {tempVarName}[0] = '\\0';\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n            if ({iteratorVarName} > 0)\n                strcat({tempVarName}, {separator});\n            {catFuncName}({tempVarName}, {arrayElement}[{iteratorVarName}]);\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
], CArrayJoin);
var CArraySize = (function () {
    function CArraySize(scope, varAccess, type) {
        this.varAccess = varAccess;
        this.type = type;
        this.arrayCapacity = type.capacity + "";
    }
    return CArraySize;
}());
CArraySize = __decorate([
    template_1.CodeTemplate("\n{#if type.isDynamicArray}\n    {varAccess}->size\n{#else}\n    {arrayCapacity}\n{/if}")
], CArraySize);
var CArrayElement = (function () {
    function CArrayElement(scope, varAccess, type) {
        this.varAccess = varAccess;
        this.type = type;
    }
    return CArrayElement;
}());
CArrayElement = __decorate([
    template_1.CodeTemplate("\n{#if type.isDynamicArray}\n    {varAccess}->data\n{#else}\n    {varAccess}\n{/if}")
], CArrayElement);
var CCalculateStringSize = (function () {
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
            this.lengthVarName = scope.root.typeHelper.addNewTemporaryVariable(node, "len");
            scope.variables.push(new variable_1.CVariable(scope, this.lengthVarName, types_1.NumberVarType));
        }
    }
    return CCalculateStringSize;
}());
CCalculateStringSize = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if arrayOfStrings}\n        {lengthVarName} = 0;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)\n            {lengthVarName} += strlen({arrayElement}[{iteratorVarName}]);\n    {/if}\n{/statements}\n{#if type.isDynamicArray && arrayOfStrings}\n    {arraySize} == 0 ? 1 : {lengthVarName} + strlen({separator})*({arraySize}-1) + 1\n{#elseif arrayCapacity > 0 && arrayOfStrings}\n    {lengthVarName} + strlen({separator})*({arraySize}-1) + 1\n{#elseif type.isDynamicArray && arrayOfNumbers}\n    {varAccess}->size == 0 ? 1 : STR_INT16_T_BUFLEN*{varAccess}->size + strlen({separator})*({arraySize}-1) + 1\n{#elseif arrayCapacity > 0 && arrayOfNumbers}\n    STR_INT16_T_BUFLEN*{arraySize}+strlen({separator})*({arraySize}-1)+1\n{#else}\n    1\n{/if}")
], CCalculateStringSize);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/literals":9,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],19:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var expressions_1 = require("../../nodes/expressions");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayLastIndexOfResolver = (function () {
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
    return ArrayLastIndexOfResolver;
}());
ArrayLastIndexOfResolver = __decorate([
    resolver_1.StandardCallResolver
], ArrayLastIndexOfResolver);
var CArrayLastIndexOf = (function () {
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
            this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "arr_pos");
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(propAccess);
            this.staticArraySize = objType.isDynamicArray ? "" : objType.capacity + "";
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.NumberVarType));
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            var arrayElementAccess = new elementaccess_1.CSimpleElementAccess(scope, objType, this.varAccess, this.iteratorVarName);
            this.comparison = new expressions_1.CSimpleBinaryExpression(scope, arrayElementAccess, objType.elementType, args[0], objType.elementType, ts.SyntaxKind.EqualsEqualsToken, call);
            scope.root.headerFlags.array = true;
        }
    }
    return CArrayLastIndexOf;
}());
CArrayLastIndexOf = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && staticArraySize}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = {staticArraySize} - 1; {iteratorVarName} >= 0; {iteratorVarName}--) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {#elseif !topExpressionOfStatement}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = {varAccess}->size - 1; {iteratorVarName} >= 0; {iteratorVarName}--) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
], CArrayLastIndexOf);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/expressions":7,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],20:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayPopResolver = (function () {
    function ArrayPopResolver() {
    }
    ArrayPopResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "pop" && objType instanceof types_1.ArrayType && objType.isDynamicArray;
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
    return ArrayPopResolver;
}());
ArrayPopResolver = __decorate([
    resolver_1.StandardCallResolver
], ArrayPopResolver);
var CArrayPop = (function () {
    function CArrayPop(scope, call) {
        this.tempVarName = '';
        this.varAccess = null;
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_pop = true;
    }
    return CArrayPop;
}());
CArrayPop = __decorate([
    template_1.CodeTemplate("ARRAY_POP({varAccess})")
], CArrayPop);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../resolver":15,"../../template":39,"../../types":40}],21:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayPushResolver = (function () {
    function ArrayPushResolver() {
    }
    ArrayPushResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "push" && objType instanceof types_1.ArrayType && objType.isDynamicArray;
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
    return ArrayPushResolver;
}());
ArrayPushResolver = __decorate([
    resolver_1.StandardCallResolver
], ArrayPushResolver);
var CArrayPush = (function () {
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
            this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "arr_size");
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.NumberVarType));
        }
        scope.root.headerFlags.array = true;
    }
    return CArrayPush;
}());
CArrayPush = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {pushValues}\n        {tempVarName} = {varAccess}->size;\n    {/if}\n{/statements}\n{#if topExpressionOfStatement}\n    {pushValues}\n{#else}\n    {tempVarName}\n{/if}")
], CArrayPush);
var CPushValue = (function () {
    function CPushValue(scope, varAccess, value) {
        this.varAccess = varAccess;
        this.value = value;
    }
    return CPushValue;
}());
CPushValue = __decorate([
    template_1.CodeTemplate("ARRAY_PUSH({varAccess}, {value});\n")
], CPushValue);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],22:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArraySortResolver = (function () {
    function ArraySortResolver() {
    }
    ArraySortResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "reverse" && objType instanceof types_1.ArrayType && objType.isDynamicArray;
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
    return ArraySortResolver;
}());
ArraySortResolver = __decorate([
    resolver_1.StandardCallResolver
], ArraySortResolver);
var CArrayReverse = (function () {
    function CArrayReverse(scope, call) {
        this.varAccess = null;
        var propAccess = call.expression;
        var type = scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.iteratorVar1 = scope.root.typeHelper.addNewIteratorVariable(call);
        this.iteratorVar2 = scope.root.typeHelper.addNewIteratorVariable(call);
        this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(call, "temp");
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVar1, types_1.NumberVarType));
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVar2, types_1.NumberVarType));
        scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, type.elementType));
    }
    return CArrayReverse;
}());
CArrayReverse = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {iteratorVar1} = 0;\n    {iteratorVar2} = {varAccess}->size - 1;\n    while ({iteratorVar1} < {iteratorVar2}) {\n        {tempVarName} = {varAccess}->data[{iteratorVar1}];\n        {varAccess}->data[{iteratorVar1}] = {varAccess}->data[{iteratorVar2}];\n        {varAccess}->data[{iteratorVar2}] = {tempVarName};\n        {iteratorVar1}++;\n        {iteratorVar2}--;\n    }\n{/statements}\n{#if !topExpressionOfStatement}\n    {varAccess}\n{/if}")
], CArrayReverse);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],23:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayShiftResolver = (function () {
    function ArrayShiftResolver() {
    }
    ArrayShiftResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "shift" && objType instanceof types_1.ArrayType && objType.isDynamicArray;
    };
    ArrayShiftResolver.prototype.returnType = function (typeHelper, call) {
        return types_1.NumberVarType;
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
    return ArrayShiftResolver;
}());
ArrayShiftResolver = __decorate([
    resolver_1.StandardCallResolver
], ArrayShiftResolver);
var CArrayShift = (function () {
    function CArrayShift(scope, call) {
        this.tempVarName = '';
        this.varAccess = null;
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "value");
        var type = scope.root.typeHelper.getCType(propAccess.expression);
        scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, type.elementType));
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_remove = true;
    }
    return CArrayShift;
}());
CArrayShift = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {tempVarName} = {varAccess}->data[0];\n    ARRAY_REMOVE({varAccess}, 0, 1);\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
], CArrayShift);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],24:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArraySliceResolver = (function () {
    function ArraySliceResolver() {
    }
    ArraySliceResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "slice" && objType instanceof types_1.ArrayType && objType.isDynamicArray;
    };
    ArraySliceResolver.prototype.returnType = function (typeHelper, call) {
        var propAccess = call.expression;
        return typeHelper.getCType(propAccess.expression);
    };
    ArraySliceResolver.prototype.createTemplate = function (scope, node) {
        return new CArraySlice(scope, node);
    };
    ArraySliceResolver.prototype.needsDisposal = function (typeHelper, node) {
        // if parent is expression statement, then this is the top expression
        // and thus return value is not used, so the temporary variable will not be created
        return node.parent.kind != ts.SyntaxKind.ExpressionStatement;
    };
    ArraySliceResolver.prototype.getTempVarName = function (typeHelper, node) {
        return "tmp_slice";
    };
    ArraySliceResolver.prototype.getEscapeNode = function (typeHelper, node) {
        return null;
    };
    return ArraySliceResolver;
}());
ArraySliceResolver = __decorate([
    resolver_1.StandardCallResolver
], ArraySliceResolver);
var CArraySlice = (function () {
    function CArraySlice(scope, call) {
        this.tempVarName = '';
        this.iteratorVarName = '';
        this.sizeVarName = '';
        this.startVarName = '';
        this.endVarName = '';
        var propAccess = call.expression;
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return template_1.CodeTemplateFactory.createForNode(scope, a); });
        this.startIndexArg = args[0];
        this.endIndexArg = args.length == 2 ? args[1] : null;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            var type = scope.root.typeHelper.getCType(propAccess.expression);
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, type));
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(propAccess);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            this.sizeVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "slice_size");
            scope.variables.push(new variable_1.CVariable(scope, this.sizeVarName, types_1.NumberVarType));
            this.startVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "slice_start");
            scope.variables.push(new variable_1.CVariable(scope, this.startVarName, types_1.NumberVarType));
            if (args.length == 2) {
                this.endVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "slice_end");
                scope.variables.push(new variable_1.CVariable(scope, this.endVarName, types_1.NumberVarType));
            }
        }
        scope.root.headerFlags.array = true;
    }
    return CArraySlice;
}());
CArraySlice = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && !endIndexArg}\n        {sizeVarName} = ({startIndexArg}) < 0 ? -({startIndexArg}) : {varAccess}->size - ({startIndexArg});\n        {startVarName} = ({startIndexArg}) < 0 ? {varAccess}->size + ({startIndexArg}) : ({startIndexArg});\n        ARRAY_CREATE({tempVarName}, {sizeVarName}, {sizeVarName});\n        for ({iteratorVarName} = 0; {iteratorVarName} < {sizeVarName}; {iteratorVarName}++)\n            {tempVarName}->data[{iteratorVarName}] = {varAccess}->data[{iteratorVarName} + {startVarName}];\n    {#elseif !topExpressionOfStatement && endIndexArg}\n        {startVarName} = ({startIndexArg}) < 0 ? {varAccess}->size + ({startIndexArg}) : ({startIndexArg});\n        {endVarName} = ({endIndexArg}) < 0 ? {varAccess}->size + ({endIndexArg}) : ({endIndexArg});\n        {sizeVarName} = {endVarName} - {startVarName};\n        ARRAY_CREATE({tempVarName}, {sizeVarName}, {sizeVarName});\n        for ({iteratorVarName} = 0; {iteratorVarName} < {sizeVarName}; {iteratorVarName}++)\n            {tempVarName}->data[{iteratorVarName}] = {varAccess}->data[{iteratorVarName} + {startVarName}];\n    {/if}\n{/statements}\n{#if topExpressionOfStatement}\n    /* slice doesn't have side effects, skipping */\n{#else}\n    {tempVarName}\n{/if}")
], CArraySlice);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],25:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArraySortResolver = (function () {
    function ArraySortResolver() {
    }
    ArraySortResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "sort" && objType instanceof types_1.ArrayType && objType.isDynamicArray;
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
    return ArraySortResolver;
}());
ArraySortResolver = __decorate([
    resolver_1.StandardCallResolver
], ArraySortResolver);
var CArraySort = (function () {
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
    return CArraySort;
}());
CArraySort = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && arrayOfInts}\n        qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_int16_t_cmp);\n    {#elseif !topExpressionOfStatement && arrayOfStrings}\n        qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_str_cmp);\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {varAccess}\n{#elseif arrayOfInts}\n    qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_int16_t_cmp);\n{#elseif arrayOfStrings}\n    qsort({varAccess}->data, {varAccess}->size, sizeof(*{varAccess}->data), array_str_cmp);\n{/if}")
], CArraySort);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../resolver":15,"../../template":39,"../../types":40}],26:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArraySpliceResolver = (function () {
    function ArraySpliceResolver() {
    }
    ArraySpliceResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "splice" && objType instanceof types_1.ArrayType && objType.isDynamicArray;
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
    return ArraySpliceResolver;
}());
ArraySpliceResolver = __decorate([
    resolver_1.StandardCallResolver
], ArraySpliceResolver);
var CArraySplice = (function () {
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
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, type));
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(propAccess);
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
    return CArraySplice;
}());
CArraySplice = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        ARRAY_CREATE({tempVarName}, {deleteCountArg}, {deleteCountArg});\n        for ({iteratorVarName} = 0; {iteratorVarName} < {deleteCountArg}; {iteratorVarName}++)\n            {tempVarName}->data[{iteratorVarName}] = {varAccess}->data[{iteratorVarName}+(({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}))];\n        ARRAY_REMOVE({varAccess}, ({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}), {deleteCountArg});\n        {insertValues}\n    {/if}\n{/statements}\n{#if topExpressionOfStatement && needsRemove}\n    ARRAY_REMOVE({varAccess}, ({startPosArg}) < 0 ? {varAccess}->size + ({startPosArg}) : ({startPosArg}), {deleteCountArg});\n    {insertValues}\n{#elseif topExpressionOfStatement && !needsRemove}\n    {insertValues}\n{#else}\n    {tempVarName}\n{/if}")
], CArraySplice);
var CInsertValue = (function () {
    function CInsertValue(scope, varAccess, startIndex, value) {
        this.varAccess = varAccess;
        this.startIndex = startIndex;
        this.value = value;
    }
    return CInsertValue;
}());
CInsertValue = __decorate([
    template_1.CodeTemplate("ARRAY_INSERT({varAccess}, {startIndex}, {value});\n")
], CInsertValue);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],27:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var ArrayUnshiftResolver = (function () {
    function ArrayUnshiftResolver() {
    }
    ArrayUnshiftResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "unshift" && objType instanceof types_1.ArrayType && objType.isDynamicArray;
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
    return ArrayUnshiftResolver;
}());
ArrayUnshiftResolver = __decorate([
    resolver_1.StandardCallResolver
], ArrayUnshiftResolver);
var CArrayUnshift = (function () {
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
            this.tempVarName = scope.root.typeHelper.addNewTemporaryVariable(propAccess, "arr_size");
            scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.NumberVarType));
        }
        scope.root.headerFlags.array = true;
        scope.root.headerFlags.array_insert = true;
    }
    return CArrayUnshift;
}());
CArrayUnshift = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {unshiftValues}\n        {tempVarName} = {varAccess}->size;\n    {/if}\n{/statements}\n{#if topExpressionOfStatement}\n    {unshiftValues}\n{#else}\n    {tempVarName}\n{/if}")
], CArrayUnshift);
var CUnshiftValue = (function () {
    function CUnshiftValue(scope, varAccess, value) {
        this.varAccess = varAccess;
        this.value = value;
    }
    return CUnshiftValue;
}());
CUnshiftValue = __decorate([
    template_1.CodeTemplate("ARRAY_INSERT({varAccess}, 0, {value});\n")
], CUnshiftValue);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],28:[function(require,module,exports){
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
var ConsoleLogHelper = (function () {
    function ConsoleLogHelper() {
    }
    ConsoleLogHelper.create = function (scope, printNode, emitCR) {
        if (emitCR === void 0) { emitCR = true; }
        var type = scope.root.typeHelper.getCType(printNode);
        var nodeExpression = template_1.CodeTemplateFactory.createForNode(scope, printNode);
        var accessor = nodeExpression["resolve"] ? nodeExpression["resolve"]() : nodeExpression;
        var options = {
            emitCR: emitCR
        };
        return new CPrintf(scope, printNode, accessor, type, options);
    };
    return ConsoleLogHelper;
}());
exports.ConsoleLogHelper = ConsoleLogHelper;
var CPrintf = CPrintf_1 = (function () {
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
        this.elementPrintfs = [];
        this.propPrefix = '';
        this.CR = '';
        this.INDENT = '';
        this.isStringLiteral = varType == types_1.StringVarType && printNode.kind == ts.SyntaxKind.StringLiteral;
        this.isQuotedCString = varType == types_1.StringVarType && options.quotedString;
        this.isCString = varType == types_1.StringVarType && !options.quotedString;
        this.isRegex = varType == types_1.RegexVarType;
        this.isInteger = varType == types_1.NumberVarType;
        this.isBoolean = varType == types_1.BooleanVarType;
        if (this.isStringLiteral)
            this.accessor = this.accessor.slice(1, -1);
        if (options.emitCR)
            this.CR = "\\n";
        if (options.propName)
            this.propPrefix = options.propName + ": ";
        if (options.indent)
            this.INDENT = options.indent;
        if (varType instanceof types_1.ArrayType) {
            this.isArray = true;
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(printNode);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            this.arraySize = varType.isDynamicArray ? accessor + "->size" : varType.capacity + "";
            var elementAccessor = accessor + (varType.isDynamicArray ? "->data" : "") + "[" + this.iteratorVarName + "]";
            var opts = { quotedString: true, indent: this.INDENT + "    " };
            this.elementPrintfs = [
                new CPrintf_1(scope, printNode, elementAccessor, varType.elementType, opts)
            ];
        }
        else if (varType instanceof types_1.DictType) {
            this.isDict = true;
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(printNode);
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
    return CPrintf;
}());
CPrintf = CPrintf_1 = __decorate([
    template_1.CodeTemplate("\n{#if isStringLiteral}\n    printf(\"{accessor}{CR}\");\n{#elseif isQuotedCString}\n    printf(\"{propPrefix}\\\"%s\\\"{CR}\", {accessor});\n{#elseif isCString}\n    printf(\"%s{CR}\", {accessor});\n{#elseif isRegex}\n    printf(\"%s{CR}\", {accessor}.str);\n{#elseif isInteger}\n    printf(\"{propPrefix}%d{CR}\", {accessor});\n{#elseif isBoolean && !propPrefix}\n    printf({accessor} ? \"true{CR}\" : \"false{CR}\");\n{#elseif isBoolean && propPrefix}\n    printf(\"{propPrefix}%s\", {accessor} ? \"true{CR}\" : \"false{CR}\");\n{#elseif isDict}\n    printf(\"{propPrefix}{ \");\n    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {accessor}->index->size; {iteratorVarName}++) {\n    {INDENT}    if ({iteratorVarName} != 0)\n    {INDENT}        printf(\", \");\n    {INDENT}    printf(\"\\\"%s\\\": \", {accessor}->index->data[{iteratorVarName}]);\n    {INDENT}    {elementPrintfs}\n    {INDENT}}\n    {INDENT}printf(\" }{CR}\");\n{#elseif isStruct}\n    printf(\"{propPrefix}{ \");\n    {INDENT}{elementPrintfs {    printf(\", \");\n    }=> {this}}\n    {INDENT}printf(\" }{CR}\");\n{#elseif isArray}\n    printf(\"{propPrefix}[ \");\n    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n    {INDENT}    if ({iteratorVarName} != 0)\n    {INDENT}        printf(\", \");\n    {INDENT}    {elementPrintfs}\n    {INDENT}}\n    {INDENT}printf(\" ]{CR}\");\n{#else}\n    printf(/* Unsupported printf expression */);\n{/if}")
], CPrintf);
var CPrintf_1;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/variable":12,"../../template":39,"../../types":40}],29:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringCharAtResolver = (function () {
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
    return StringCharAtResolver;
}());
StringCharAtResolver = __decorate([
    resolver_1.StandardCallResolver
], StringCharAtResolver);
var CStringCharAt = (function () {
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
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.StringVarType));
                this.start = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
            }
        }
        scope.root.headerFlags.str_substring = true;
    }
    return CStringCharAt;
}());
CStringCharAt = __decorate([
    template_1.CodeTemplate("\n{#if !topExpressionOfStatement && start != null}\n    ({tempVarName} = str_substring({varAccess}, {start}, ({start}) + 1))\n{#elseif !topExpressionOfStatement && start == null}\n    /* Error: parameter expected for charAt */\n{/if}")
], CStringCharAt);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],30:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringCharCodeAtResolver = (function () {
    function StringCharCodeAtResolver() {
    }
    StringCharCodeAtResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "charCodeAt" && objType == types_1.StringVarType;
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
    return StringCharCodeAtResolver;
}());
StringCharCodeAtResolver = __decorate([
    resolver_1.StandardCallResolver
], StringCharCodeAtResolver);
var CStringSearch = (function () {
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
    return CStringSearch;
}());
CStringSearch = __decorate([
    template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    str_char_code_at({strAccess}, {position})\n{/if}")
], CStringSearch);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../resolver":15,"../../template":39,"../../types":40}],31:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringConcatResolver = (function () {
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
    return StringConcatResolver;
}());
StringConcatResolver = __decorate([
    resolver_1.StandardCallResolver
], StringConcatResolver);
var CStringConcat = (function () {
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
    return CStringConcat;
}());
CStringConcat = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {tempVarName} = malloc({sizes{+}=>{this}} + 1);\n        assert({tempVarName} != NULL);\n        {tempVarName}[0] = '\\0';\n        {concatValues}\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
], CStringConcat);
var CGetSize = (function () {
    function CGetSize(scope, valueNode, value) {
        this.value = value;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isNumber = type == types_1.NumberVarType;
    }
    return CGetSize;
}());
CGetSize = __decorate([
    template_1.CodeTemplate("\n{#if isNumber}\n    STR_INT16_T_BUFLEN\n{#else}\n    strlen({value})\n{/if}")
], CGetSize);
var CConcatValue = (function () {
    function CConcatValue(scope, tempVarName, valueNode, value) {
        this.tempVarName = tempVarName;
        this.value = value;
        var type = scope.root.typeHelper.getCType(valueNode);
        this.isNumber = type == types_1.NumberVarType;
    }
    return CConcatValue;
}());
CConcatValue = __decorate([
    template_1.CodeTemplate("\n{#if isNumber}\n    str_int16_t_cat({tempVarName}, {value});\n{#else}\n    strcat({tempVarName}, {value});\n{/if}\n")
], CConcatValue);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],32:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringIndexOfResolver = (function () {
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
    return StringIndexOfResolver;
}());
StringIndexOfResolver = __decorate([
    resolver_1.StandardCallResolver
], StringIndexOfResolver);
var CStringIndexOf = (function () {
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
    return CStringIndexOf;
}());
CStringIndexOf = __decorate([
    template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    str_pos({stringAccess}, {arg1})\n{/if}")
], CStringIndexOf);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../resolver":15,"../../template":39,"../../types":40}],33:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringIndexOfResolver = (function () {
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
    return StringIndexOfResolver;
}());
StringIndexOfResolver = __decorate([
    resolver_1.StandardCallResolver
], StringIndexOfResolver);
var CStringIndexOf = (function () {
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
    return CStringIndexOf;
}());
CStringIndexOf = __decorate([
    template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    str_rpos({stringAccess}, {arg1})\n{/if}")
], CStringIndexOf);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../resolver":15,"../../template":39,"../../types":40}],34:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringMatchResolver = (function () {
    function StringMatchResolver() {
    }
    StringMatchResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "match" && objType == types_1.StringVarType;
    };
    StringMatchResolver.prototype.returnType = function (typeHelper, call) {
        return new types_1.ArrayType(types_1.StringVarType, 1, false);
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
    return StringMatchResolver;
}());
StringMatchResolver = __decorate([
    resolver_1.StandardCallResolver
], StringMatchResolver);
exports.StringMatchResolver = StringMatchResolver;
var CStringMatch = (function () {
    function CStringMatch(scope, call) {
        this.topExpressionOfStatement = false;
        this.isAssignmentRightPart = false;
        this.gcVarName = null;
        scope.root.headerFlags.str_substring = true;
        var propAccess = call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (call.parent.kind == ts.SyntaxKind.BinaryExpression) {
            var assignment = call.parent;
            if (assignment.left.kind == ts.SyntaxKind.Identifier) {
                this.matchArrayVarName = assignment.left.text;
                this.isAssignmentRightPart = true;
            }
        }
        if (call.parent.kind == ts.SyntaxKind.VariableDeclaration) {
            var assignment = call.parent;
            if (assignment.name.kind == ts.SyntaxKind.Identifier) {
                this.matchArrayVarName = assignment.name.text;
                this.isAssignmentRightPart = true;
            }
        }
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 1) {
                this.argAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
                this.regexVar = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                this.matchInfoVarName = scope.root.typeHelper.addNewTemporaryVariable(call, "match_info");
                this.gcVarName = scope.root.memoryManager.getGCVariableForNode(call);
                if (!this.isAssignmentRightPart) {
                    this.matchArrayVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
                    scope.variables.push(new variable_1.CVariable(scope, this.matchArrayVarName, new types_1.ArrayType(types_1.StringVarType, 1, false)));
                }
                scope.variables.push(new variable_1.CVariable(scope, this.matchInfoVarName, types_1.RegexMatchVarType));
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.gc_iterator = true;
            }
            else
                console.log("Unsupported number of parameters in " + call.getText() + ". Expected one parameter.");
        }
    }
    return CStringMatch;
}());
CStringMatch = __decorate([
    template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {matchInfoVarName} = {regexVar}.func({argAccess});\n        {matchArrayVarName}[0] = {matchInfoVarName}.index == -1 ? NULL : str_substring({argAccess}, {matchInfoVarName}.index, {matchInfoVarName}.end);\n    {/if}\n    {#if !topExpressionOfStatement && gcVarName}\n        ARRAY_PUSH({gcVarName}, (void *){matchArrayVarName}[0]);\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement && !isAssignmentRightPart}\n    {matchArrayVarName}\n{/if}")
], CStringMatch);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],35:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringSearchResolver = (function () {
    function StringSearchResolver() {
    }
    StringSearchResolver.prototype.matchesNode = function (typeHelper, call) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        var propAccess = call.expression;
        var objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "search" && objType == types_1.StringVarType;
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
    return StringSearchResolver;
}());
StringSearchResolver = __decorate([
    resolver_1.StandardCallResolver
], StringSearchResolver);
var CStringSearch = (function () {
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
    return CStringSearch;
}());
CStringSearch = __decorate([
    template_1.CodeTemplate("\n{#if !topExpressionOfStatement}\n    {regexVar}.func({argAccess}).index\n{/if}")
], CStringSearch);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../resolver":15,"../../template":39,"../../types":40}],36:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringSliceResolver = (function () {
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
    return StringSliceResolver;
}());
StringSliceResolver = __decorate([
    resolver_1.StandardCallResolver
], StringSliceResolver);
var CStringSlice = (function () {
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
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.StringVarType));
                this.start = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                if (call.arguments.length >= 2)
                    this.end = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[1]);
            }
        }
        scope.root.headerFlags.str_slice = true;
    }
    return CStringSlice;
}());
CStringSlice = __decorate([
    template_1.CodeTemplate("\n{#if !topExpressionOfStatement && start && end}\n    ({tempVarName} = str_slice({varAccess}, {start}, {end}))\n{#elseif !topExpressionOfStatement && start && !end}\n    ({tempVarName} = str_slice({varAccess}, {start}, str_len({varAccess})))\n{#elseif !topExpressionOfStatement && !start && !end}\n    /* Error: String.slice requires at least one parameter! */\n{/if}")
], CStringSlice);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],37:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var variable_1 = require("../../nodes/variable");
var elementaccess_1 = require("../../nodes/elementaccess");
var StringSubstringResolver = (function () {
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
    return StringSubstringResolver;
}());
StringSubstringResolver = __decorate([
    resolver_1.StandardCallResolver
], StringSubstringResolver);
var CStringSubstring = (function () {
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
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.StringVarType));
                this.start = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
                if (call.arguments.length >= 2)
                    this.end = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[1]);
            }
        }
        scope.root.headerFlags.str_substring = true;
    }
    return CStringSubstring;
}());
CStringSubstring = __decorate([
    template_1.CodeTemplate("\n{#if !topExpressionOfStatement && start && end}\n    ({tempVarName} = str_substring({varAccess}, {start}, {end}))\n{#elseif !topExpressionOfStatement && start && !end}\n    ({tempVarName} = str_substring({varAccess}, {start}, str_len({varAccess})))\n{#elseif !topExpressionOfStatement && !start && !end}\n    /* Error: String.substring requires at least one parameter! */\n{/if}")
], CStringSubstring);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":6,"../../nodes/variable":12,"../../resolver":15,"../../template":39,"../../types":40}],38:[function(require,module,exports){
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
var resolver_1 = require("../../resolver");
var types_1 = require("../../types");
var StringToStringResolver = (function () {
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
    return StringToStringResolver;
}());
StringToStringResolver = __decorate([
    resolver_1.StandardCallResolver
], StringToStringResolver);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../resolver":15,"../../template":39,"../../types":40}],39:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
;
var nodeKindTemplates = {};
var CodeTemplateFactory = (function () {
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
        return [template.replace("{this}", function () { return args; }), statements];
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
                if (elementsResolved != "")
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

},{}],40:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var resolver_1 = require("./resolver");
exports.UniversalVarType = "struct js_var *";
exports.PointerVarType = "void *";
exports.StringVarType = "const char *";
exports.NumberVarType = "int16_t";
exports.BooleanVarType = "uint8_t";
exports.RegexVarType = "struct regex_struct_t";
exports.RegexMatchVarType = "struct regex_match_struct_t";
/** Type that represents static or dynamic array */
var ArrayType = (function () {
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
        elementTypeText = elementTypeText.replace(/^struct array_(.*)_t \*$/, function (all, g1) { return "array_" + g1; });
        return "array_" +
            elementTypeText
                .replace(/^static /, '').replace('{var}', '').replace(/[\[\]]/g, '')
                .replace(/ /g, '_')
                .replace(/const char */g, 'string')
                .replace(/\*/g, '8') + "_t";
    };
    ArrayType.prototype.getText = function () {
        var elementType = this.elementType;
        var elementTypeText;
        if (typeof elementType === 'string')
            elementTypeText = elementType;
        else
            elementTypeText = elementType.getText();
        this.structName = ArrayType.getArrayStructName(elementTypeText);
        if (this.isDynamicArray)
            return "struct " + this.structName + " *";
        else
            return "static " + elementTypeText + " {var}[" + this.capacity + "]";
    };
    return ArrayType;
}());
exports.ArrayType = ArrayType;
/** Type that represents JS object with static properties (implemented as C struct) */
var StructType = (function () {
    function StructType(structName, properties) {
        this.structName = structName;
        this.properties = properties;
    }
    StructType.prototype.getText = function () {
        return this.structName;
    };
    return StructType;
}());
exports.StructType = StructType;
/** Type that represents JS object with dynamic properties (implemented as dynamic dictionary) */
var DictType = (function () {
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
    return DictType;
}());
exports.DictType = DictType;
/** Information about a variable */
var VariableInfo = (function () {
    function VariableInfo() {
        /** Contains all references to this variable */
        this.references = [];
    }
    return VariableInfo;
}());
exports.VariableInfo = VariableInfo;
// forOfIterator ====> for <var> of <array_variable> ---> <var>.type = (type of <array_variable>).elementType
// forInIterator ====> for <var> in <dict_variable> ---> <var>.type = StringVarType
// dynamicArrayOf ====> <var>.push(<value>) ---> <var>.elementType = (type of <value>)
// propertyType ====> <var>[<string>] = <value> ---> <var>.properties[<string>] = (type of <value>)
// propertyType ====> <var>.<ident> = <value> ---> <var>.properties[<ident>] = (type of <value>)
// arrayOf ====> <var>[<number>] = <value> ---> <var>.elementType = (type of <value>)
// dictOf ====> <var>[<something>] = <value> ---> <var>.elementType = (type of <value>)
var TypePromiseKind;
(function (TypePromiseKind) {
    TypePromiseKind[TypePromiseKind["variable"] = 0] = "variable";
    TypePromiseKind[TypePromiseKind["forOfIterator"] = 1] = "forOfIterator";
    TypePromiseKind[TypePromiseKind["forInIterator"] = 2] = "forInIterator";
    TypePromiseKind[TypePromiseKind["propertyType"] = 3] = "propertyType";
    TypePromiseKind[TypePromiseKind["dynamicArrayOf"] = 4] = "dynamicArrayOf";
    TypePromiseKind[TypePromiseKind["arrayOf"] = 5] = "arrayOf";
    TypePromiseKind[TypePromiseKind["dictOf"] = 6] = "dictOf";
    TypePromiseKind[TypePromiseKind["void"] = 7] = "void";
})(TypePromiseKind || (TypePromiseKind = {}));
var TypePromise = (function () {
    function TypePromise(associatedNode, promiseKind, propertyName) {
        if (promiseKind === void 0) { promiseKind = TypePromiseKind.variable; }
        if (propertyName === void 0) { propertyName = null; }
        this.associatedNode = associatedNode;
        this.promiseKind = promiseKind;
        this.propertyName = propertyName;
    }
    return TypePromise;
}());
var VariableData = (function () {
    function VariableData() {
        this.typePromises = {};
        this.addedProperties = {};
        this.objLiteralAssigned = false;
        this.arrLiteralAssigned = false;
        /** references to variables that represent properties of this variable */
        this.varDeclPosByPropName = {};
    }
    return VariableData;
}());
var TypeHelper = (function () {
    function TypeHelper(typeChecker) {
        this.typeChecker = typeChecker;
        this.userStructs = {};
        this.variablesData = {};
        this.functionCallsData = {};
        this.variables = {};
        this.functionPrototypes = {};
        this.arrayLiteralsTypes = {};
        this.objectLiteralsTypes = {};
        this.temporaryVariables = {};
        this.iteratorVarNames = ['i', 'j', 'k', 'l', 'm', 'n'];
    }
    /** Performs initialization of variables array */
    /** Call this before using getVariableInfo */
    TypeHelper.prototype.figureOutVariablesAndTypes = function (sources) {
        var _this = this;
        for (var _i = 0, sources_1 = sources; _i < sources_1.length; _i++) {
            var source = sources_1[_i];
            this.findVariablesRecursively(source);
        }
        this.resolvePromisesAndFinalizeTypes();
        var structs = this.getUserStructs();
        var functionPrototypes = Object.keys(this.functionPrototypes).map(function (k) { return _this.functionPrototypes[k]; });
        return [structs, functionPrototypes];
    };
    TypeHelper.prototype.getCType = function (node) {
        if (!node.kind)
            return null;
        switch (node.kind) {
            case ts.SyntaxKind.NumericLiteral:
                return exports.NumberVarType;
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
                return exports.BooleanVarType;
            case ts.SyntaxKind.StringLiteral:
                return exports.StringVarType;
            case ts.SyntaxKind.Identifier:
                {
                    var varInfo = this.getVariableInfo(node);
                    return varInfo && varInfo.type || null;
                }
            case ts.SyntaxKind.ElementAccessExpression:
                {
                    var elemAccess = node;
                    var parentObjectType = this.getCType(elemAccess.expression);
                    if (parentObjectType instanceof ArrayType)
                        return parentObjectType.elementType;
                    else if (parentObjectType instanceof StructType)
                        return parentObjectType.properties[elemAccess.argumentExpression.getText().slice(1, -1)];
                    else if (parentObjectType instanceof DictType)
                        return parentObjectType.elementType;
                    return null;
                }
            case ts.SyntaxKind.PropertyAccessExpression:
                {
                    var propAccess = node;
                    var parentObjectType = this.getCType(propAccess.expression);
                    if (parentObjectType instanceof StructType)
                        return parentObjectType.properties[propAccess.name.getText()];
                    else if (parentObjectType instanceof ArrayType && propAccess.name.getText() == "length")
                        return exports.NumberVarType;
                    else if (parentObjectType === exports.StringVarType && propAccess.name.getText() == "length")
                        return exports.NumberVarType;
                    return null;
                }
            case ts.SyntaxKind.CallExpression:
                {
                    var call = node;
                    var retType = resolver_1.StandardCallHelper.getReturnType(this, call);
                    if (retType)
                        return retType;
                    if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                        var propAccess = call.expression;
                        var propName = propAccess.name.getText();
                        if ((propName == "indexOf" || propName == "lastIndexOf") && call.arguments.length == 1) {
                            var exprType = this.getCType(propAccess.expression);
                            if (exprType && exprType == exports.StringVarType)
                                return exports.NumberVarType;
                        }
                    }
                    else if (call.expression.kind == ts.SyntaxKind.Identifier) {
                        if (call.expression.getText() == 'parseInt') {
                            return exports.NumberVarType;
                        }
                        var funcSymbol = this.typeChecker.getSymbolAtLocation(call.expression);
                        if (funcSymbol != null) {
                            var funcDeclPos = funcSymbol.valueDeclaration.pos;
                            var varInfo = this.variables[funcDeclPos];
                            return varInfo && varInfo.type;
                        }
                    }
                    return null;
                }
            case ts.SyntaxKind.RegularExpressionLiteral:
                return exports.RegexVarType;
            case ts.SyntaxKind.ArrayLiteralExpression:
                return this.arrayLiteralsTypes[node.pos];
            case ts.SyntaxKind.ObjectLiteralExpression:
                return this.objectLiteralsTypes[node.pos];
            case ts.SyntaxKind.FunctionDeclaration: {
                var varInfo = this.variables[node.pos];
                return varInfo && varInfo.type;
            }
            default:
                {
                    var tsType = this.typeChecker.getTypeAtLocation(node);
                    var type = tsType && this.convertType(tsType);
                    if (type != exports.UniversalVarType && type != exports.PointerVarType)
                        return type;
                }
                return null;
        }
    };
    /** Get information of variable specified by ts.Node */
    TypeHelper.prototype.getVariableInfo = function (node, propKey) {
        var symbol = this.typeChecker.getSymbolAtLocation(node);
        var varPos = symbol ? symbol.valueDeclaration.pos : node.pos;
        var varInfo = this.variables[varPos];
        if (varInfo && propKey) {
            var propPos = this.variablesData[varPos].varDeclPosByPropName[propKey];
            varInfo = this.variables[propPos];
        }
        return varInfo;
    };
    /** Get textual representation of type of the parameter for inserting into the C code */
    TypeHelper.prototype.getTypeString = function (source) {
        if (source.flags != null && source.intrinsicName != null)
            source = this.convertType(source);
        else if (source.flags != null && source.callSignatures != null && source.constructSignatures != null)
            source = this.convertType(source);
        else if (source.kind != null && source.flags != null)
            source = this.getCType(source);
        else if (source.name != null && source.flags != null && source.valueDeclaration != null && source.declarations != null)
            source = this.variables[source.valueDeclaration.pos].type;
        if (source instanceof ArrayType)
            return source.getText();
        else if (source instanceof StructType)
            return source.getText();
        else if (source instanceof DictType)
            return source.getText();
        else if (typeof source === 'string')
            return source;
        else
            throw new Error("Unrecognized type source");
    };
    /** Generate name for a new iterator variable and register it in temporaryVariables table.
     * Generated name is guarantied not to conflict with any existing names in specified scope.
     */
    TypeHelper.prototype.addNewIteratorVariable = function (scopeNode) {
        var parentFunc = this.findParentFunction(scopeNode);
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
    TypeHelper.prototype.addNewTemporaryVariable = function (scopeNode, proposedName) {
        var parentFunc = this.findParentFunction(scopeNode);
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
    TypeHelper.prototype.getUserStructs = function () {
        var _this = this;
        return Object.keys(this.userStructs)
            .filter(function (k) { return Object.keys(_this.userStructs[k].properties).length > 0; })
            .map(function (k) {
            return {
                name: k,
                properties: Object.keys(_this.userStructs[k].properties)
                    .map(function (pk) {
                    return {
                        name: pk,
                        type: _this.userStructs[k].properties[pk]
                    };
                })
            };
        });
    };
    /** Convert ts.Type to CType */
    /** Used mostly during type preprocessing stage */
    TypeHelper.prototype.convertType = function (tsType, ident) {
        if (!tsType || tsType.flags == ts.TypeFlags.Void)
            return "void";
        if (tsType.flags == ts.TypeFlags.String || tsType.flags == ts.TypeFlags.StringLiteral)
            return exports.StringVarType;
        if (tsType.flags == ts.TypeFlags.Number || tsType.flags == ts.TypeFlags.NumberLiteral)
            return exports.NumberVarType;
        if (tsType.flags == ts.TypeFlags.Boolean || tsType.flags == (ts.TypeFlags.Boolean + ts.TypeFlags.Union))
            return exports.BooleanVarType;
        if (tsType.flags & ts.TypeFlags.Object && tsType.getProperties().length > 0) {
            return this.generateStructure(tsType, ident);
        }
        if (tsType.flags == ts.TypeFlags.Any)
            return exports.PointerVarType;
        console.log("Non-standard type: " + this.typeChecker.typeToString(tsType));
        return exports.PointerVarType;
    };
    TypeHelper.prototype.findParentFunction = function (node) {
        var parentFunc = node;
        while (parentFunc && parentFunc.kind != ts.SyntaxKind.FunctionDeclaration) {
            parentFunc = parentFunc.parent;
        }
        return parentFunc;
    };
    TypeHelper.prototype.findVariablesRecursively = function (node) {
        var _this = this;
        if (node.kind == ts.SyntaxKind.CallExpression) {
            var call = node;
            if (call.expression.kind == ts.SyntaxKind.Identifier) {
                var funcSymbol = this.typeChecker.getSymbolAtLocation(call.expression);
                if (funcSymbol != null) {
                    var funcDeclPos = funcSymbol.valueDeclaration.pos + 1;
                    if (funcDeclPos > call.pos)
                        this.functionPrototypes[funcDeclPos] = funcSymbol.valueDeclaration;
                    for (var i = 0; i < call.arguments.length; i++) {
                        if (!this.functionCallsData[funcDeclPos])
                            this.functionCallsData[funcDeclPos] = [];
                        var callData = this.functionCallsData[funcDeclPos];
                        var argId = call.arguments[i].pos + "_" + call.arguments[i].end;
                        if (!callData[i])
                            callData[i] = {};
                        callData[i][argId] = new TypePromise(call.arguments[i]);
                    }
                }
            }
        }
        else if (node.kind == ts.SyntaxKind.ReturnStatement) {
            var ret = node;
            var parentFunc = this.findParentFunction(node);
            var funcPos = parentFunc && parentFunc.pos;
            if (funcPos != null) {
                if (ret.expression) {
                    if (ret.expression.kind == ts.SyntaxKind.ObjectLiteralExpression) {
                        this.addTypePromise(funcPos, ret.expression);
                        var objLiteral = ret.expression;
                        for (var _i = 0, _a = objLiteral.properties.filter(function (p) { return p.kind == ts.SyntaxKind.PropertyAssignment; }).map(function (p) { return p; }); _i < _a.length; _i++) {
                            var propAssignment = _a[_i];
                            this.addTypePromise(funcPos, propAssignment.initializer, TypePromiseKind.propertyType, propAssignment.name.getText());
                        }
                    }
                    else
                        this.addTypePromise(funcPos, ret.expression);
                }
                else {
                    this.addTypePromise(funcPos, ret, TypePromiseKind.void);
                }
            }
        }
        else if (node.kind == ts.SyntaxKind.ArrayLiteralExpression) {
            if (!this.arrayLiteralsTypes[node.pos])
                this.determineArrayType(node);
            var arrType = this.arrayLiteralsTypes[node.pos];
            if (arrType instanceof ArrayType
                && node.parent.kind == ts.SyntaxKind.PropertyAccessExpression
                && node.parent.parent.kind == ts.SyntaxKind.CallExpression) {
                var propAccess = node.parent;
                // if array literal is concatenated, we need to ensure that we
                // have corresponding dynamic array type for the temporary variable
                if (propAccess.name.getText() == "concat")
                    this.ensureArrayStruct(arrType.elementType);
            }
        }
        else if (node.kind == ts.SyntaxKind.ObjectLiteralExpression) {
            if (!this.objectLiteralsTypes[node.pos]) {
                var type = this.generateStructure(this.typeChecker.getTypeAtLocation(node));
                this.objectLiteralsTypes[node.pos] = type;
            }
        }
        else if (node.kind == ts.SyntaxKind.Identifier || node.kind == ts.SyntaxKind.PropertyAccessExpression) {
            var varPos = null;
            var varInfo = null;
            var varData = null;
            var varNode = null;
            if (node.kind == ts.SyntaxKind.PropertyAccessExpression) {
                var propAccess = node;
                var propName = propAccess.name.getText();
                // drill down to identifier
                var topPropAccess = propAccess;
                var propsChain = [];
                while (topPropAccess.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                    topPropAccess = topPropAccess.expression;
                    propsChain.push(topPropAccess.name);
                }
                if (topPropAccess.expression.kind == ts.SyntaxKind.Identifier) {
                    var topSymbol = this.typeChecker.getSymbolAtLocation(topPropAccess.expression);
                    if (topSymbol) {
                        // go from identifier to property
                        varPos = topSymbol.valueDeclaration.pos;
                        var varName = topSymbol.name;
                        while (propsChain.length) {
                            var propIdent = propsChain.pop();
                            varName += "." + propIdent.getText();
                            var nextVarPos = this.variablesData[varPos].varDeclPosByPropName[propIdent.getText()];
                            if (nextVarPos == null) {
                                nextVarPos = propIdent.pos;
                                // create new variable that represents this property
                                this.variablesData[varPos].varDeclPosByPropName[propIdent.getText()] = propIdent.pos;
                                this.variables[nextVarPos] = new VariableInfo();
                                this.variablesData[nextVarPos] = new VariableData();
                                this.variables[nextVarPos].name = varName;
                                this.variables[nextVarPos].declaration = propAccess.expression;
                            }
                            varPos = nextVarPos;
                        }
                        varInfo = this.variables[varPos];
                        varData = this.variablesData[varPos];
                        varInfo.references.push(propAccess.expression);
                        varNode = propAccess.expression;
                    }
                }
            }
            else if (node.kind == ts.SyntaxKind.Identifier) {
                var symbol = this.typeChecker.getSymbolAtLocation(node);
                if (symbol) {
                    varPos = symbol.valueDeclaration.pos;
                    if (!this.variables[varPos]) {
                        this.variables[varPos] = new VariableInfo();
                        this.variablesData[varPos] = new VariableData();
                        this.variables[varPos].name = node.getText();
                        this.variables[varPos].declaration = symbol.declarations[0].name;
                    }
                    varInfo = this.variables[varPos];
                    varData = this.variablesData[varPos];
                    varInfo.references.push(node);
                    varNode = node;
                }
            }
            if (varData) {
                if (varNode.parent && varNode.parent.kind == ts.SyntaxKind.VariableDeclaration) {
                    var varDecl = varNode.parent;
                    if (varDecl.name.getText() == varNode.getText()) {
                        this.addTypePromise(varPos, varDecl.initializer);
                        if (varDecl.initializer && varDecl.initializer.kind == ts.SyntaxKind.ObjectLiteralExpression) {
                            varData.objLiteralAssigned = true;
                            var objLiteral = varDecl.initializer;
                            for (var _b = 0, _c = objLiteral.properties.filter(function (p) { return p.kind == ts.SyntaxKind.PropertyAssignment; }).map(function (p) { return p; }); _b < _c.length; _b++) {
                                var propAssignment = _c[_b];
                                this.addTypePromise(varPos, propAssignment.initializer, TypePromiseKind.propertyType, propAssignment.name.getText());
                            }
                        }
                        if (varDecl.initializer && varDecl.initializer.kind == ts.SyntaxKind.ArrayLiteralExpression)
                            varData.arrLiteralAssigned = true;
                        if (varDecl.parent && varDecl.parent.parent && varDecl.parent.parent.kind == ts.SyntaxKind.ForOfStatement) {
                            var forOfStatement = varDecl.parent.parent;
                            if (forOfStatement.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
                                var forOfInitializer = forOfStatement.initializer;
                                if (forOfInitializer.declarations[0].pos == varDecl.pos) {
                                    this.addTypePromise(varPos, forOfStatement.expression, TypePromiseKind.forOfIterator);
                                }
                            }
                        }
                        else if (varDecl.parent && varDecl.parent.parent && varDecl.parent.parent.kind == ts.SyntaxKind.ForInStatement) {
                            var forInStatement = varDecl.parent.parent;
                            if (forInStatement.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
                                var forInInitializer = forInStatement.initializer;
                                if (forInInitializer.declarations[0].pos == varDecl.pos) {
                                    this.addTypePromise(varPos, forInStatement.expression, TypePromiseKind.forInIterator);
                                }
                            }
                        }
                    }
                }
                else if (varNode.parent && varNode.parent.kind == ts.SyntaxKind.FunctionDeclaration) {
                    this.addTypePromise(varPos, varNode.parent, TypePromiseKind.void);
                }
                else if (varNode.parent && varNode.parent.kind == ts.SyntaxKind.Parameter) {
                    var funcDecl = varNode.parent.parent;
                    for (var i = 0; i < funcDecl.parameters.length; i++) {
                        if (funcDecl.parameters[i].pos == varNode.pos) {
                            var param = funcDecl.parameters[i];
                            varData.parameterIndex = i;
                            varData.parameterFuncDeclPos = funcDecl.pos + 1;
                            this.addTypePromise(varPos, param.name);
                            this.addTypePromise(varPos, param.initializer);
                            break;
                        }
                    }
                }
                else if (varNode.parent && varNode.parent.kind == ts.SyntaxKind.BinaryExpression) {
                    var binExpr = varNode.parent;
                    if (binExpr.left.kind == ts.SyntaxKind.Identifier
                        && binExpr.left.getText() == varNode.getText()
                        && binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                        this.addTypePromise(varPos, binExpr.left);
                        this.addTypePromise(varPos, binExpr.right);
                        if (binExpr.right && binExpr.right.kind == ts.SyntaxKind.ObjectLiteralExpression) {
                            varData.objLiteralAssigned = true;
                            var objLiteral = binExpr.right;
                            for (var _d = 0, _e = objLiteral.properties.filter(function (p) { return p.kind == ts.SyntaxKind.PropertyAssignment; }).map(function (p) { return p; }); _d < _e.length; _d++) {
                                var propAssignment = _e[_d];
                                this.addTypePromise(varPos, propAssignment.initializer, TypePromiseKind.propertyType, propAssignment.name.getText());
                            }
                        }
                        if (binExpr.right && binExpr.right.kind == ts.SyntaxKind.ArrayLiteralExpression)
                            varData.arrLiteralAssigned = true;
                    }
                }
                else if (varNode.parent && varNode.parent.kind == ts.SyntaxKind.PropertyAccessExpression) {
                    var propAccess = varNode.parent;
                    var propName = propAccess.name.getText();
                    if (propAccess.expression.pos == varNode.pos && propAccess.parent.kind == ts.SyntaxKind.BinaryExpression) {
                        var binExpr = propAccess.parent;
                        if (binExpr.left.pos == propAccess.pos && binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                            this.addTypePromise(varPos, binExpr.left, TypePromiseKind.propertyType, propAccess.name.getText());
                            this.addTypePromise(varPos, binExpr.right, TypePromiseKind.propertyType, propAccess.name.getText());
                        }
                    }
                    if (propName == "push" || propName == "unshift") {
                        varData.isDynamicArray = true;
                        if (propAccess.parent && propAccess.parent.kind == ts.SyntaxKind.CallExpression) {
                            var call = propAccess.parent;
                            for (var _f = 0, _g = call.arguments; _f < _g.length; _f++) {
                                var arg = _g[_f];
                                this.addTypePromise(varPos, arg, TypePromiseKind.dynamicArrayOf);
                            }
                        }
                    }
                    if (propName == "pop" || propName == "shift") {
                        varData.isDynamicArray = true;
                        if (propAccess.parent && propAccess.parent.kind == ts.SyntaxKind.CallExpression) {
                            var call = propAccess.parent;
                            if (call.arguments.length == 0)
                                this.addTypePromise(varPos, call, TypePromiseKind.dynamicArrayOf);
                        }
                    }
                    if (propAccess.expression.kind == ts.SyntaxKind.Identifier && propName == "sort")
                        varData.isDynamicArray = true;
                    if (propAccess.expression.kind == ts.SyntaxKind.Identifier && propName == "reverse")
                        varData.isDynamicArray = true;
                    if (propAccess.expression.kind == ts.SyntaxKind.Identifier && propName == "splice") {
                        varData.isDynamicArray = true;
                        if (propAccess.parent && propAccess.parent.kind == ts.SyntaxKind.CallExpression) {
                            var call = propAccess.parent;
                            if (call.arguments.length > 2) {
                                for (var _h = 0, _j = call.arguments.slice(2); _h < _j.length; _h++) {
                                    var arg = _j[_h];
                                    this.addTypePromise(varPos, arg, TypePromiseKind.dynamicArrayOf);
                                }
                            }
                            if (call.arguments.length >= 2) {
                                this.addTypePromise(varPos, call);
                            }
                        }
                    }
                    if (propAccess.expression.kind == ts.SyntaxKind.Identifier && propName == "slice") {
                        varData.isDynamicArray = true;
                        if (propAccess.parent && propAccess.parent.kind == ts.SyntaxKind.CallExpression) {
                            var call = propAccess.parent;
                            if (call.arguments.length >= 1) {
                                this.addTypePromise(varPos, call);
                            }
                        }
                    }
                }
                else if (varNode.parent && varNode.parent.kind == ts.SyntaxKind.ElementAccessExpression) {
                    var elemAccess = varNode.parent;
                    if (elemAccess.expression.pos == varNode.pos) {
                        var propName = void 0;
                        var promiseKind = void 0;
                        if (elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                            propName = elemAccess.argumentExpression.getText().slice(1, -1);
                            promiseKind = TypePromiseKind.propertyType;
                        }
                        else if (elemAccess.argumentExpression.kind == ts.SyntaxKind.NumericLiteral) {
                            promiseKind = TypePromiseKind.arrayOf;
                        }
                        else {
                            varData.isDict = true;
                            promiseKind = TypePromiseKind.dictOf;
                        }
                        this.addTypePromise(varPos, elemAccess, promiseKind, propName);
                        if (elemAccess.parent && elemAccess.parent.kind == ts.SyntaxKind.BinaryExpression) {
                            var binExpr = elemAccess.parent;
                            if (binExpr.left.pos == elemAccess.pos && binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                                if (promiseKind == TypePromiseKind.dictOf) {
                                    this.addTypePromise(varPos, binExpr.right, promiseKind);
                                }
                                else if (elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                                    this.addTypePromise(varPos, binExpr.right, promiseKind, propName);
                                }
                            }
                        }
                    }
                }
                else if (varNode.parent && varNode.parent.kind == ts.SyntaxKind.ForOfStatement) {
                    var forOfStatement = varNode.parent;
                    if (forOfStatement.initializer.kind == ts.SyntaxKind.Identifier && forOfStatement.initializer.pos == varNode.pos) {
                        this.addTypePromise(varPos, forOfStatement.expression, TypePromiseKind.forOfIterator);
                    }
                }
                else if (varNode.parent && varNode.parent.kind == ts.SyntaxKind.ForInStatement) {
                    var forInStatement = varNode.parent;
                    if (forInStatement.initializer.kind == ts.SyntaxKind.Identifier && forInStatement.initializer.pos == varNode.pos) {
                        this.addTypePromise(varPos, forInStatement.expression, TypePromiseKind.forInIterator);
                    }
                }
            }
        }
        node.getChildren().forEach(function (c) { return _this.findVariablesRecursively(c); });
    };
    TypeHelper.prototype.resolvePromisesAndFinalizeTypes = function () {
        var _this = this;
        var somePromisesAreResolved;
        do {
            somePromisesAreResolved = this.tryResolvePromises();
            var _loop_1 = function (k) {
                var promises = Object.keys(this_1.variablesData[k].typePromises)
                    .map(function (p) { return _this.variablesData[k].typePromises[p]; });
                var variableBestTypes = promises
                    .filter(function (p) { return p.promiseKind != TypePromiseKind.propertyType; })
                    .map(function (p) { return p.bestType; });
                if (this_1.variables[k].type)
                    variableBestTypes.push(this_1.variables[k].type);
                var varType = variableBestTypes.length ? variableBestTypes.reduce(function (c, n) { return _this.mergeTypes(c, n).type; }) : null;
                varType = varType || exports.PointerVarType;
                if (varType instanceof ArrayType) {
                    if (this_1.variablesData[k].isDynamicArray && !this_1.variablesData[k].parameterFuncDeclPos && this_1.variablesData[k].arrLiteralAssigned)
                        this_1.variables[k].requiresAllocation = true;
                    varType.isDynamicArray = varType.isDynamicArray || this_1.variablesData[k].isDynamicArray;
                }
                else if (varType instanceof StructType) {
                    if (this_1.variablesData[k].objLiteralAssigned)
                        this_1.variables[k].requiresAllocation = true;
                    var keys1 = Object.keys(this_1.variablesData[k].addedProperties);
                    var keys2 = Object.keys(this_1.variablesData[k].varDeclPosByPropName);
                    var allPropKeys = keys1.concat(keys2);
                    for (var _i = 0, allPropKeys_1 = allPropKeys; _i < allPropKeys_1.length; _i++) {
                        var propKey = allPropKeys_1[_i];
                        var propVarPos = this_1.variablesData[k].varDeclPosByPropName[propKey];
                        var type1 = propVarPos && this_1.variables[propVarPos].type;
                        var type2 = this_1.variablesData[k].addedProperties[propKey];
                        varType.properties[propKey] = this_1.mergeTypes(type1, type2).type;
                    }
                }
                else if (varType instanceof DictType) {
                    if (!this_1.variablesData[k].parameterFuncDeclPos)
                        this_1.variables[k].requiresAllocation = true;
                    var elemType = varType.elementType;
                    var keys1 = Object.keys(this_1.variablesData[k].addedProperties);
                    var keys2 = Object.keys(this_1.variablesData[k].varDeclPosByPropName);
                    var allPropKeys = keys1.concat(keys2);
                    for (var _a = 0, allPropKeys_2 = allPropKeys; _a < allPropKeys_2.length; _a++) {
                        var propKey = allPropKeys_2[_a];
                        var propVarPos = this_1.variablesData[k].varDeclPosByPropName[propKey];
                        var type1 = propVarPos && this_1.variables[propVarPos].type;
                        var type2 = this_1.variablesData[k].addedProperties[propKey];
                        elemType = this_1.mergeTypes(elemType, type1).type;
                        elemType = this_1.mergeTypes(elemType, type2).type;
                    }
                    varType.elementType = elemType;
                }
                this_1.variables[k].type = varType;
            };
            var this_1 = this;
            for (var _i = 0, _a = Object.keys(this.variables).map(function (k) { return +k; }); _i < _a.length; _i++) {
                var k = _a[_i];
                _loop_1(k);
            }
        } while (somePromisesAreResolved);
        for (var _b = 0, _c = Object.keys(this.variables).map(function (k) { return +k; }); _b < _c.length; _b++) {
            var k = _c[_b];
            this.postProcessArrays(this.variables[k].type);
        }
    };
    TypeHelper.prototype.postProcessArrays = function (varType) {
        if (varType instanceof ArrayType && varType.isDynamicArray && varType != varType.elementType) {
            this.ensureArrayStruct(varType.elementType);
            this.postProcessArrays(varType.elementType);
        }
        else if (varType instanceof DictType && varType != varType.elementType) {
            this.postProcessArrays(varType.elementType);
        }
        else if (varType instanceof StructType) {
            for (var k in varType.properties) {
                if (varType != varType.properties[k])
                    this.postProcessArrays(varType.properties[k]);
            }
        }
    };
    TypeHelper.prototype.tryResolvePromises = function () {
        var somePromisesAreResolved = false;
        /** Function parameters */
        for (var _i = 0, _a = Object.keys(this.variables).map(function (k) { return +k; }); _i < _a.length; _i++) {
            var varPos = _a[_i];
            var funcDeclPos = this.variablesData[varPos].parameterFuncDeclPos;
            if (funcDeclPos && this.functionCallsData[funcDeclPos]) {
                var paramIndex = this.variablesData[varPos].parameterIndex;
                var functionCallsPromises = this.functionCallsData[funcDeclPos][paramIndex];
                var variablePromises = this.variablesData[varPos].typePromises;
                for (var id in functionCallsPromises) {
                    if (!variablePromises[id]) {
                        variablePromises[id] = functionCallsPromises[id];
                        somePromisesAreResolved = true;
                    }
                    var currentType = variablePromises[id].bestType || exports.PointerVarType;
                    var resolvedType = this.getCType(functionCallsPromises[id].associatedNode);
                    var mergeResult = this.mergeTypes(currentType, resolvedType);
                    if (mergeResult.replaced)
                        somePromisesAreResolved = true;
                    variablePromises[id].bestType = mergeResult.type;
                }
            }
        }
        /** Variables */
        for (var _b = 0, _c = Object.keys(this.variables).map(function (k) { return +k; }); _b < _c.length; _b++) {
            var varPos = _c[_b];
            for (var promiseId in this.variablesData[varPos].typePromises) {
                var promise = this.variablesData[varPos].typePromises[promiseId];
                var resolvedType = this.getCType(promise.associatedNode) || exports.PointerVarType;
                var finalType = resolvedType;
                if (promise.promiseKind == TypePromiseKind.dynamicArrayOf) {
                    // nested arrays should also be dynamic
                    if (resolvedType instanceof ArrayType)
                        resolvedType.isDynamicArray = true;
                    finalType = new ArrayType(resolvedType, 0, true);
                }
                else if (promise.promiseKind == TypePromiseKind.arrayOf) {
                    finalType = new ArrayType(resolvedType, 0, false);
                }
                else if (promise.promiseKind == TypePromiseKind.dictOf) {
                    finalType = new DictType(resolvedType);
                }
                else if (resolvedType instanceof ArrayType && promise.promiseKind == TypePromiseKind.forOfIterator) {
                    finalType = resolvedType.elementType;
                }
                else if (resolvedType instanceof DictType && promise.promiseKind == TypePromiseKind.forInIterator) {
                    finalType = exports.StringVarType;
                }
                else if (promise.promiseKind == TypePromiseKind.void) {
                    finalType = "void";
                }
                var bestType = promise.bestType;
                if (promise.promiseKind == TypePromiseKind.propertyType) {
                    var propVarPos = this.variablesData[varPos].varDeclPosByPropName[promise.propertyName];
                    if (propVarPos)
                        bestType = this.variables[propVarPos].type;
                    else
                        bestType = this.variablesData[varPos].addedProperties[promise.propertyName];
                }
                var mergeResult = this.mergeTypes(bestType, finalType);
                if (mergeResult.replaced)
                    somePromisesAreResolved = true;
                promise.bestType = mergeResult.type;
                if (promise.promiseKind == TypePromiseKind.propertyType && mergeResult.replaced) {
                    var propVarPos = this.variablesData[varPos].varDeclPosByPropName[promise.propertyName];
                    if (propVarPos)
                        this.variables[propVarPos].type = mergeResult.type;
                    else
                        this.variablesData[varPos].addedProperties[promise.propertyName] = mergeResult.type;
                }
            }
        }
        return somePromisesAreResolved;
    };
    TypeHelper.prototype.generateStructure = function (tsType, ident) {
        var structName = "struct_" + Object.keys(this.userStructs).length + "_t";
        var varName = ident && ident.getText();
        if (varName) {
            if (this.userStructs[varName + "_t"] == null)
                structName = varName + "_t";
            else {
                var i = 2;
                while (this.userStructs[varName + "_" + i + "_t"] != null)
                    i++;
                structName = varName + "_" + i + "_t";
            }
        }
        var userStructInfo = {};
        for (var _i = 0, _a = tsType.getProperties(); _i < _a.length; _i++) {
            var prop = _a[_i];
            var propTsType = this.typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration);
            var propType = this.convertType(propTsType, prop.valueDeclaration.name);
            if (propType == exports.PointerVarType && prop.valueDeclaration.kind == ts.SyntaxKind.PropertyAssignment) {
                var propAssignment = prop.valueDeclaration;
                if (propAssignment.initializer && propAssignment.initializer.kind == ts.SyntaxKind.ArrayLiteralExpression)
                    propType = this.determineArrayType(propAssignment.initializer);
            }
            userStructInfo[prop.name] = propType;
        }
        var userStructCode = this.getStructureBodyString(userStructInfo);
        var found = false;
        if (Object.keys(userStructInfo).length > 0) {
            for (var s in this.userStructs) {
                if (this.getStructureBodyString(this.userStructs[s].properties) == userStructCode) {
                    structName = s;
                    found = true;
                    break;
                }
            }
        }
        if (!found)
            this.userStructs[structName] = new StructType('struct ' + structName + ' *', userStructInfo);
        return this.userStructs[structName];
    };
    TypeHelper.prototype.getStructureBodyString = function (properties) {
        var userStructCode = '{\n';
        for (var propName in properties) {
            var propType = properties[propName];
            if (typeof propType === 'string') {
                userStructCode += '    ' + propType + ' ' + propName + ';\n';
            }
            else if (propType instanceof ArrayType) {
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
    TypeHelper.prototype.determineArrayType = function (arrLiteral) {
        var elementType;
        if (arrLiteral.elements.length > 0)
            elementType = this.convertType(this.typeChecker.getTypeAtLocation(arrLiteral.elements[0]));
        else
            elementType = exports.UniversalVarType;
        var cap = arrLiteral.elements.length;
        var type = new ArrayType(elementType, cap, false);
        this.arrayLiteralsTypes[arrLiteral.pos] = type;
        return type;
    };
    TypeHelper.prototype.ensureArrayStruct = function (elementType) {
        var elementTypeText = this.getTypeString(elementType);
        var structName = ArrayType.getArrayStructName(elementTypeText);
        this.userStructs[structName] = new StructType(structName, {
            size: exports.NumberVarType,
            capacity: exports.NumberVarType,
            data: elementTypeText + "*"
        });
    };
    TypeHelper.prototype.addTypePromise = function (varPos, associatedNode, promiseKind, propName) {
        if (promiseKind === void 0) { promiseKind = TypePromiseKind.variable; }
        if (propName === void 0) { propName = null; }
        if (!associatedNode)
            return;
        if (associatedNode.kind == ts.SyntaxKind.ConditionalExpression) {
            var ternary = associatedNode;
            this.addTypePromise(varPos, ternary.whenTrue, promiseKind, propName);
            this.addTypePromise(varPos, ternary.whenFalse, promiseKind, propName);
            return;
        }
        var promiseId = associatedNode.pos + "_" + associatedNode.end;
        var promise = new TypePromise(associatedNode, promiseKind, propName);
        this.variablesData[varPos].typePromises[promiseId] = promise;
    };
    TypeHelper.prototype.mergeTypes = function (currentType, newType) {
        var newResult = { type: newType, replaced: true };
        var currentResult = { type: currentType, replaced: false };
        if (!currentType && newType)
            return newResult;
        else if (!newType)
            return currentResult;
        else if (this.getTypeString(currentType) == this.getTypeString(newType))
            return currentResult;
        else if (currentType == "void")
            return newResult;
        else if (newType == "void")
            return currentResult;
        else if (currentType == exports.PointerVarType)
            return newResult;
        else if (newType == exports.PointerVarType)
            return currentResult;
        else if (currentType == exports.UniversalVarType)
            return newResult;
        else if (newType == exports.UniversalVarType)
            return currentResult;
        else if (currentType instanceof ArrayType && newType instanceof ArrayType) {
            var cap = Math.max(newType.capacity, currentType.capacity);
            newType.capacity = cap;
            currentType.capacity = cap;
            var isDynamicArray = newType.isDynamicArray || currentType.isDynamicArray;
            newType.isDynamicArray = isDynamicArray;
            currentType.isDynamicArray = isDynamicArray;
            var mergeResult = this.mergeTypes(currentType.elementType, newType.elementType);
            newType.elementType = mergeResult.type;
            currentType.elementType = mergeResult.type;
            if (mergeResult.replaced)
                return newResult;
            return currentResult;
        }
        else if (currentType instanceof DictType && newType instanceof ArrayType) {
            if (newType.elementType == currentType.elementType || currentType.elementType == exports.PointerVarType)
                return newResult;
        }
        else if (currentType instanceof ArrayType && newType instanceof DictType) {
            if (newType.elementType == currentType.elementType || newType.elementType == exports.PointerVarType)
                return currentResult;
        }
        else if (currentType instanceof StructType && newType instanceof DictType) {
            return newResult;
        }
        else if (currentType instanceof DictType && newType instanceof DictType) {
            if (newType.elementType != exports.PointerVarType && currentType.elementType == exports.PointerVarType)
                return newResult;
            return currentResult;
        }
        console.log("WARNING: candidate for UniversalVarType! Current: " + this.getTypeString(currentType) + ", new: " + this.getTypeString(newType));
        return currentResult;
    };
    return TypeHelper;
}());
exports.TypeHelper = TypeHelper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./resolver":15}],41:[function(require,module,exports){
(function (process,global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var program_1 = require("./src/program");
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
// Public API
if (typeof window !== 'undefined')
    window["ts2c"] = {
        transpile: function (source) {
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
    };
// When used in Node environment, this file is also a command line tool
(function () {
    if (typeof process !== 'undefined' && process.nextTick && !process.browser && typeof require !== "undefined") {
        var fs = require('fs');
        if (process.argv.length < 2)
            process.exit();
        var fileNames = process.argv.slice(2);
        var program = ts.createProgram(fileNames, { noLib: true, allowJs: true });
        var output = new program_1.CProgram(program)["resolve"]();
        fs.writeFileSync(fileNames[0].slice(0, -3) + '.c', output);
        process.exit();
    }
})();

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./src/program":13,"_process":2,"fs":1}]},{},[41]);
