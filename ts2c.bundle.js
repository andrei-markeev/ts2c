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
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var MemoryManager = (function () {
    function MemoryManager(typeChecker, typeHelper) {
        this.typeChecker = typeChecker;
        this.typeHelper = typeHelper;
        this.scopes = {};
        this.scopesOfVariables = {};
    }
    MemoryManager.prototype.preprocess = function () {
        for (var k in this.typeHelper.variables) {
            var v = this.typeHelper.variables[k];
            if (v.requiresAllocation)
                this.scheduleVariableDisposal(v.declaration.name);
        }
    };
    MemoryManager.prototype.getGCVariableForScope = function (node) {
        var parentDecl = this.findParentFunctionNode(node);
        var scopeId = parentDecl && parentDecl.pos + 1 || "main";
        if (this.scopes[scopeId] && this.scopes[scopeId].filter(function (v) { return !v.simple; }).length) {
            return "_gc_" + scopeId;
        }
        return null;
    };
    MemoryManager.prototype.getGCVariableForVariable = function (node, varPos) {
        var parentDecl = this.findParentFunctionNode(node);
        var scopeId = parentDecl && parentDecl.pos + 1 || "main";
        if (this.scopesOfVariables[varPos] && !this.scopesOfVariables[varPos].simple)
            return "_gc_" + this.scopesOfVariables[varPos].scopeId;
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
                destructors.push(simpleVarScopeInfo.declIdent);
            }
        }
        return destructors;
    };
    MemoryManager.prototype.scheduleVariableDisposal = function (varIdent) {
        var varId = this.getSymbolId(varIdent);
        var varFuncNode = this.findParentFunctionNode(varIdent);
        var varPos = varIdent.pos;
        var scope = varFuncNode && varFuncNode.pos + 1 || "main";
        var isSimple = true;
        // TODO:
        // - calls from multiple external functions (only one of them is processed currently)
        // - circular references
        // - complicated call tree
        var queue = [varIdent];
        queue.push();
        while (queue.length > 0) {
            var node = queue.shift();
            var nodeVarInfo = this.typeHelper.getVariableInfo(node);
            if (!nodeVarInfo) {
                console.log("WARNING: Cannot find references for " + node.getText());
                continue;
            }
            var refs = this.typeHelper.getVariableInfo(node).references;
            var returned = false;
            for (var _i = 0, refs_1 = refs; _i < refs_1.length; _i++) {
                var ref = refs_1[_i];
                var parentNode = this.findParentFunctionNode(ref);
                if (!parentNode)
                    scope = "main";
                if (ref.parent && ref.parent.kind == ts.SyntaxKind.BinaryExpression) {
                    var binaryExpr = ref.parent;
                    if (binaryExpr.operatorToken.kind == ts.SyntaxKind.FirstAssignment && binaryExpr.left.pos == ref.pos)
                        isSimple = false;
                }
                if (ref.parent && ref.parent.kind == ts.SyntaxKind.CallExpression) {
                    var call = ref.parent;
                    if (call.expression.kind == ts.SyntaxKind.Identifier && call.expression.pos == ref.pos) {
                        console.log(varIdent.getText() + " -> Found function call!");
                        if (scope !== "main") {
                            var funcNode = this.findParentFunctionNode(call);
                            scope = funcNode && funcNode.pos + 1 || "main";
                            isSimple = false;
                        }
                        this.addIfFoundInAssignment(varIdent, call, queue);
                    }
                    else {
                        var symbol = this.typeChecker.getSymbolAtLocation(call.expression);
                        if (!symbol) {
                            if (call.expression.getText() != "console.log") {
                                console.log(varIdent.getText() + " -> Detected passing to external function " + call.expression.getText() + ". Scope changed to main.");
                                scope = "main";
                                isSimple = false;
                            }
                        }
                        else {
                            var funcDecl = symbol.valueDeclaration;
                            for (var i = 0; i < call.arguments.length; i++) {
                                if (call.arguments[i].kind == ts.SyntaxKind.Identifier && call.arguments[i].getText() == node.getText()) {
                                    console.log(varIdent.getText() + " -> Found passing to function " + call.expression.getText() + " as parameter " + funcDecl.parameters[i].name.getText());
                                    queue.push(funcDecl.parameters[i].name);
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
                    this.addIfFoundInAssignment(varIdent, ref, queue);
            }
        }
        var scopeInfo = { varPos: varPos, varId: varId, declIdent: varIdent, scopeId: scope, symbolId: varId, simple: isSimple };
        this.scopes[scope] = this.scopes[scope] || [];
        this.scopes[scope].push(scopeInfo);
        this.scopesOfVariables[varPos] = scopeInfo;
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
                // TODO: process non-identifier left hand side expressions
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
    MemoryManager.prototype.getSymbolId = function (node) {
        return this.typeChecker.getSymbolAtLocation(node)["id"];
    };
    return MemoryManager;
}());
exports.MemoryManager = MemoryManager;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],4:[function(require,module,exports){
(function (global){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require('../template');
var types_1 = require('../types');
var expressions_1 = require('./expressions');
var AssignmentHelper = (function () {
    function AssignmentHelper() {
    }
    AssignmentHelper.create = function (scope, left, right) {
        var accessor = new expressions_1.CElementAccess(scope, left);
        var varType = scope.root.typeHelper.getCType(left);
        return new CAssignment(scope, accessor, null, varType, right);
    };
    return AssignmentHelper;
}());
exports.AssignmentHelper = AssignmentHelper;
var CAssignment = (function () {
    function CAssignment(scope, accessor, argumentExpression, type, right) {
        var _this = this;
        this.accessor = accessor;
        this.argumentExpression = argumentExpression;
        this.isObjLiteralAssignment = false;
        this.isArrayLiteralAssignment = false;
        this.isDynamicArray = false;
        this.isStaticArray = false;
        this.isStruct = false;
        this.isDict = false;
        this.isSimpleVar = typeof type === 'string';
        this.isDynamicArray = type instanceof types_1.ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof types_1.ArrayType && !type.isDynamicArray;
        this.isDict = type instanceof types_1.StructType && type.isDict;
        this.isStruct = type instanceof types_1.StructType && !type.isDict;
        this.nodeText = right.getText();
        if (right.kind == ts.SyntaxKind.ObjectLiteralExpression) {
            this.isObjLiteralAssignment = true;
            var objLiteral = right;
            this.objInitializers = objLiteral.properties
                .filter(function (p) { return p.kind == ts.SyntaxKind.PropertyAssignment; })
                .map(function (p) { return p; })
                .map(function (p) { return new CAssignment(scope, _this.accessor, p.name.getText(), type, p.initializer); });
        }
        else if (right.kind == ts.SyntaxKind.ArrayLiteralExpression) {
            this.isArrayLiteralAssignment = true;
            var arrLiteral = right;
            this.arrayLiteralSize = arrLiteral.elements.length;
            this.arrInitializers = arrLiteral.elements.map(function (e, i) { return new CAssignment(scope, _this.accessor, "" + i, type, e); });
        }
        else
            this.expression = expressions_1.ExpressionHelper.create(scope, right);
    }
    CAssignment = __decorate([
        template_1.CodeTemplate("\n{#if isObjLiteralAssignment}\n    {objInitializers}\n{#elseif isArrayLiteralAssignment}\n    {arrInitializers}\n{#elseif isDynamicArray && argumentExpression == null}\n    {accessor} = ((void *){expression});\n\n{#elseif argumentExpression == null}\n    {accessor} = {expression};\n\n{#elseif isStruct}\n    {accessor}->{argumentExpression} = {expression};\n\n{#elseif isDict}\n    DICT_SET({accessor}, {argumentExpression}, {expression});\n\n{#elseif isDynamicArray}\n    {accessor}->data[{argumentExpression}] = {expression};\n\n{#elseif isStaticArray}\n    {accessor}[{argumentExpression}] = {expression};\n\n{#else}\n    /* Unsupported assignment {accessor}[{argumentExpression}] = {nodeText} */;\n\n{/if}")
    ], CAssignment);
    return CAssignment;
}());
exports.CAssignment = CAssignment;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":11,"../types":12,"./expressions":5}],5:[function(require,module,exports){
(function (global){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require('../template');
var types_1 = require('../types');
var assignment_1 = require('./assignment');
var printf_1 = require('./printf');
var variable_1 = require('./variable');
var ExpressionHelper = (function () {
    function ExpressionHelper() {
    }
    ExpressionHelper.create = function (scope, node) {
        if (typeof node === 'string')
            return node;
        switch (node.kind) {
            case ts.SyntaxKind.ElementAccessExpression:
            case ts.SyntaxKind.PropertyAccessExpression:
                return new CElementAccess(scope, node);
            case ts.SyntaxKind.CallExpression:
                return new CCallExpression(scope, node);
            case ts.SyntaxKind.BinaryExpression:
                var binaryExpr = node;
                if (binaryExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken)
                    return assignment_1.AssignmentHelper.create(scope, binaryExpr.left, binaryExpr.right);
                else
                    return new CBinaryExpression(scope, binaryExpr);
            case ts.SyntaxKind.ArrayLiteralExpression:
                return ArrayLiteralHelper.create(scope, node);
            case ts.SyntaxKind.StringLiteral:
                return new CString(node.getText());
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.Identifier:
                return node.getText();
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
                return new CUnaryExpression(scope, node);
            case ts.SyntaxKind.ConditionalExpression:
                return new CTernaryExpression(scope, node);
            default:
                return "/* unsupported expression " + node.getText() + " */";
        }
    };
    return ExpressionHelper;
}());
exports.ExpressionHelper = ExpressionHelper;
var CCallExpression = (function () {
    function CCallExpression(scope, call) {
        this.type = "call";
        this.funcName = call.expression.getText();
        if (this.funcName != "console.log")
            this.arguments = call.arguments.map(function (a) { return ExpressionHelper.create(scope, a); });
        if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
            var propAccess = call.expression;
            if (this.funcName == "console.log") {
                this.type = "printf";
                this.printfCalls = call.arguments.map(function (a) { return printf_1.PrintfHelper.create(scope, a); });
                scope.root.headerFlags.printf = true;
            }
            if (propAccess.name.getText() == 'push' && this.arguments.length == 1) {
                if (call.parent.kind == ts.SyntaxKind.ExpressionStatement) {
                    this.type = "array";
                    this.funcName = "ARRAY_PUSH";
                    this.arrayAccess = new CElementAccess(scope, propAccess.expression);
                }
                else {
                    // ARRAY_PUSH cannot be used as expression directly, because it is a macros
                    // containing several statements, so let's push it separately into scope
                    // statements, and replace it's occurence in expression with array size
                    this.type = "array_size";
                    scope.statements.push(new CCallExpression(scope, call));
                }
                scope.root.headerFlags.array = true;
            }
            if (propAccess.name.getText() == 'pop' && this.arguments.length == 0) {
                this.type = "array";
                this.funcName = "ARRAY_POP";
                this.arrayAccess = new CElementAccess(scope, propAccess.expression);
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.array_pop = true;
            }
        }
    }
    CCallExpression = __decorate([
        template_1.CodeTemplate("\n{#if type == \"call\"}\n    {funcName}({arguments {, }=> {this}})\n{/if}\n{#if type == \"array\"}\n    {funcName}({arrayAccess}{arguments => , {this}})\n{/if}\n{#if type == \"array_size\"}\n    {arrayAccess}->size\n{/if}\n{#if type == \"printf\"}\n    {printfCalls}\n{/if}")
    ], CCallExpression);
    return CCallExpression;
}());
exports.CCallExpression = CCallExpression;
var CBinaryExpression = (function () {
    function CBinaryExpression(scope, node) {
        this.replacedWithCall = false;
        this.replacedWithVar = false;
        var operatorMap = {};
        var callReplaceMap = {};
        var leftType = scope.root.typeHelper.getCType(node.left);
        var rightType = scope.root.typeHelper.getCType(node.right);
        this.left = ExpressionHelper.create(scope, node.left);
        this.right = ExpressionHelper.create(scope, node.right);
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
        }
        else if (leftType == types_1.StringVarType && rightType == types_1.StringVarType) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['strcmp', ' == 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['strcmp', ' == 0'];
            if (callReplaceMap[node.operatorToken.kind])
                scope.root.headerFlags.strings = true;
            if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
                var tempVarName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_string");
                if (this.left["resolve"])
                    this.left = this.left["resolve"]();
                if (this.right["resolve"])
                    this.right = this.right["resolve"]();
                // TODO: free
                scope.variables.push(new variable_1.CVariable(scope, tempVarName, "char *"));
                scope.statements.push(tempVarName + " = malloc(strlen(" + this.left + ") + strlen(" + this.right + ") + 1);\n");
                scope.statements.push("assert(" + tempVarName + " != NULL);\n");
                scope.statements.push("strcpy(" + tempVarName + ", " + this.left + ");\n");
                scope.statements.push("strcat(" + tempVarName + ", " + this.right + ");\n");
                this.replacedWithVar = true;
                this.replacementVarName = tempVarName;
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
            if (callReplaceMap[node.operatorToken.kind]) {
                scope.root.headerFlags.str_int16_t_cmp = true;
                // str_int16_t_cmp expects certain order of arguments (string, number)
                if (leftType == types_1.NumberVarType) {
                    var tmp = this.left;
                    this.left = this.right;
                    this.right = tmp;
                }
            }
            if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
                var tempVarName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_string");
                if (this.left["resolve"])
                    this.left = this.left["resolve"]();
                if (this.right["resolve"])
                    this.right = this.right["resolve"]();
                // TODO: free
                var num = leftType == types_1.NumberVarType ? this.left : this.right;
                var str = leftType == types_1.StringVarType ? this.left : this.right;
                scope.variables.push(new variable_1.CVariable(scope, tempVarName, "char *"));
                scope.statements.push(tempVarName + " = malloc(strlen(" + str + ") + STR_INT16_T_BUFLEN + 1);\n");
                scope.statements.push("assert(" + tempVarName + " != NULL);\n");
                scope.statements.push(tempVarName + "[0] = '\\0';\n");
                var strcatNumber = "str_int16_t_cat(" + tempVarName + ", " + num + ");\n";
                var strcatString = "strcat(" + tempVarName + ", " + str + ");\n";
                if (leftType == types_1.NumberVarType) {
                    scope.statements.push(strcatNumber);
                    scope.statements.push(strcatString);
                }
                else {
                    scope.statements.push(strcatString);
                    scope.statements.push(strcatNumber);
                }
                this.replacedWithVar = true;
                this.replacementVarName = tempVarName;
                scope.root.headerFlags.strings = true;
                scope.root.headerFlags.malloc = true;
                scope.root.headerFlags.str_int16_t_cat = true;
            }
        }
        this.operator = operatorMap[node.operatorToken.kind];
        if (callReplaceMap[node.operatorToken.kind]) {
            this.replacedWithCall = true;
            _a = callReplaceMap[node.operatorToken.kind], this.call = _a[0], this.callCondition = _a[1];
        }
        this.nodeText = node.getText();
        var _a;
    }
    CBinaryExpression = __decorate([
        template_1.CodeTemplate("\n{#if operator}\n    {left} {operator} {right}\n{#elseif replacedWithCall}\n    {call}({left}, {right}){callCondition}\n{#elseif replacedWithVar}\n    {replacementVarName}\n{#else}\n    /* unsupported expression {nodeText} */\n{/if}")
    ], CBinaryExpression);
    return CBinaryExpression;
}());
var CUnaryExpression = (function () {
    function CUnaryExpression(scope, node) {
        this.replacedWithCall = false;
        var operatorMap = {};
        var callReplaceMap = {};
        var type = scope.root.typeHelper.getCType(node.operand);
        if (type == types_1.NumberVarType) {
            operatorMap[ts.SyntaxKind.PlusPlusToken] = '++';
            operatorMap[ts.SyntaxKind.MinusMinusToken] = '--';
            operatorMap[ts.SyntaxKind.ExclamationToken] = '!';
            callReplaceMap[ts.SyntaxKind.PlusToken] = ["atoi", ""];
            if (callReplaceMap[node.operator])
                scope.root.headerFlags.atoi = true;
        }
        this.operator = operatorMap[node.operator];
        if (callReplaceMap[node.operator]) {
            this.replacedWithCall = true;
            _a = callReplaceMap[node.operator], this.call = _a[0], this.callCondition = _a[1];
        }
        this.operand = ExpressionHelper.create(scope, node.operand);
        this.isPostfix = node.kind == ts.SyntaxKind.PostfixUnaryExpression;
        this.nodeText = node.getText();
        var _a;
    }
    CUnaryExpression = __decorate([
        template_1.CodeTemplate("\n{#if isPostfix && operator}\n    {operand}{operator}\n{#elseif !isPostfix && operator}\n    {operator}{operand}\n{#elseif replacedWithCall}\n    {call}({operand}){callCondition}\n{#else}\n    /* unsupported expression {nodeText} */\n{/if}")
    ], CUnaryExpression);
    return CUnaryExpression;
}());
var CTernaryExpression = (function () {
    function CTernaryExpression(scope, node) {
        this.condition = ExpressionHelper.create(scope, node.condition);
        this.whenTrue = ExpressionHelper.create(scope, node.whenTrue);
        this.whenFalse = ExpressionHelper.create(scope, node.whenFalse);
    }
    CTernaryExpression = __decorate([
        template_1.CodeTemplate("{condition} ? {whenTrue} : {whenFalse}")
    ], CTernaryExpression);
    return CTernaryExpression;
}());
var ArrayLiteralHelper = (function () {
    function ArrayLiteralHelper() {
    }
    ArrayLiteralHelper.create = function (scope, node) {
        var arrSize = node.elements.length;
        if (arrSize == 0) {
            return "/* Empty array is not supported inside expressions */";
        }
        var varName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_array");
        var type = scope.root.typeHelper.getCType(node);
        if (type instanceof types_1.ArrayType) {
            var canUseInitializerList = node.elements.every(function (e) { return e.kind == ts.SyntaxKind.NumericLiteral || e.kind == ts.SyntaxKind.StringLiteral; });
            if (!type.isDynamicArray && canUseInitializerList) {
                var s = "{ ";
                for (var i = 0; i < arrSize; i++) {
                    if (i != 0)
                        s += ", ";
                    var cExpr = ExpressionHelper.create(scope, node.elements[i]);
                    s += typeof cExpr === 'string' ? cExpr : cExpr.resove();
                }
                s += " }";
                scope.variables.push(new variable_1.CVariable(scope, varName, type, { initializer: s }));
            }
            else {
                scope.variables.push(new variable_1.CVariable(scope, varName, type));
                if (type.isDynamicArray) {
                    scope.root.headerFlags.array = true;
                    scope.statements.push("ARRAY_CREATE(" + varName + ", " + arrSize + ", " + arrSize + ");\n");
                }
                for (var i = 0; i < arrSize; i++) {
                    var assignment = new assignment_1.CAssignment(scope, varName, i + "", type, node.elements[i]);
                    scope.statements.push(assignment);
                }
            }
            return type.isDynamicArray ? "((void *)" + varName + ")" : varName;
        }
        else
            return "/* Unsupported use of array literal expression */";
    };
    return ArrayLiteralHelper;
}());
var CElementAccess = (function () {
    function CElementAccess(scope, node) {
        this.isDynamicArray = false;
        this.isStaticArray = false;
        this.isStruct = false;
        this.isDict = false;
        this.argumentExpression = null;
        var type = null;
        if (node.kind == ts.SyntaxKind.Identifier) {
            type = scope.root.typeHelper.getCType(node);
            this.elementAccess = node.getText();
        }
        else if (node.kind == ts.SyntaxKind.PropertyAccessExpression) {
            var propAccess = node;
            type = scope.root.typeHelper.getCType(propAccess.expression);
            if (propAccess.expression.kind == ts.SyntaxKind.Identifier)
                this.elementAccess = propAccess.expression.getText();
            else
                this.elementAccess = new CElementAccess(scope, propAccess.expression);
            this.argumentExpression = propAccess.name.getText();
        }
        else if (node.kind == ts.SyntaxKind.ElementAccessExpression) {
            var elemAccess = node;
            type = scope.root.typeHelper.getCType(elemAccess.expression);
            if (elemAccess.expression.kind == ts.SyntaxKind.Identifier)
                this.elementAccess = elemAccess.expression.getText();
            else
                this.elementAccess = new CElementAccess(scope, elemAccess.expression);
            if (elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                var ident = elemAccess.argumentExpression.getText().slice(1, -1);
                if (ident.search(/^[_A-Za-z][_A-Za-z0-9]*$/) > -1)
                    this.argumentExpression = ident;
                else
                    this.argumentExpression = ExpressionHelper.create(scope, elemAccess.argumentExpression);
            }
            else
                this.argumentExpression = ExpressionHelper.create(scope, elemAccess.argumentExpression);
        }
        this.isSimpleVar = typeof type === 'string' && type != types_1.UniversalVarType && type != types_1.PointerVarType;
        this.isDynamicArray = type instanceof types_1.ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof types_1.ArrayType && !type.isDynamicArray;
        this.arrayCapacity = type instanceof types_1.ArrayType && !type.isDynamicArray && type.capacity + "";
        this.isDict = type instanceof types_1.StructType && type.isDict;
        this.isStruct = type instanceof types_1.StructType && !type.isDict;
        this.nodeText = node.getText();
    }
    CElementAccess = __decorate([
        template_1.CodeTemplate("\n{#if isSimpleVar || argumentExpression == null}\n    {elementAccess}\n{#elseif isDynamicArray && argumentExpression == 'length'}\n    {elementAccess}->size\n{#elseif isDynamicArray}\n    {elementAccess}->data[{argumentExpression}]\n{#elseif isStaticArray && argumentExpression == 'length'}\n    {arrayCapacity}\n{#elseif isStaticArray}\n    {elementAccess}[{argumentExpression}]\n{#elseif isStruct}\n    {elementAccess}->{argumentExpression}\n{#elseif isDict}\n    DICT_GET({elementAccess}, {argumentExpression})\n{#else}\n    /* Unsupported left hand side expression {nodeText} */\n{/if}")
    ], CElementAccess);
    return CElementAccess;
}());
exports.CElementAccess = CElementAccess;
var CString = (function () {
    function CString(value) {
        if (value.indexOf("'") == 0)
            this.value = '"' + value.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            this.value = value;
    }
    CString.prototype.resolve = function () {
        return this.value;
    };
    return CString;
}());
exports.CString = CString;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":11,"../types":12,"./assignment":4,"./printf":7,"./variable":9}],6:[function(require,module,exports){
(function (global){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require('../template');
var types_1 = require('../types');
var statements_1 = require('./statements');
var variable_1 = require('./variable');
var CFunction = (function () {
    function CFunction(root, funcDecl) {
        var _this = this;
        this.root = root;
        this.parameters = [];
        this.variables = [];
        this.statements = [];
        this.parent = root;
        var signature = root.typeChecker.getSignatureFromDeclaration(funcDecl);
        this.name = funcDecl.name.getText();
        this.returnType = root.typeHelper.getTypeString(signature.getReturnType());
        this.parameters = signature.parameters.map(function (p) { return new variable_1.CVariable(_this, p.name, p, { removeStorageSpecifier: true }); });
        this.variables = [];
        this.gcVarName = root.memoryManager.getGCVariableForScope(funcDecl);
        if (this.gcVarName)
            root.variables.push(new variable_1.CVariable(this, this.gcVarName, new types_1.ArrayType("void *", 0, true)));
        funcDecl.body.statements.forEach(function (s) { return statements_1.StatementProcessor.process(s, _this); });
        if (funcDecl.body.statements[funcDecl.body.statements.length - 1].kind != ts.SyntaxKind.ReturnStatement) {
            this.destructors = new variable_1.CVariableDestructors(this, funcDecl);
        }
    }
    CFunction = __decorate([
        template_1.CodeTemplate("\n{returnType} {name}({parameters {, }=> {this}})\n{\n    {variables  {    }=> {this};\n}\n    {#if gcVarName}\n        ARRAY_CREATE({gcVarName}, 2, 0);\n    {/if}\n\n    {statements {    }=> {this}}\n\n    {destructors}\n}")
    ], CFunction);
    return CFunction;
}());
exports.CFunction = CFunction;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":11,"../types":12,"./statements":8,"./variable":9}],7:[function(require,module,exports){
(function (global){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require('../template');
var types_1 = require('../types');
var expressions_1 = require('./expressions');
var variable_1 = require('./variable');
var PrintfHelper = (function () {
    function PrintfHelper() {
    }
    PrintfHelper.create = function (scope, printNode) {
        var type = scope.root.typeHelper.getCType(printNode);
        var nodeExpression = expressions_1.ExpressionHelper.create(scope, printNode);
        var accessor = nodeExpression["resolve"] ? nodeExpression["resolve"]() : nodeExpression;
        var options = {
            emitCR: true
        };
        return new CPrintf(scope, printNode, accessor, type, options);
    };
    return PrintfHelper;
}());
exports.PrintfHelper = PrintfHelper;
var CPrintf = (function () {
    function CPrintf(scope, printNode, accessor, varType, options) {
        this.accessor = accessor;
        this.isStringLiteral = false;
        this.isQuotedCString = false;
        this.isCString = false;
        this.isInteger = false;
        this.isBoolean = false;
        this.isStruct = false;
        this.isArray = false;
        this.elementPrintfs = [];
        this.propPrefix = '';
        this.CR = '';
        this.INDENT = '';
        this.isStringLiteral = varType == types_1.StringVarType && printNode.kind == ts.SyntaxKind.StringLiteral;
        this.isQuotedCString = varType == types_1.StringVarType && options.quotedString;
        this.isCString = varType == types_1.StringVarType && !options.quotedString;
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
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, "int16_t"));
            scope.root.headerFlags.int16_t = true;
            this.arraySize = varType.isDynamicArray ? accessor + "->size" : varType.capacity + "";
            var elementAccessor = accessor + (varType.isDynamicArray ? "->data" : "") + "[" + this.iteratorVarName + "]";
            var opts = { quotedString: true, indent: this.INDENT + "    " };
            this.elementPrintfs = [
                new CPrintf(scope, printNode, elementAccessor, varType.elementType, opts)
            ];
        }
        else if (varType instanceof types_1.StructType) {
            this.isStruct = true;
            for (var k in varType.properties) {
                var propAccessor = varType.isDict ? "DICT_GET(" + accessor + ", \"" + k + "\")" : accessor + "->" + k;
                var opts = { quotedString: true, propName: k, indent: this.INDENT + "    " };
                this.elementPrintfs.push(new CPrintf(scope, printNode, propAccessor, varType.properties[k], opts));
            }
        }
    }
    CPrintf = __decorate([
        template_1.CodeTemplate("\n{#if isStringLiteral}\n    printf(\"{accessor}{CR}\");\n{#elseif isQuotedCString}\n    printf(\"{propPrefix}\\\"%s\\\"{CR}\", {accessor});\n{#elseif isCString}\n    printf(\"%s{CR}\", {accessor});\n{#elseif isInteger}\n    printf(\"{propPrefix}%d{CR}\", {accessor});\n{#elseif isBoolean && !propPrefix}\n    printf({accessor} ? \"true{CR}\" : \"false{CR}\");\n{#elseif isBoolean && propPrefix}\n    printf(\"{propPrefix}%s\", {accessor} ? \"true{CR}\" : \"false{CR}\");\n{#elseif isStruct}\n    printf(\"{propPrefix}{ \");\n    {INDENT}{elementPrintfs {    printf(\", \");\n    }=> {this}}\n    {INDENT}printf(\" }{CR}\");\n{#elseif isArray}\n    printf(\"{propPrefix}[ \");\n    {INDENT}for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n    {INDENT}    if ({iteratorVarName} != 0)\n    {INDENT}        printf(\", \");\n    {INDENT}    {elementPrintfs}\n    {INDENT}}\n    {INDENT}printf(\" ]{CR}\");\n{#else}\n    printf(/* Unsupported printf expression */);\n{/if}\n")
    ], CPrintf);
    return CPrintf;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":11,"../types":12,"./expressions":5,"./variable":9}],8:[function(require,module,exports){
(function (global){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var template_1 = require('../template');
var types_1 = require('../types');
var function_1 = require('./function');
var variable_1 = require('./variable');
var expressions_1 = require('./expressions');
var CReturnStatement = (function () {
    function CReturnStatement(scope, node) {
        this.expression = expressions_1.ExpressionHelper.create(scope, node.expression);
        this.destructors = new variable_1.CVariableDestructors(scope, node);
        this.needBlock = node.parent && (node.parent.kind == ts.SyntaxKind.IfStatement
            || node.parent.kind == ts.SyntaxKind.ForStatement
            || node.parent.kind == ts.SyntaxKind.WhileStatement);
    }
    CReturnStatement = __decorate([
        template_1.CodeTemplate("\n{#if needBlock}\n    {\n        {destructors}\n        return {expression};\n    }\n{/if}\n{#if !needBlock}\n    {destructors}\n    return {expression};\n{/if}\n")
    ], CReturnStatement);
    return CReturnStatement;
}());
exports.CReturnStatement = CReturnStatement;
var CIfStatement = (function () {
    function CIfStatement(scope, node) {
        this.thenBlock = new CBlock(scope);
        this.elseBlock = new CBlock(scope);
        this.hasElseBlock = !!node.elseStatement;
        this.condition = expressions_1.ExpressionHelper.create(scope, node.expression);
        StatementProcessor.process(node.thenStatement, this.thenBlock);
    }
    CIfStatement = __decorate([
        template_1.CodeTemplate("\nif ({condition})\n{thenBlock}\n{#if hasElseBlock}\n    else\n    {elseBlock}\n{/if}\n")
    ], CIfStatement);
    return CIfStatement;
}());
exports.CIfStatement = CIfStatement;
var CWhileStatement = (function () {
    function CWhileStatement(scope, node) {
        this.block = new CBlock(scope);
        this.condition = expressions_1.ExpressionHelper.create(scope, node.expression);
        StatementProcessor.process(node.statement, this.block);
    }
    CWhileStatement = __decorate([
        template_1.CodeTemplate("\nwhile ({condition})\n{block}")
    ], CWhileStatement);
    return CWhileStatement;
}());
exports.CWhileStatement = CWhileStatement;
var CForStatement = (function () {
    function CForStatement(scope, node) {
        this.block = new CBlock(scope);
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            StatementProcessor.process({ kind: ts.SyntaxKind.VariableStatement, declarationList: node.initializer }, scope);
            this.init = "";
        }
        else
            this.init = expressions_1.ExpressionHelper.create(scope, node.initializer);
        this.condition = expressions_1.ExpressionHelper.create(scope, node.condition);
        this.increment = expressions_1.ExpressionHelper.create(scope, node.incrementor);
        StatementProcessor.process(node.statement, this.block);
    }
    CForStatement = __decorate([
        template_1.CodeTemplate("\nfor ({init};{condition};{increment})\n{block}")
    ], CForStatement);
    return CForStatement;
}());
exports.CForStatement = CForStatement;
var CForOfStatement = (function () {
    function CForOfStatement(scope, node) {
        this.variables = [];
        this.statements = [];
        this.cast = "";
        this.parent = scope;
        this.root = scope.root;
        this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(node);
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, "int16_t"));
        scope.root.headerFlags.int16_t = true;
        this.arrayAccess = new expressions_1.CElementAccess(scope, node.expression);
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
            // this will push the variable declaration to scope.variables
            // we are not using the return value
            new variable_1.CVariableDeclaration(scope, declInit);
            this.init = declInit.name.getText();
        }
        else {
            this.init = new expressions_1.CElementAccess(scope, node.initializer);
        }
        StatementProcessor.process(node.statement, this);
        scope.variables = scope.variables.concat(this.variables);
        this.variables = [];
    }
    CForOfStatement = __decorate([
        template_1.CodeTemplate("\n{#if isDynamicArray}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {arrayAccess}->size; {iteratorVarName}++)\n    {\n        {init} = {cast}{arrayAccess}->data[{iteratorVarName}];\n        {statements {    }=> {this}}\n    }\n{#else}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {arrayCapacity}; {iteratorVarName}++)\n    {\n        {init} = {cast}{arrayAccess}[{iteratorVarName}];\n        {statements {    }=> {this}}\n    }\n{/if}\n")
    ], CForOfStatement);
    return CForOfStatement;
}());
exports.CForOfStatement = CForOfStatement;
var CBlock = (function () {
    function CBlock(scope) {
        this.variables = [];
        this.statements = [];
        this.parent = scope;
        this.root = scope.root;
    }
    CBlock = __decorate([
        template_1.CodeTemplate("\n{#if statements.length > 1 || variables.length > 0}\n    {\n        {variables => {this};\n}\n        {statements {    }=> {this}}\n    }\n{/if}\n{#if statements.length == 1 && variables.length == 0}\n        {statements}\n{/if}\n{#if statements.length == 0 && variables.length == 0}\n        /* no statements */;\n{/if}")
    ], CBlock);
    return CBlock;
}());
exports.CBlock = CBlock;
var StatementProcessor = (function () {
    function StatementProcessor() {
    }
    StatementProcessor.process = function (node, scope) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
                scope.root.functions.push(new function_1.CFunction(scope.root, node));
                break;
            case ts.SyntaxKind.VariableStatement:
                for (var _i = 0, _a = node.declarationList.declarations; _i < _a.length; _i++) {
                    var decl = _a[_i];
                    StatementProcessor.pushStatements(scope, new variable_1.CVariableDeclaration(scope, decl));
                }
                break;
            case ts.SyntaxKind.ReturnStatement:
                StatementProcessor.pushStatements(scope, new CReturnStatement(scope, node));
                break;
            case ts.SyntaxKind.ExpressionStatement:
                StatementProcessor.pushStatements(scope, expressions_1.ExpressionHelper.create(scope, node.expression));
                break;
            case ts.SyntaxKind.IfStatement:
                StatementProcessor.pushStatements(scope, new CIfStatement(scope, node));
                break;
            case ts.SyntaxKind.WhileStatement:
                StatementProcessor.pushStatements(scope, new CWhileStatement(scope, node));
                break;
            case ts.SyntaxKind.ForStatement:
                StatementProcessor.pushStatements(scope, new CForStatement(scope, node));
                break;
            case ts.SyntaxKind.ForOfStatement:
                StatementProcessor.pushStatements(scope, new CForOfStatement(scope, node));
                break;
            case ts.SyntaxKind.Block:
                for (var _b = 0, _c = node.statements; _b < _c.length; _b++) {
                    var s = _c[_b];
                    StatementProcessor.process(s, scope);
                }
                break;
            default:
                scope.statements.push("/* Unsupported statement: " + node.getText().replace(/[\n\s]+/g, ' ') + " */;\n");
        }
    };
    StatementProcessor.pushStatements = function (scope, resolvableValue) {
        var result = resolvableValue.resolve();
        if (result == '')
            return;
        if (result.search(/[;}]\n$/) > -1) {
            for (var _i = 0, _a = result.split('\n'); _i < _a.length; _i++) {
                var line = _a[_i];
                if (line != '')
                    scope.statements.push(line + '\n');
            }
        }
        else {
            scope.statements.push(result + ";\n");
        }
    };
    return StatementProcessor;
}());
exports.StatementProcessor = StatementProcessor;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":11,"../types":12,"./expressions":5,"./function":6,"./variable":9}],9:[function(require,module,exports){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var template_1 = require('../template');
var types_1 = require('../types');
var assignment_1 = require('./assignment');
var CVariableDeclaration = (function () {
    function CVariableDeclaration(scope, varDecl) {
        this.initializer = '';
        var varInfo = scope.root.typeHelper.getVariableInfo(varDecl.name);
        var varType = varInfo.type;
        scope.variables.push(new CVariable(scope, varInfo.name, varInfo.type));
        this.varName = varInfo.name;
        this.needAllocateArray = varType instanceof types_1.ArrayType && varInfo.requiresAllocation;
        this.needAllocate = varInfo.requiresAllocation;
        this.gcVarName = scope.root.memoryManager.getGCVariableForVariable(varDecl, varDecl.pos);
        this.isStruct = varType instanceof types_1.StructType && !varType.isDict;
        this.isDict = varType instanceof types_1.StructType && varType.isDict;
        this.isArray = varType instanceof types_1.ArrayType;
        if (varType instanceof types_1.ArrayType) {
            this.initialCapacity = Math.max(varType.capacity * 2, 4);
            this.size = varType.capacity;
        }
        if (varDecl.initializer)
            this.initializer = assignment_1.AssignmentHelper.create(scope, varDecl.name, varDecl.initializer);
        if (varType == types_1.NumberVarType)
            scope.root.headerFlags.int16_t = true;
        if (this.needAllocate || this.needAllocateArray)
            scope.root.headerFlags.malloc = true;
        if (this.gcVarName || this.needAllocateArray)
            scope.root.headerFlags.array = true;
        if (this.gcVarName)
            scope.root.headerFlags.gc_iterator = true;
    }
    CVariableDeclaration = __decorate([
        template_1.CodeTemplate("\n{#if needAllocateArray}\n    ARRAY_CREATE({varName}, {initialCapacity}, {size});\n{#elseif needAllocate}\n    {varName} = malloc(sizeof(*{varName}));\n    assert({varName} != NULL);\n{/if}\n{#if gcVarName && needAllocateArray}\n    ARRAY_PUSH({gcVarName}, {varName}->data);\n{/if}\n{#if gcVarName && needAllocate}\n    ARRAY_PUSH({gcVarName}, {varName});\n{/if}\n{initializer}")
    ], CVariableDeclaration);
    return CVariableDeclaration;
}());
exports.CVariableDeclaration = CVariableDeclaration;
var CVariableDestructors = (function () {
    function CVariableDestructors(scope, node) {
        var _this = this;
        this.gcVarName = scope.root.memoryManager.getGCVariableForScope(node);
        this.destructors = [];
        scope.root.memoryManager.getDestructorsForScope(node)
            .map(function (d) { return scope.root.typeHelper.getVariableInfo(d); })
            .forEach(function (dv) {
            if (dv.type instanceof types_1.ArrayType)
                _this.destructors.push(dv.name + "->data");
            _this.destructors.push(dv.name);
        });
    }
    CVariableDestructors = __decorate([
        template_1.CodeTemplate("\n{destructors {    }=> free({this});\n}\n{#if gcVarName}\n    for (_gc_i = 0; _gc_i < {gcVarName}->size; _gc_i++)\n            free({gcVarName}->data[_gc_i]);\n        free({gcVarName}->data);\n{/if}")
    ], CVariableDestructors);
    return CVariableDestructors;
}());
exports.CVariableDestructors = CVariableDestructors;
var CVariable = (function () {
    function CVariable(scope, name, typeSource, options) {
        this.typeSource = typeSource;
        var typeString = scope.root.typeHelper.getTypeString(typeSource);
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

},{"../template":11,"../types":12,"./assignment":4}],10:[function(require,module,exports){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var memory_1 = require('./memory');
var types_1 = require('./types');
var template_1 = require('./template');
var statements_1 = require('./nodes/statements');
var variable_1 = require('./nodes/variable');
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
        this.gc_iterator = false;
        this.dict = false;
        this.str_int16_t_cmp = false;
        this.str_int16_t_cat = false;
        this.atoi = false;
    }
    return HeaderFlags;
}());
var CProgram = (function () {
    function CProgram(tsProgram) {
        var _this = this;
        this.parent = null;
        this.root = this;
        this.variables = [];
        this.statements = [];
        this.functions = [];
        this.headerFlags = new HeaderFlags();
        this.typeChecker = tsProgram.getTypeChecker();
        this.typeHelper = new types_1.TypeHelper(this.typeChecker);
        this.memoryManager = new memory_1.MemoryManager(this.typeChecker, this.typeHelper);
        var structs = this.typeHelper.figureOutVariablesAndTypes(tsProgram.getSourceFiles());
        this.userStructs = structs.map(function (s) {
            return {
                name: s.name,
                properties: s.properties.map(function (p) { return new variable_1.CVariable(_this, p.name, p.type, { removeStorageSpecifier: true }); })
            };
        });
        this.memoryManager.preprocess();
        this.gcVarName = this.memoryManager.getGCVariableForScope(null);
        if (this.gcVarName)
            this.variables.push(new variable_1.CVariable(this, this.gcVarName, new types_1.ArrayType("void *", 0, true)));
        tsProgram.getSourceFiles().forEach(function (source) {
            return source.statements.forEach(function (s) { return statements_1.StatementProcessor.process(s, _this); });
        });
        this.destructors = new variable_1.CVariableDestructors(this, null);
    }
    CProgram = __decorate([
        template_1.CodeTemplate("\n{#if headerFlags.strings || headerFlags.str_int16_t_cmp}\n    #include <string.h>\n{/if}\n{#if headerFlags.malloc || headerFlags.atoi || headerFlags.array}\n    #include <stdlib.h>\n{/if}\n{#if headerFlags.malloc || headerFlags.array}\n    #include <assert.h>\n{/if}\n{#if headerFlags.printf}\n    #include <stdio.h>\n{/if}\n{#if headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat}\n    #include <limits.h>\n{/if}\n\n{#if headerFlags.bool}\n    #define TRUE 1\n    #define FALSE 0\n{/if}\n{#if headerFlags.bool || headerFlags.js_var}\n    typedef unsigned char uint8_t;\n{/if}\n{#if headerFlags.int16_t || headerFlags.js_var || headerFlags.array || headerFlags.str_int16_t_cmp}\n    typedef int int16_t;\n{/if}\n\n{#if headerFlags.js_var}\n    enum js_var_type {JS_VAR_BOOL, JS_VAR_INT, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_STRUCT, JS_VAR_DICT};\n\tstruct js_var {\n\t    enum js_var_type type;\n\t    uint8_t bool;\n\t    int16_t number;\n\t    const char *string;\n\t    void *obj;\n\t};\n{/if}\n\n{#if headerFlags.array}\n    #define ARRAY(T) struct {\\\n        int16_t size;\\\n        int16_t capacity;\\\n        T *data;\\\n    } *\n    #define ARRAY_CREATE(array, init_capacity, init_size) {\\\n        array = malloc(sizeof(*array)); \\\n        array->data = malloc(init_capacity * sizeof(*array->data)); \\\n        assert(array->data != NULL); \\\n        array->capacity = init_capacity; \\\n        array->size = init_size; \\\n    }\n    #define ARRAY_PUSH(array, item) {\\\n        if (array->size == array->capacity) {  \\\n            array->capacity *= 2;  \\\n            array->data = realloc(array->data, array->capacity * sizeof(*array->data)); \\\n        }  \\\n        array->data[array->size++] = item; \\\n    }\n{/if}\n{#if headerFlags.array_pop}\n\t#define ARRAY_POP(a) (a->size != 0 ? a->data[--a->size] : 0)\n{/if}\n\n{#if headerFlags.dict}\n    #define DICT_GET(dict, prop) /* Dictionaries aren't supported yet. */\n    #define DICT_SET(dict, prop, value) /* Dictionaries aren't supported yet. */\n{/if}\n\n{#if headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat}\n    #define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)\n{/if}\n{#if headerFlags.str_int16_t_cmp}\n    int str_int16_t_cmp(const char *str, int16_t num) {\n        char numstr[STR_INT16_T_BUFLEN];\n        sprintf(numstr, \"%d\", num);\n        return strcmp(str, numstr);\n    }\n{/if}\n{#if headerFlags.str_int16_t_cat}\n    void str_int16_t_cat(char *str, int16_t num) {\n        char numstr[STR_INT16_T_BUFLEN];\n        sprintf(numstr, \"%d\", num);\n        strcat(str, numstr);\n    }\n{/if}\n\n{#if headerFlags.gc_iterator}\n    int16_t _gc_i;\n{/if}\n\n{userStructs => struct {name} {\n    {properties => {this};}\n};\n}\n\n{variables => {this};\n}\n\n{functions => {this}\n}\n\nint main(void) {\n    {#if gcVarName}\n        ARRAY_CREATE({gcVarName}, 2, 0);\n    {/if}\n\n    {statements {    }=> {this}}\n\n    {destructors}\n    return 0;\n}")
    ], CProgram);
    return CProgram;
}());
exports.CProgram = CProgram;

},{"./memory":3,"./nodes/statements":8,"./nodes/variable":9,"./template":11,"./types":12}],11:[function(require,module,exports){
"use strict";
function CodeTemplate(tempString) {
    return function (target) {
        return function () {
            var self = this;
            self.resolve = function () {
                return processTemplate(tempString, self);
            };
            return target.apply(self, arguments);
        };
    };
}
exports.CodeTemplate = CodeTemplate;
function processTemplate(template, args) {
    if (typeof args === "string")
        return template.replace("{this}", args);
    ;
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
    var _loop_1 = function() {
        if (k == "resolve")
            return "continue";
        if (args[k] && args[k].push) {
            var pos = template.indexOf("{" + k + '}');
            if (pos == -1)
                pos = template.indexOf("{" + k + ' ');
            else {
                var elementsResolved_1 = args[k].map(function (e) { return processTemplate("{this}", e); }).join('');
                template = template.slice(0, pos) + elementsResolved_1 + template.slice(pos + k.length + 2);
                replaced = true;
                return "continue";
            }
            if (pos == -1)
                pos = template.indexOf("{" + k + '=');
            if (pos == -1)
                pos = template.indexOf("{" + k + '{');
            if (pos == -1)
                return "continue";
            var startPos = pos;
            pos += k.length + 1;
            while (template[pos] == ' ')
                pos++;
            var separator = '';
            if (template[pos] == '{') {
                pos++;
                while (template[pos] != '}' && pos < template.length) {
                    separator += template[pos];
                    pos++;
                }
                pos++;
            }
            if (pos >= template.length - 2 || template[pos] !== "=" || template[pos + 1] !== ">")
                throw new Error("Internal error: incorrect template format for array " + k + ".");
            pos += 2;
            if (template[pos] == ' ' && template[pos + 1] != ' ')
                pos++;
            var curlyBracketCounter = 1;
            var elementTemplateStart = pos;
            while (curlyBracketCounter > 0) {
                if (pos == template.length)
                    throw new Error("Internal error: incorrect template format for array " + k + ".");
                if (template[pos] == '{')
                    curlyBracketCounter++;
                if (template[pos] == '}')
                    curlyBracketCounter--;
                pos++;
            }
            var elementTemplate_1 = template.slice(elementTemplateStart, pos - 1);
            var elementsResolved = void 0;
            elementsResolved = args[k].map(function (e) { return processTemplate(elementTemplate_1, e); }).join(separator);
            if (args[k].length == 0) {
                while (pos < template.length && template[pos] == ' ')
                    pos++;
                while (pos < template.length && template[pos] == '\n')
                    pos++;
                while (startPos > 0 && template[startPos - 1] == ' ')
                    startPos--;
                while (startPos > 0 && template[startPos - 1] == '\n')
                    startPos--;
                if (template[startPos] == '\n')
                    startPos++;
            }
            template = template.slice(0, startPos) + elementsResolved + template.slice(pos);
            replaced = true;
        }
        else
            while (template.indexOf("{" + k + "}") > -1) {
                var value = args[k];
                if (value && value.resolve)
                    value = value.resolve();
                template = template.replace("{" + k + "}", value);
                replaced = true;
            }
    };
    for (var k in args) {
        var state_1 = _loop_1();
        if (state_1 === "continue") continue;
    }
    if (args["resolve"] && !replaced && template.indexOf("{this}") > -1) {
        template = template.replace("{this}", args["resolve"]());
    }
    return template.replace(/^[\n]*/, '').replace(/\n\s*\n[\n\s]*\n/g, '\n\n');
}

},{}],12:[function(require,module,exports){
(function (global){
"use strict";
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
exports.UniversalVarType = "struct js_var *";
exports.PointerVarType = "void *";
exports.StringVarType = "const char *";
exports.NumberVarType = "int16_t";
exports.BooleanVarType = "uint8_t";
var TypePromise = (function () {
    function TypePromise(associatedNode, element) {
        this.associatedNode = associatedNode;
        this.element = element;
        this.resolved = false;
        this.arrayOf = false;
    }
    return TypePromise;
}());
var ArrayType = (function () {
    function ArrayType(elementType, capacity, isDynamicArray) {
        this.elementType = elementType;
        this.capacity = capacity;
        this.isDynamicArray = isDynamicArray;
    }
    ArrayType.prototype.getText = function () {
        var elementType = this.elementType;
        var elementTypeText;
        if (typeof elementType === 'string') {
            elementTypeText = elementType;
        }
        else if (elementType instanceof ArrayType) {
            elementTypeText = elementType.getText();
        }
        else {
            if (elementType.isDict)
                elementTypeText = exports.PointerVarType;
            else
                elementTypeText = elementType.text;
        }
        if (this.isDynamicArray)
            return "ARRAY(" + elementTypeText + ")";
        else
            return "static " + elementTypeText + " {var}[" + this.capacity + "]";
    };
    return ArrayType;
}());
exports.ArrayType = ArrayType;
var StructType = (function () {
    function StructType(text, properties, isDict) {
        this.text = text;
        this.properties = properties;
        this.isDict = isDict;
    }
    return StructType;
}());
exports.StructType = StructType;
var VariableInfo = (function () {
    function VariableInfo() {
        /** Contains all references to this variable */
        this.references = [];
    }
    return VariableInfo;
}());
exports.VariableInfo = VariableInfo;
/** Internal class for storing temporary variable details */
var VariableData = (function () {
    function VariableData() {
        this.assignmentTypes = {};
        this.typePromises = [];
        this.addedProperties = {};
        this.propertiesAssigned = false;
    }
    return VariableData;
}());
var TypeHelper = (function () {
    function TypeHelper(typeChecker) {
        this.typeChecker = typeChecker;
        this.userStructs = {};
        this.variables = {};
        this.variablesData = {};
        this.functionCallsData = {};
        this.arrayLiteralsTypes = {};
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
        return Object.keys(this.userStructs).map(function (k) {
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
    TypeHelper.prototype.getCType = function (node) {
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
                    else if (parentObjectType instanceof StructType && elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral)
                        return parentObjectType.properties[elemAccess.argumentExpression.getText().slice(1, -1)];
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
                    return null;
                }
            case ts.SyntaxKind.CallExpression:
                {
                    var call = node;
                    if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                        var propAccess = call.expression;
                        if (propAccess.name.getText() == 'pop' && call.arguments.length == 0) {
                            var arrType = this.getCType(propAccess.expression);
                            if (arrType && arrType instanceof ArrayType)
                                return arrType.elementType;
                        }
                    }
                    return null;
                }
            case ts.SyntaxKind.ArrayLiteralExpression:
                return this.arrayLiteralsTypes[node.pos];
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
    /** Get information of variable specified by ts.Identifier */
    TypeHelper.prototype.getVariableInfo = function (node) {
        var ident = node;
        var symbol = this.typeChecker.getSymbolAtLocation(ident);
        if (symbol != null)
            return this.variables[symbol.valueDeclaration.pos];
        else
            return null;
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
            return source.text;
        else if (typeof source === 'string')
            return source;
        else
            throw new Error("Unrecognized type source");
    };
    /** Convert ts.Type to CType */
    /** Used mostly during type preprocessing stage */
    TypeHelper.prototype.convertType = function (tsType, ident) {
        if (!tsType || tsType.flags == ts.TypeFlags.Void)
            return "void";
        if (tsType.flags == ts.TypeFlags.String)
            return exports.StringVarType;
        if (tsType.flags == ts.TypeFlags.Number)
            return exports.NumberVarType;
        if (tsType.flags == ts.TypeFlags.Boolean)
            return exports.BooleanVarType;
        if (tsType.flags & ts.TypeFlags.ObjectType && tsType.getProperties().length > 0) {
            return this.generateStructure(tsType, ident);
        }
        if (tsType.flags == ts.TypeFlags.Any)
            return exports.PointerVarType;
        console.log("Non-standard type: " + this.typeChecker.typeToString(tsType));
        return exports.UniversalVarType;
    };
    TypeHelper.prototype.addNewIteratorVariable = function (scope) {
        var parentFunc = this.findParentFunction(scope);
        var scopeId = parentFunc && parentFunc.pos + 1 || 'main';
        var existingSymbolNames = this.typeChecker.getSymbolsInScope(scope, ts.SymbolFlags.Variable).map(function (s) { return s.name; });
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
    TypeHelper.prototype.addNewTemporaryVariable = function (scope, proposedName) {
        var parentFunc = this.findParentFunction(scope);
        var scopeId = parentFunc && parentFunc.pos + 1 || 'main';
        var existingSymbolNames = this.typeChecker.getSymbolsInScope(scope, ts.SymbolFlags.Variable).map(function (s) { return s.name; });
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
    TypeHelper.prototype.findVariablesRecursively = function (node) {
        var _this = this;
        if (node.kind == ts.SyntaxKind.CallExpression) {
            var call = node;
            if (call.expression.kind == ts.SyntaxKind.Identifier) {
                var funcSymbol = this.typeChecker.getSymbolAtLocation(call.expression);
                if (funcSymbol != null) {
                    var funcDeclPos = funcSymbol.valueDeclaration.pos + 1;
                    for (var i = 0; i < call.arguments.length; i++) {
                        var determinedType = this.determineType(null, call.arguments[i]);
                        var callData = this.functionCallsData[funcDeclPos] || [];
                        this.functionCallsData[funcDeclPos] = callData;
                        if (!callData[i] || callData[i] == exports.UniversalVarType || callData[i] instanceof TypePromise)
                            callData[i] = determinedType;
                    }
                }
            }
        }
        if (node.kind == ts.SyntaxKind.Identifier) {
            var symbol = this.typeChecker.getSymbolAtLocation(node);
            if (!symbol) {
                return;
            }
            var varPos = symbol.valueDeclaration.pos;
            if (!this.variables[varPos]) {
                this.variables[varPos] = new VariableInfo();
                this.variablesData[varPos] = new VariableData();
                this.variables[varPos].name = node.getText();
                this.variables[varPos].declaration = symbol.declarations[0];
                this.variablesData[varPos].tsType = this.typeChecker.getTypeAtLocation(node);
            }
            var varInfo = this.variables[varPos];
            var varData = this.variablesData[varPos];
            varInfo.references.push(node);
            if (node.parent && node.parent.kind == ts.SyntaxKind.VariableDeclaration) {
                var varDecl = node.parent;
                if (varDecl.name.getText() == node.getText()) {
                    this.addTypeToVariable(varPos, varDecl.name, varDecl.initializer);
                    if (varDecl.initializer && varDecl.initializer.kind == ts.SyntaxKind.ObjectLiteralExpression)
                        varData.propertiesAssigned = true;
                    if (varDecl.initializer && varDecl.initializer.kind == ts.SyntaxKind.ArrayLiteralExpression)
                        varData.propertiesAssigned = true;
                    if (varDecl.parent && varDecl.parent.parent && varDecl.parent.parent.kind == ts.SyntaxKind.ForOfStatement) {
                        var forOfStatement = varDecl.parent.parent;
                        if (forOfStatement.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
                            var forOfInitializer = forOfStatement.initializer;
                            if (forOfInitializer.declarations[0].pos == varDecl.pos) {
                                varData.typePromises.push(new TypePromise(forOfStatement.expression, true));
                            }
                        }
                    }
                }
            }
            else if (node.parent && node.parent.kind == ts.SyntaxKind.Parameter) {
                var funcDecl = node.parent.parent;
                for (var i = 0; i < funcDecl.parameters.length; i++) {
                    if (funcDecl.parameters[i].pos == node.pos) {
                        var param = funcDecl.parameters[i];
                        varData.parameterIndex = i;
                        varData.parameterFuncDeclPos = funcDecl.pos + 1;
                        this.addTypeToVariable(varPos, node, param.initializer);
                        break;
                    }
                }
            }
            else if (node.parent && node.parent.kind == ts.SyntaxKind.BinaryExpression) {
                var binExpr = node.parent;
                if (binExpr.left.kind == ts.SyntaxKind.Identifier
                    && binExpr.left.getText() == node.getText()
                    && binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                    this.addTypeToVariable(varPos, binExpr.left, binExpr.right);
                    if (binExpr.right && binExpr.right.kind == ts.SyntaxKind.ObjectLiteralExpression)
                        varData.propertiesAssigned = true;
                    if (binExpr.right && binExpr.right.kind == ts.SyntaxKind.ArrayLiteralExpression)
                        varData.propertiesAssigned = true;
                }
            }
            else if (node.parent && node.parent.kind == ts.SyntaxKind.PropertyAccessExpression) {
                var propAccess = node.parent;
                if (propAccess.expression.pos == node.pos && propAccess.parent.kind == ts.SyntaxKind.BinaryExpression) {
                    var binExpr = propAccess.parent;
                    if (binExpr.left.pos == propAccess.pos && binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                        varData.propertiesAssigned = true;
                        var determinedType = this.determineType(propAccess.name, binExpr.right);
                        if (!(determinedType instanceof TypePromise))
                            varData.addedProperties[propAccess.name.getText()] = determinedType;
                    }
                }
                if (propAccess.expression.kind == ts.SyntaxKind.Identifier && propAccess.name.getText() == "push") {
                    varData.isDynamicArray = true;
                    var determinedType = exports.UniversalVarType;
                    if (propAccess.parent && propAccess.parent.kind == ts.SyntaxKind.CallExpression) {
                        var call = propAccess.parent;
                        if (call.arguments.length == 1)
                            determinedType = this.determineType(propAccess.expression, call.arguments[0]);
                    }
                    if (determinedType instanceof TypePromise) {
                        determinedType.arrayOf = true;
                        varData.typePromises.push(determinedType);
                    }
                    else {
                        if (determinedType instanceof ArrayType)
                            determinedType.isDynamicArray = true;
                        var dtString = this.getTypeString(determinedType);
                        var found = false;
                        for (var _i = 0, _a = Object.keys(varData.assignmentTypes); _i < _a.length; _i++) {
                            var tk = _a[_i];
                            var at = varData.assignmentTypes[tk];
                            if (at instanceof ArrayType && this.getTypeString(at.elementType) == dtString)
                                found = true;
                        }
                        if (!found) {
                            var arrayOfType = new ArrayType(determinedType, 0, true);
                            varData.assignmentTypes[arrayOfType.getText()] = arrayOfType;
                        }
                    }
                }
                if (propAccess.expression.kind == ts.SyntaxKind.Identifier && propAccess.name.getText() == "pop") {
                    varData.isDynamicArray = true;
                }
            }
            else if (node.parent && node.parent.kind == ts.SyntaxKind.ElementAccessExpression) {
                var elemAccess = node.parent;
                if (elemAccess.expression.pos == node.pos) {
                    var determinedType = exports.UniversalVarType;
                    var isLeftHandSide = false;
                    if (elemAccess.parent && elemAccess.parent.kind == ts.SyntaxKind.BinaryExpression) {
                        var binExpr = elemAccess.parent;
                        if (binExpr.left.pos == elemAccess.pos && binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                            varData.propertiesAssigned = true;
                            determinedType = this.determineType(elemAccess.expression, binExpr.right);
                            isLeftHandSide = true;
                        }
                    }
                    if (elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                        var propName = elemAccess.argumentExpression.getText().slice(1, -1);
                        if (determinedType instanceof TypePromise) {
                            determinedType.associatedProperty = propName;
                            varData.typePromises.push(determinedType);
                        }
                        varData.addedProperties[propName] = varData.addedProperties[propName] || exports.UniversalVarType;
                        if (!(determinedType instanceof TypePromise) && varData.addedProperties[propName] == exports.UniversalVarType)
                            varData.addedProperties[propName] = determinedType;
                    }
                    else if (elemAccess.argumentExpression.kind == ts.SyntaxKind.NumericLiteral) {
                        if (determinedType instanceof TypePromise) {
                            determinedType.arrayOf = true;
                            varData.typePromises.push(determinedType);
                        }
                        else {
                            for (var atKey in varData.assignmentTypes) {
                                var at = varData.assignmentTypes[atKey];
                                if (at instanceof ArrayType && at.elementType == exports.UniversalVarType)
                                    at.elementType = determinedType;
                            }
                        }
                    }
                    else if (isLeftHandSide)
                        varData.isDict = true;
                }
            }
            else if (node.parent && node.parent.kind == ts.SyntaxKind.ForOfStatement) {
                var forOfStatement = node.parent;
                if (forOfStatement.initializer.kind == ts.SyntaxKind.Identifier && forOfStatement.initializer.pos == node.pos) {
                    varData.typePromises.push(new TypePromise(forOfStatement.expression, true));
                }
            }
        }
        node.getChildren().forEach(function (c) { return _this.findVariablesRecursively(c); });
    };
    TypeHelper.prototype.resolvePromisesAndFinalizeTypes = function () {
        for (var k in this.variablesData) {
            var funcDeclPos = this.variablesData[+k].parameterFuncDeclPos;
            var paramIndex = this.variablesData[+k].parameterIndex;
            if (funcDeclPos && this.functionCallsData[funcDeclPos]) {
                var type = this.functionCallsData[funcDeclPos][paramIndex];
                var finalType = !(type instanceof TypePromise) && type;
                if (type instanceof TypePromise)
                    finalType = this.getCType(type.associatedNode) || finalType;
                if (finalType)
                    this.variablesData[k].assignmentTypes[this.getTypeString(finalType)] = finalType;
            }
        }
        var somePromisesAreResolved;
        do {
            somePromisesAreResolved = false;
            for (var _i = 0, _a = Object.keys(this.variables).map(function (k) { return +k; }); _i < _a.length; _i++) {
                var k = _a[_i];
                var types = Object.keys(this.variablesData[k].assignmentTypes).filter(function (t) { return t != exports.PointerVarType && t != exports.UniversalVarType; });
                if (types.length == 1) {
                    var varType = this.variablesData[k].assignmentTypes[types[0]];
                    if (varType instanceof ArrayType) {
                        varType.isDynamicArray = varType.isDynamicArray || this.variablesData[k].isDynamicArray;
                        if (this.variablesData[k].isDynamicArray)
                            this.variables[k].requiresAllocation = true;
                    }
                    else if (varType instanceof StructType && this.variablesData[k].propertiesAssigned) {
                        this.variables[k].requiresAllocation = true;
                    }
                    if (varType instanceof StructType) {
                        for (var addPropKey in this.variablesData[k].addedProperties) {
                            var addPropType = this.variablesData[k].addedProperties[addPropKey];
                            if (!(addPropType instanceof TypePromise))
                                varType.properties[addPropKey] = addPropType;
                        }
                        varType.isDict = this.variablesData[k].isDict;
                    }
                    this.variables[k].type = varType;
                }
                else if (types.length == 0) {
                    this.variables[k].type = exports.PointerVarType;
                }
                else {
                    this.variables[k].requiresAllocation = true;
                    this.variables[k].type = exports.UniversalVarType;
                }
                somePromisesAreResolved = somePromisesAreResolved || this.tryResolvePromises(k);
            }
        } while (somePromisesAreResolved);
    };
    TypeHelper.prototype.tryResolvePromises = function (varPos) {
        var somePromisesAreResolved = false;
        if (this.variablesData[varPos].typePromises.length > 0) {
            var promises = this.variablesData[varPos].typePromises.filter(function (p) { return !p.resolved; });
            for (var _i = 0, promises_1 = promises; _i < promises_1.length; _i++) {
                var promise = promises_1[_i];
                var resolvedType = this.getCType(promise.associatedNode);
                if (resolvedType != null) {
                    var finalType = resolvedType;
                    promise.resolved = true;
                    somePromisesAreResolved = true;
                    if (promise.arrayOf)
                        finalType = new ArrayType(resolvedType, 0, true);
                    else if (resolvedType instanceof StructType && promise.element) {
                        var propName = promise.element;
                        if (typeof propName === 'string') {
                            finalType = resolvedType.properties[propName];
                        }
                    }
                    else if (resolvedType instanceof ArrayType && promise.element) {
                        finalType = resolvedType.elementType;
                    }
                    if (promise.associatedProperty) {
                        this.variablesData[varPos].addedProperties[promise.associatedProperty] = finalType;
                    }
                    else {
                        if (finalType instanceof StructType)
                            this.variablesData[varPos].assignmentTypes[finalType.text] = finalType;
                        else if (finalType instanceof ArrayType)
                            this.variablesData[varPos].assignmentTypes[finalType.getText()] = finalType;
                        else
                            this.variablesData[varPos].assignmentTypes[finalType] = finalType;
                    }
                }
            }
        }
        return somePromisesAreResolved;
    };
    TypeHelper.prototype.addTypeToVariable = function (varPos, left, right) {
        var determinedType = this.determineType(left, right);
        if (determinedType instanceof TypePromise)
            this.variablesData[varPos].typePromises.push(determinedType);
        else
            this.variablesData[varPos].assignmentTypes[this.getTypeString(determinedType)] = determinedType;
    };
    TypeHelper.prototype.determineType = function (left, right) {
        var tsType = right ? this.typeChecker.getTypeAtLocation(right) : this.typeChecker.getTypeAtLocation(left);
        if (right && right.kind == ts.SyntaxKind.ObjectLiteralExpression)
            return this.generateStructure(tsType, left);
        else if (right && right.kind == ts.SyntaxKind.ArrayLiteralExpression)
            return this.determineArrayType(right);
        else if (right && (right.kind == ts.SyntaxKind.PropertyAccessExpression
            || right.kind == ts.SyntaxKind.ElementAccessExpression
            || right.kind == ts.SyntaxKind.Identifier)) {
            return new TypePromise(right, false);
        }
        else {
            return this.convertType(tsType, left);
        }
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
            this.userStructs[structName] = new StructType('struct ' + structName + ' *', userStructInfo, false);
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
                userStructCode += '    ' + propType.text + ' ' + propName + ';\n';
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
            return exports.UniversalVarType;
        var cap = arrLiteral.elements.length;
        var type = new ArrayType(elementType, cap, false);
        this.arrayLiteralsTypes[arrLiteral.pos] = type;
        return type;
    };
    TypeHelper.prototype.findParentFunction = function (node) {
        var parentFunc = node;
        while (parentFunc && parentFunc.kind != ts.SyntaxKind.FunctionDeclaration) {
            parentFunc = parentFunc.parent;
        }
        return parentFunc;
    };
    return TypeHelper;
}());
exports.TypeHelper = TypeHelper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],13:[function(require,module,exports){
(function (process,global){
"use strict";
var program_1 = require('./src/program');
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
        var program = ts.createProgram(fileNames, { noLib: true });
        var output = new program_1.CProgram(program)["resolve"]();
        fs.writeFileSync(fileNames[0].slice(0, -3) + '.c', output);
        process.exit();
    }
})();

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./src/program":10,"_process":2,"fs":1}]},{},[13]);
