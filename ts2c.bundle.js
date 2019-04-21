(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ts2c = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var types_1 = require("./types");
var standard_1 = require("./standard");
var match_1 = require("./standard/string/match");
var typeguards_1 = require("./typeguards");
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
                        if (type && type instanceof types_1.ArrayType && type.isDynamicArray || type === types_1.UniversalVarType)
                            this.scheduleNodeDisposal(node, type !== types_1.UniversalVarType);
                    }
                    break;
                case ts.SyntaxKind.ObjectLiteralExpression:
                    {
                        var type = this.typeHelper.getCType(node);
                        this.scheduleNodeDisposal(node, type !== types_1.UniversalVarType);
                    }
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    {
                        var binExpr = node;
                        var leftType = this.typeHelper.getCType(binExpr.left);
                        var rightType = this.typeHelper.getCType(binExpr.right);
                        if (typeguards_1.isPlusOp(binExpr.operatorToken.kind)) {
                            if (leftType == types_1.UniversalVarType || rightType == types_1.UniversalVarType)
                                this.needsGCMain = true;
                            else {
                                var n = binExpr;
                                while (ts.isBinaryExpression(n.parent) && typeguards_1.isPlusOp(n.parent.operatorToken.kind))
                                    n = n.parent;
                                var isInConsoleLog = ts.isCallExpression(n.parent) && n.parent.expression.getText() == "console.log";
                                if (!isInConsoleLog && (types_1.toPrimitive(leftType) == types_1.StringVarType || types_1.toPrimitive(rightType) == types_1.StringVarType))
                                    this.scheduleNodeDisposal(binExpr, false);
                            }
                        }
                        if (binExpr.operatorToken.kind === ts.SyntaxKind.InKeyword
                            && !(rightType instanceof types_1.ArrayType)
                            && (leftType === types_1.UniversalVarType || leftType instanceof types_1.ArrayType || leftType === types_1.NumberVarType && !ts.isNumericLiteral(binExpr.left)))
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
                        var parentFunc = types_1.findParentFunction(node.parent);
                        if (parentFunc) {
                            var type = this.typeHelper.getCType(node);
                            if (type instanceof types_1.FuncType && type.needsClosureStruct)
                                this.scheduleNodeDisposal(node);
                        }
                    }
                    break;
            }
        }
    };
    MemoryManager.prototype.getGCVariablesForScope = function (node) {
        var parentDecl = types_1.findParentFunction(node);
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
        var parentDecl = types_1.findParentFunction(node);
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
                    string: type == types_1.StringVarType,
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
        var varFuncNode = types_1.findParentFunction(heapNode);
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
                var decl = this.typeHelper.getDeclaration(node);
                if (decl)
                    refs = this.references[decl.pos] || refs;
            }
            var returned = false;
            for (var _i = 0, refs_1 = refs; _i < refs_1.length; _i++) {
                var ref = refs_1[_i];
                visited[ref.pos + "_" + ref.end] = true;
                var parentNode = types_1.findParentFunction(typeguards_1.isFunction(ref) ? ref.parent : ref);
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
                            var funcNode = types_1.findParentFunction(call);
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
        else if (typeguards_1.isFunction(heapNode))
            varName = this.symbolsHelper.addTemp(types_1.findParentSourceFile(heapNode), heapNode.name ? heapNode.name.text + "_func" : "func");
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
            array: !arrayWithContents && type && type instanceof types_1.ArrayType && type.isDynamicArray || type === types_1.UniversalVarType && ts.isArrayLiteralExpression(heapNode),
            dict: type && type instanceof types_1.DictType || type === types_1.UniversalVarType && ts.isObjectLiteralExpression(heapNode),
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
},{"./standard":14,"./standard/string/match":36,"./typeguards":43,"./types":44}],2:[function(require,module,exports){
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
        this.isNewExpression = false;
        this.assignmentRemoved = false;
        this.CR = inline ? "" : ";\n";
        this.isNewExpression = right.kind === ts.SyntaxKind.NewExpression;
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
            else if (type instanceof types_1.ArrayType || type instanceof types_1.DictType)
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
                .map(function (p) {
                var propName = (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text;
                return new CAssignment_1(scope, argAccessor, _this.isDict ? '"' + propName + '"' : propName, argType, p.initializer);
            });
        }
        else if (right.kind == ts.SyntaxKind.ArrayLiteralExpression && !isTempVar) {
            this.isArrayLiteralAssignment = true;
            var arrLiteral = right;
            this.arrayLiteralSize = arrLiteral.elements.length;
            this.arrInitializers = arrLiteral.elements.map(function (e, i) { return new CAssignment_1(scope, argAccessor, "" + i, argType, e); });
        }
        else if (argType == types_1.UniversalVarType) {
            this.expression = new typeconvert_1.CAsUniversalVar(scope, right);
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
        template_1.CodeTemplate("\n{#if assignmentRemoved}\n{#elseif isNewExpression}\n    {expression}{CR}\n{#elseif isObjLiteralAssignment}\n    {objInitializers}\n{#elseif isArrayLiteralAssignment}\n    {arrInitializers}\n{#elseif isDynamicArray && argumentExpression == null}\n    {accessor} = ((void *){expression}){CR}\n{#elseif argumentExpression == null}\n    {accessor} = {expression}{CR}\n{#elseif isStruct}\n    {accessor}->{argumentExpression} = {expression}{CR}\n{#elseif isDict}\n    DICT_SET({accessor}, {argumentExpression}, {expression}){CR}\n{#elseif isDynamicArray}\n    {accessor}->data[{argumentExpression}] = {expression}{CR}\n{#elseif isStaticArray}\n    {accessor}[{argumentExpression}] = {expression}{CR}\n{#else}\n    /* Unsupported assignment {accessor}[{argumentExpression}] = {nodeText} */{CR}\n{/if}")
    ], CAssignment);
    return CAssignment;
    var CAssignment_1;
}());
exports.CAssignment = CAssignment;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":42,"../types":44,"./elementaccess":4,"./typeconvert":10}],3:[function(require,module,exports){
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
var standard_1 = require("../standard");
var template_1 = require("../template");
var variable_1 = require("./variable");
var types_1 = require("../types");
var typeconvert_1 = require("./typeconvert");
var typeguards_1 = require("../typeguards");
var literals_1 = require("./literals");
var CCallExpression = /** @class */ (function () {
    function CCallExpression(scope, call) {
        this.funcName = null;
        this.standardCall = null;
        this.standardCall = standard_1.StandardCallHelper.createTemplate(scope, call);
        if (this.standardCall)
            return;
        // calling function that uses "this"
        var funcType = scope.root.typeHelper.getCType(call.expression);
        if (!funcType || funcType.instanceType != null) {
            this.nodeText = call.getText();
            return;
        }
        this.funcName = template_1.CodeTemplateFactory.createForNode(scope, call.expression);
        this.arguments = call.arguments.map(function (a, i) { return funcType.parameterTypes[i] === types_1.UniversalVarType ? new typeconvert_1.CAsUniversalVar(scope, a) : template_1.CodeTemplateFactory.createForNode(scope, a); });
        if (funcType.needsClosureStruct) {
            this.arguments.push(this.funcName);
            this.funcName = template_1.CodeTemplateFactory.templateToString(this.funcName) + "->func";
        }
        else {
            var _loop_1 = function (p) {
                var parentFunc = types_1.findParentFunction(call);
                var funcType_1 = scope.root.typeHelper.getCType(parentFunc);
                var closureVarName = funcType_1 && funcType_1.needsClosureStruct && scope.root.symbolsHelper.getClosureVarName(parentFunc);
                var value = p.node.text;
                if (closureVarName && funcType_1.closureParams.some(function (p) { return p.node.text === value; }))
                    value = closureVarName + "->" + value;
                this_1.arguments.push((p.assigned ? "&" : "") + value);
            };
            var this_1 = this;
            for (var _i = 0, _a = funcType.closureParams; _i < _a.length; _i++) {
                var p = _a[_i];
                _loop_1(p);
            }
        }
    }
    CCallExpression = __decorate([
        template_1.CodeTemplate("\n{#if standardCall}\n    {standardCall}\n{#elseif funcName}\n    {funcName}({arguments {, }=> {this}})\n{#else}\n    /* Unsupported function call: nodeText */\n{/if}", ts.SyntaxKind.CallExpression)
    ], CCallExpression);
    return CCallExpression;
}());
exports.CCallExpression = CCallExpression;
var CNew = /** @class */ (function () {
    function CNew(scope, node) {
        this.funcName = "";
        this.allocator = "";
        this.expression = "";
        var decl = scope.root.typeHelper.getDeclaration(node.expression);
        if (decl && ts.isIdentifier(node.expression)) {
            var funcType = scope.root.typeHelper.getCType(decl);
            this.funcName = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
            this.arguments = node.arguments.map(function (arg) { return template_1.CodeTemplateFactory.createForNode(scope, arg); });
            var varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.variables.push(new variable_1.CVariable(scope, varName, funcType.instanceType));
            this.arguments.unshift(varName);
            this.allocator = new variable_1.CVariableAllocation(scope, varName, funcType.instanceType, node);
        }
        else if (ts.isIdentifier(node.expression) && node.expression.text === "Object") {
            if (node.arguments.length === 0 || typeguards_1.isNullOrUndefined(node.arguments[0])) {
                var objLiteral = node;
                objLiteral.properties = [];
                this.expression = new literals_1.CObjectLiteralExpression(scope, objLiteral);
            }
        }
        this.nodeText = node.getText();
    }
    CNew = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {allocator}\n{/statements}\n{#if funcName}\n    {funcName}({arguments {, }=> {this}})\n{#elseif expression}\n    {expression}\n{#else}\n    /* Unsupported 'new' expression {nodeText} */\n{/if}", ts.SyntaxKind.NewExpression)
    ], CNew);
    return CNew;
}());
exports.CNew = CNew;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../standard":14,"../template":42,"../typeguards":43,"../types":44,"./literals":7,"./typeconvert":10,"./variable":11}],4:[function(require,module,exports){
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
var literals_1 = require("./literals");
var typeconvert_1 = require("./typeconvert");
var typeguards_1 = require("../typeguards");
var CElementAccess = /** @class */ (function () {
    function CElementAccess(scope, node) {
        var type = null;
        var elementAccess = null;
        var argumentExpression = null;
        if (ts.isIdentifier(node)) {
            type = scope.root.typeHelper.getCType(node);
            elementAccess = node.text;
            if (typeguards_1.isInBoolContext(node) && type instanceof types_1.ArrayType && !type.isDynamicArray) {
                argumentExpression = "0";
            }
            else if (type instanceof types_1.FuncType && type.needsClosureStruct) {
                var decl = scope.root.typeHelper.getDeclaration(node);
                elementAccess = scope.root.memoryManager.getReservedTemporaryVarName(decl) || elementAccess;
            }
        }
        else if (node.kind == ts.SyntaxKind.PropertyAccessExpression) {
            var propAccess = node;
            type = scope.root.typeHelper.getCType(propAccess.expression);
            if (ts.isIdentifier(propAccess.expression))
                elementAccess = propAccess.expression.text;
            else
                elementAccess = new CElementAccess_1(scope, propAccess.expression);
            if (type === types_1.UniversalVarType) {
                argumentExpression = 'js_var_from_str("' + propAccess.name.text + '")';
                scope.root.headerFlags.js_var_from_str = true;
            }
            else if (type instanceof types_1.DictType)
                argumentExpression = '"' + propAccess.name.text + '"';
            else
                argumentExpression = propAccess.name.text;
        }
        else if (node.kind == ts.SyntaxKind.ElementAccessExpression) {
            var elemAccess = node;
            type = scope.root.typeHelper.getCType(elemAccess.expression);
            if (ts.isIdentifier(elemAccess.expression))
                elementAccess = elemAccess.expression.text;
            else
                elementAccess = new CElementAccess_1(scope, elemAccess.expression);
            if (type === types_1.UniversalVarType)
                argumentExpression = new typeconvert_1.CAsUniversalVar(scope, elemAccess.argumentExpression);
            else if (type instanceof types_1.StructType && elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
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
        var parentFunc = types_1.findParentFunction(node);
        var parentFuncType = scope.root.typeHelper.getCType(parentFunc);
        if (parentFuncType && parentFuncType.needsClosureStruct && parentFuncType.closureParams.some(function (p) { return p.refs.some(function (r) { return r.pos === node.pos; }); }))
            elementAccess = scope.root.symbolsHelper.getClosureVarName(parentFunc) + "->" + template_1.CodeTemplateFactory.templateToString(elementAccess);
        else if (parentFuncType && parentFuncType.closureParams.some(function (p) { return p.refs.some(function (r) { return r.pos === node.pos; }) && p.assigned; }))
            elementAccess = "*" + template_1.CodeTemplateFactory.templateToString(elementAccess);
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
        this.nullValue = "0";
        this.isUniversalAccess = false;
        this.isSimpleVar = typeof type === 'string' && type != types_1.UniversalVarType && type != types_1.PointerVarType;
        this.isDynamicArray = type instanceof types_1.ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof types_1.ArrayType && !type.isDynamicArray;
        this.arrayCapacity = type instanceof types_1.ArrayType && !type.isDynamicArray && type.capacity + "";
        this.isDict = type instanceof types_1.DictType;
        this.isStruct = type instanceof types_1.StructType;
        if (type === types_1.UniversalVarType && argumentExpression != null) {
            this.isUniversalAccess = true;
            scope.root.headerFlags.js_var_get = true;
        }
        this.isString = type === types_1.StringVarType;
        if (argumentExpression != null && type instanceof types_1.DictType && type.elementType === types_1.UniversalVarType)
            this.nullValue = new literals_1.CUndefined(scope);
        if (this.isString && this.argumentExpression == "length")
            scope.root.headerFlags.str_len = true;
    }
    CSimpleElementAccess = __decorate([
        template_1.CodeTemplate("\n{#if isString && argumentExpression == 'length'}\n    str_len({elementAccess})\n{#elseif isSimpleVar || argumentExpression == null}\n    {elementAccess}\n{#elseif isDynamicArray && argumentExpression == 'length'}\n    {elementAccess}->size\n{#elseif isDynamicArray}\n    {elementAccess}->data[{argumentExpression}]\n{#elseif isStaticArray && argumentExpression == 'length'}\n    {arrayCapacity}\n{#elseif isStaticArray}\n    {elementAccess}[{argumentExpression}]\n{#elseif isStruct}\n    {elementAccess}->{argumentExpression}\n{#elseif isDict}\n    DICT_GET({elementAccess}, {argumentExpression}, {nullValue})\n{#elseif isUniversalAccess}\n    js_var_get({elementAccess}, {argumentExpression})\n{#else}\n    /* Unsupported element access scenario: {elementAccess} {argumentExpression} */\n{/if}")
    ], CSimpleElementAccess);
    return CSimpleElementAccess;
}());
exports.CSimpleElementAccess = CSimpleElementAccess;
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
exports.CArraySize = CArraySize;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":42,"../typeguards":43,"../types":44,"./literals":7,"./typeconvert":10}],5:[function(require,module,exports){
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
var literals_1 = require("./literals");
var typeconvert_1 = require("./typeconvert");
var typeguards_1 = require("../typeguards");
var elementaccess_1 = require("./elementaccess");
var standard_1 = require("../standard");
var CCondition = /** @class */ (function () {
    function CCondition(scope, node) {
        this.universalWrapper = false;
        this.isString = false;
        this.expressionIsIdentifier = false;
        this.expression = template_1.CodeTemplateFactory.createForNode(scope, node);
        this.expressionIsIdentifier = ts.isIdentifier(node);
        var type = scope.root.typeHelper.getCType(node);
        this.isString = type == types_1.StringVarType;
        if (type == types_1.UniversalVarType) {
            this.universalWrapper = true;
            scope.root.headerFlags.js_var_to_bool = true;
        }
    }
    CCondition = __decorate([
        template_1.CodeTemplate("\n{#if universalWrapper}\n    js_var_to_bool({expression})\n{#elseif isString && expressionIsIdentifier}\n    *{expression}\n{#elseif isString}\n    *({expression})\n{#else}\n    {expression}\n{/if}")
    ], CCondition);
    return CCondition;
}());
exports.CCondition = CCondition;
var CBinaryExpression = /** @class */ (function () {
    function CBinaryExpression(scope, node) {
        this.expression = null;
        if (node.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
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
        if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
            this.expression = new CPlusExpression(scope, node);
            return;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.PlusEqualsToken) {
            var left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
            var right = new CPlusExpression(scope, node);
            this.expression = "(" + template_1.CodeTemplateFactory.templateToString(left) + " = " + template_1.CodeTemplateFactory.templateToString(right) + ")";
        }
        if (typeguards_1.isNumberOp(node.operatorToken.kind) || typeguards_1.isIntegerOp(node.operatorToken.kind)) {
            this.expression = new CArithmeticExpression(scope, node);
            return;
        }
        if (typeguards_1.isRelationalOp(node.operatorToken.kind)) {
            this.expression = new CRelationalExpression(scope, node);
            return;
        }
        if (typeguards_1.isEqualityOp(node.operatorToken.kind)) {
            this.expression = new CEqualityExpression(scope, node);
            return;
        }
        if (node.operatorToken.kind === ts.SyntaxKind.InKeyword) {
            this.expression = new CInExpression(scope, node);
            return;
        }
        if (typeguards_1.isLogicOp(node.operatorToken.kind)) {
            this.expression = new CLogicExpession(scope, node);
            return;
        }
        this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
    }
    CBinaryExpression = __decorate([
        template_1.CodeTemplate("\n{#if expression}\n    {expression}\n{#else}\n    /* unsupported expression {nodeText} */\n{/if}", ts.SyntaxKind.BinaryExpression)
    ], CBinaryExpression);
    return CBinaryExpression;
}());
exports.CBinaryExpression = CBinaryExpression;
var CLogicExpession = /** @class */ (function () {
    function CLogicExpession(scope, node) {
        this.leftVarName = "";
        this.rightVarName = "";
        var type = scope.root.typeHelper.getCType(node);
        if (type === types_1.UniversalVarType) {
            this.left = new typeconvert_1.CAsUniversalVar(scope, node.left);
            this.right = new typeconvert_1.CAsUniversalVar(scope, node.right);
        }
        else {
            this.left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
            this.right = template_1.CodeTemplateFactory.createForNode(scope, node.right);
        }
        this.isBoolContext = typeguards_1.isInBoolContext(node) && type !== types_1.UniversalVarType;
        var isOr = node.operatorToken.kind === ts.SyntaxKind.BarBarToken;
        if (this.isBoolContext) {
            this.operator = isOr ? "||" : "&&";
        }
        else {
            if (!typeguards_1.isSimpleNode(node.left)) {
                this.leftVarName = scope.root.symbolsHelper.addTemp(node, "tmp1");
                scope.variables.push(new variable_1.CVariable(scope, this.leftVarName, type));
            }
            if (!typeguards_1.isSimpleNode(node.right)) {
                this.rightVarName = scope.root.symbolsHelper.addTemp(node, "tmp2");
                scope.variables.push(new variable_1.CVariable(scope, this.rightVarName, type));
            }
            if (this.leftVarName && type === types_1.UniversalVarType) {
                this.condition = "js_var_to_bool(" + this.leftVarName + ")";
                scope.root.headerFlags.js_var_to_bool = true;
            }
            else
                this.condition = this.leftVarName || new CCondition(scope, node.left);
            if (isOr) {
                this.whenTrue = this.leftVarName || this.left;
                this.whenFalse = this.rightVarName || this.right;
            }
            else {
                this.whenTrue = this.rightVarName || this.right;
                this.whenFalse = this.leftVarName || this.left;
            }
        }
    }
    CLogicExpession = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if leftVarName}\n        {leftVarName} = {left};\n    {/if}\n    {#if rightVarName}\n        {rightVarName} = {right};\n    {/if}\n{/statements}\n{#if isBoolContext}\n    {left} {operator} {right}\n{#else}\n    {condition} ? {whenTrue} : {whenFalse}\n{/if}")
    ], CLogicExpession);
    return CLogicExpession;
}());
var CArithmeticExpression = /** @class */ (function () {
    function CArithmeticExpression(scope, node) {
        this.operator = null;
        this.computeOperation = null;
        var leftType = scope.root.typeHelper.getCType(node.left);
        var rightType = scope.root.typeHelper.getCType(node.right);
        this.isCompoundAssignment = typeguards_1.isCompoundAssignment(node.operatorToken);
        if (types_1.toNumberCanBeNaN(leftType) || types_1.toNumberCanBeNaN(rightType)) {
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
            this.computeOperation = js_var_operator_map[node.operatorToken.kind];
            this.left = new typeconvert_1.CAsUniversalVar(scope, node.left);
            this.right = new typeconvert_1.CAsUniversalVar(scope, node.right);
            scope.root.headerFlags.js_var_compute = true;
        }
        else {
            this.operator = node.operatorToken.getText();
            this.left = new typeconvert_1.CAsNumber(scope, node.left);
            this.right = new typeconvert_1.CAsNumber(scope, node.right);
            if (node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken
                || node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken) {
                this.operator = ">>";
                var leftAsString = template_1.CodeTemplateFactory.templateToString(this.left);
                this.left = "((uint16_t)" + leftAsString + ")";
                if (node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken)
                    this.left = leftAsString + " = " + this.left;
                scope.root.headerFlags.uint16_t = true;
            }
        }
        this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
        var _a;
    }
    CArithmeticExpression = __decorate([
        template_1.CodeTemplate("\n{#if operator}\n    {left} {operator} {right}\n{#elseif computeOperation && isCompoundAssignment}\n    {left} = js_var_compute({left}, {computeOperation}, {right})\n{#elseif computeOperation}\n    js_var_compute({left}, {computeOperation}, {right})\n{#else}\n    /* unsupported arithmetic expression {nodeText} */\n{/if}")
    ], CArithmeticExpression);
    return CArithmeticExpression;
}());
var CRelationalExpression = /** @class */ (function () {
    function CRelationalExpression(scope, node) {
        this.operator = null;
        this.universalCondition = null;
        this.stringCondition = null;
        var leftType = scope.root.typeHelper.getCType(node.left);
        var rightType = scope.root.typeHelper.getCType(node.right);
        if (leftType === types_1.UniversalVarType || rightType === types_1.UniversalVarType) {
            switch (node.operatorToken.kind) {
                case ts.SyntaxKind.LessThanToken:
                    this.left = new typeconvert_1.CAsUniversalVar(scope, node.left);
                    this.right = new typeconvert_1.CAsUniversalVar(scope, node.right);
                    this.universalCondition = "> 0";
                    break;
                case ts.SyntaxKind.LessThanEqualsToken:
                    // notice operands are swapped
                    this.left = new typeconvert_1.CAsUniversalVar(scope, node.right);
                    this.right = new typeconvert_1.CAsUniversalVar(scope, node.left);
                    this.universalCondition = "< 0";
                    break;
                case ts.SyntaxKind.GreaterThanToken:
                    // notice operands are swapped
                    this.left = new typeconvert_1.CAsUniversalVar(scope, node.right);
                    this.right = new typeconvert_1.CAsUniversalVar(scope, node.left);
                    this.universalCondition = "> 0";
                    break;
                case ts.SyntaxKind.GreaterThanEqualsToken:
                    this.left = new typeconvert_1.CAsUniversalVar(scope, node.left);
                    this.right = new typeconvert_1.CAsUniversalVar(scope, node.right);
                    this.universalCondition = "< 0";
                    break;
            }
            scope.root.headerFlags.js_var_lessthan = true;
        }
        else if (leftType === types_1.StringVarType && rightType === types_1.StringVarType) {
            this.stringCondition = node.operatorToken.getText() + " 0";
            this.left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
            this.right = template_1.CodeTemplateFactory.createForNode(scope, node.right);
            scope.root.headerFlags.strings = true;
        }
        else {
            this.operator = node.operatorToken.getText();
            this.left = new typeconvert_1.CAsNumber(scope, node.left);
            this.right = new typeconvert_1.CAsNumber(scope, node.right);
        }
        this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
    }
    CRelationalExpression = __decorate([
        template_1.CodeTemplate("\n{#if operator}\n    {left} {operator} {right}\n{#elseif stringCondition}\n    strcmp({left}, {right}) {stringCondition}\n{#elseif universalCondition}\n    js_var_lessthan({left}, {right}) {universalCondition}\n{#else}\n    /* unsupported relational expression {nodeText} */\n{/if}")
    ], CRelationalExpression);
    return CRelationalExpression;
}());
var CEqualityExpression = /** @class */ (function () {
    function CEqualityExpression(scope, node) {
        this.expression = null;
        this.operator = null;
        this.stringCondition = null;
        this.strNumCondition = null;
        this.universalCondition = null;
        this.strict = null;
        var leftType = scope.root.typeHelper.getCType(node.left);
        var rightType = scope.root.typeHelper.getCType(node.right);
        var notEquals = node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken;
        this.strict = node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ? "TRUE" : "FALSE";
        this.left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
        this.right = template_1.CodeTemplateFactory.createForNode(scope, node.right);
        if ((leftType == types_1.NumberVarType || leftType == types_1.BooleanVarType) && (rightType == types_1.NumberVarType || rightType == types_1.BooleanVarType)) {
            this.operator = notEquals ? "!=" : "==";
        }
        else if (leftType == types_1.StringVarType && rightType == types_1.StringVarType) {
            this.stringCondition = notEquals ? "!= 0" : "== 0";
            scope.root.headerFlags.strings = true;
        }
        else if (leftType == types_1.NumberVarType && rightType == types_1.StringVarType
            || leftType == types_1.StringVarType && rightType == types_1.NumberVarType) {
            this.strNumCondition = notEquals ? "!= 0" : "== 0";
            scope.root.headerFlags.str_int16_t_cmp = true;
            // str_int16_t_cmp expects certain order of arguments (string, number)
            if (leftType == types_1.NumberVarType) {
                var tmp = this.left;
                this.left = this.right;
                this.right = tmp;
            }
        }
        else if (leftType == types_1.UniversalVarType || rightType == types_1.UniversalVarType) {
            this.universalCondition = notEquals ? "== FALSE" : "== TRUE";
            this.left = new typeconvert_1.CAsUniversalVar(scope, this.left, leftType);
            this.right = new typeconvert_1.CAsUniversalVar(scope, this.right, rightType);
            scope.root.headerFlags.js_var_eq = true;
        }
        else if (leftType instanceof types_1.StructType || leftType instanceof types_1.ArrayType || leftType instanceof types_1.DictType
            || rightType instanceof types_1.StructType || rightType instanceof types_1.ArrayType || rightType instanceof types_1.DictType) {
            if (leftType != rightType) {
                this.expression = notEquals ? "TRUE" : "FALSE";
                scope.root.headerFlags.bool = true;
            }
            else
                this.operator = notEquals ? "!=" : "==";
        }
        this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
    }
    CEqualityExpression = __decorate([
        template_1.CodeTemplate("\n{#if expression}\n    {expression}\n{#elseif operator}\n    {left} {operator} {right}\n{#elseif stringCondition}\n    strcmp({left}, {right}) {stringCondition}\n{#elseif strNumCondition}\n    str_int16_t_cmp({left}, {right}) {strNumCondition}\n{#elseif universalCondition}\n    js_var_eq({left}, {right}, {strict}) {universalCondition}\n{#else}\n    /* unsupported equality expression {nodeText} */\n{/if}")
    ], CEqualityExpression);
    return CEqualityExpression;
}());
var CPlusExpression = /** @class */ (function () {
    function CPlusExpression(scope, node) {
        this.addNumbers = false;
        this.isUniversalVar = false;
        this.replacedWithVar = false;
        this.replacementVarName = null;
        this.gcVarName = null;
        var leftType = scope.root.typeHelper.getCType(node.left);
        this.left = template_1.CodeTemplateFactory.createForNode(scope, node.left);
        var rightType = scope.root.typeHelper.getCType(node.right);
        this.right = template_1.CodeTemplateFactory.createForNode(scope, node.right);
        if (leftType == types_1.RegexVarType) {
            leftType = types_1.StringVarType;
            this.left = new regexfunc_1.CRegexAsString(this.left);
        }
        if (rightType == types_1.RegexVarType) {
            rightType = types_1.StringVarType;
            this.right = new regexfunc_1.CRegexAsString(this.right);
        }
        if ((leftType === types_1.NumberVarType || leftType === types_1.BooleanVarType) && (rightType === types_1.NumberVarType || rightType === types_1.BooleanVarType)) {
            this.addNumbers = true;
        }
        else if (leftType === types_1.UniversalVarType || rightType === types_1.UniversalVarType) {
            this.isUniversalVar = true;
            this.left = new typeconvert_1.CAsUniversalVar(scope, this.left, leftType);
            this.right = new typeconvert_1.CAsUniversalVar(scope, this.right, rightType);
            scope.root.headerFlags.js_var_plus = true;
        }
        else {
            var tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            scope.func.variables.push(new variable_1.CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
            this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
            this.replacedWithVar = true;
            this.replacementVarName = tempVarName;
            this.strlen_left = new typeconvert_1.CAsString_Length(scope, node.left, this.left, leftType);
            this.strlen_right = new typeconvert_1.CAsString_Length(scope, node.right, this.right, rightType);
            this.strcat_left = new typeconvert_1.CAsString_Concat(scope, node.left, tempVarName, this.left, leftType);
            this.strcat_right = new typeconvert_1.CAsString_Concat(scope, node.right, tempVarName, this.right, rightType);
            scope.root.headerFlags.strings = true;
            scope.root.headerFlags.malloc = true;
            scope.root.headerFlags.str_int16_t_cat = true;
            if (this.gcVarName) {
                scope.root.headerFlags.gc_iterator = true;
                scope.root.headerFlags.array = true;
            }
        }
    }
    CPlusExpression = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if replacedWithVar}\n        {replacementVarName} = malloc({strlen_left} + {strlen_right} + 1);\n        assert({replacementVarName} != NULL);\n        {replacementVarName}[0] = '\\0';\n        {strcat_left}\n        {strcat_right}\n    {/if}\n    {#if replacedWithVar && gcVarName}\n        ARRAY_PUSH({gcVarName}, {replacementVarName});\n    {/if}\n\n{/statements}\n{#if addNumbers}\n    {left} + {right}\n{#elseif replacedWithVar}\n    {replacementVarName}\n{#elseif isUniversalVar}\n    js_var_plus({left}, {right})\n{/if}")
    ], CPlusExpression);
    return CPlusExpression;
}());
var CInExpression = /** @class */ (function () {
    function CInExpression(scope, node) {
        var _this = this;
        this.isArray = false;
        this.isStruct = false;
        this.isDict = false;
        this.isUniversalVar = false;
        this.result = null;
        this.tmpVarName = null;
        var type = scope.root.typeHelper.getCType(node.right);
        this.obj = template_1.CodeTemplateFactory.createForNode(scope, node.right);
        if (type instanceof types_1.ArrayType) {
            this.isArray = true;
            this.arraySize = new elementaccess_1.CArraySize(scope, this.obj, type);
            this.key = new typeconvert_1.CAsNumber(scope, node.left);
            var keyType = scope.root.typeHelper.getCType(node.left);
            if (types_1.toNumberCanBeNaN(keyType)) {
                this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "tmp_key");
                scope.variables.push(new variable_1.CVariable(scope, this.tmpVarName, types_1.UniversalVarType));
            }
        }
        else {
            this.key = new typeconvert_1.CAsString(scope, node.left);
        }
        if (type instanceof types_1.StructType) {
            this.isStruct = true;
            var propTypes = Object.keys(type.properties);
            if (propTypes.length == 0) {
                this.result = "FALSE";
                scope.root.headerFlags.bool = true;
            }
            else {
                var initializer = "{ " + propTypes.sort().map(function (p) { return '"' + p + '"'; }).join(", ") + " }";
                this.propertiesVarName = type.structName + "_props";
                this.propertiesCount = propTypes.length + "";
                if (!scope.root.variables.some(function (v) { return v.name === _this.propertiesVarName; }))
                    scope.root.variables.push(new variable_1.CVariable(scope, this.propertiesVarName, "const char *{var}[" + this.propertiesCount + "]", { initializer: initializer }));
                scope.root.headerFlags.dict_find_pos = true;
            }
        }
        this.isDict = type instanceof types_1.DictType;
        this.isUniversalVar = type === types_1.UniversalVarType;
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
                this.result = "TRUE";
        }
        if (this.isArray && ts.isStringLiteral(node.left) && node.left.text === "length")
            this.result = "TRUE";
        this.nodeText = node.getText();
    }
    CInExpression = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if tmpVarName}\n        {tmpVarName} = {key};\n    {/if}\n{/statements}\n{#if result}\n    {result}\n{#elseif isArray && tmpVarName}\n    ({tmpVarName}.type != JS_VAR_NAN && {tmpVarName}.number >= 0 && {tmpVarName}.number < {arraySize})\n{#elseif isArray && !tmpVarName}\n    ({key} >= 0 && {key} < {arraySize})\n{#elseif isStruct}\n    dict_find_pos({propertiesVarName}, {propertiesCount}, {key}) > -1\n{#elseif isDict}\n    dict_find_pos({obj}->index->data, {obj}->index->size, {key}) > -1\n{#elseif isUniversalVar}\n    js_var_get({obj}, {key}).type != JS_VAR_UNDEFINED\n{#else}\n    /* unsupported 'in' expression {nodeText} */\n{/if}")
    ], CInExpression);
    return CInExpression;
}());
var CUnaryExpression = /** @class */ (function () {
    function CUnaryExpression(scope, node) {
        this.before = "";
        this.after = "";
        this.isCompound = false;
        this.isPostfix = node.kind == ts.SyntaxKind.PostfixUnaryExpression;
        var type = scope.root.typeHelper.getCType(node.operand);
        if (node.operator === ts.SyntaxKind.PlusToken)
            this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
        else if (node.operator === ts.SyntaxKind.MinusToken) {
            this.before = "-";
            this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
            if (types_1.toNumberCanBeNaN(type)) {
                this.before = "js_var_compute(js_var_from_int16_t(0), JS_VAR_MINUS, ";
                this.after = ")";
                scope.root.headerFlags.js_var_compute = true;
                scope.root.headerFlags.js_var_from_int16_t = true;
            }
        }
        else if (node.operator === ts.SyntaxKind.TildeToken) {
            this.before = "~";
            this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
            if (types_1.toNumberCanBeNaN(type))
                this.after = ".number";
        }
        else if (node.operator === ts.SyntaxKind.ExclamationToken) {
            this.before = "!";
            this.operand = new CCondition(scope, node.operand);
        }
        else if (node.operator === ts.SyntaxKind.PlusPlusToken) {
            if (this.isPostfix) {
                if (types_1.toNumberCanBeNaN(type))
                    this.operand = "/* not supported expression " + node.getText() + " */";
                else {
                    this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
                    this.after = "++";
                }
            }
            else {
                if (types_1.toNumberCanBeNaN(type)) {
                    this.isCompound = true;
                    this.before = "js_var_plus(js_var_to_number(";
                    this.operand = template_1.CodeTemplateFactory.createForNode(scope, node.operand);
                    this.after = "), js_var_from_int16_t(1))";
                    scope.root.headerFlags.js_var_plus = true;
                    scope.root.headerFlags.js_var_from_int16_t = true;
                }
                else {
                    this.before = "++";
                    this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
                }
            }
        }
        else if (node.operator === ts.SyntaxKind.MinusMinusToken) {
            if (this.isPostfix) {
                if (types_1.toNumberCanBeNaN(type))
                    this.operand = "/* not supported expression " + node.getText() + " */";
                else {
                    this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
                    this.after = "--";
                }
            }
            else {
                if (types_1.toNumberCanBeNaN(type)) {
                    this.isCompound = true;
                    this.before = "js_var_compute(";
                    this.operand = template_1.CodeTemplateFactory.createForNode(scope, node.operand);
                    this.after = ", JS_VAR_MINUS, js_var_from_int16_t(1))";
                    scope.root.headerFlags.js_var_compute = true;
                    scope.root.headerFlags.js_var_from_int16_t = true;
                }
                else {
                    this.before = "--";
                    this.operand = new typeconvert_1.CAsNumber(scope, node.operand);
                }
            }
        }
    }
    CUnaryExpression = __decorate([
        template_1.CodeTemplate("\n{#if isCompound}\n    ({operand} = {before}{operand}{after})\n{#else}\n    {before}{operand}{after}\n{/if}", [ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression])
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
var CTypeOf = /** @class */ (function () {
    function CTypeOf(scope, node) {
        var type = scope.root.typeHelper.getCType(node.expression);
        this.isUniversalVar = type === types_1.UniversalVarType;
        this.isString = type === types_1.StringVarType;
        this.isNumber = type === types_1.NumberVarType;
        this.isBoolean = type === types_1.BooleanVarType;
        this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        if (type == types_1.UniversalVarType) {
            scope.root.headerFlags.js_var = true;
            scope.root.headerFlags.js_var_typeof = true;
        }
    }
    CTypeOf = __decorate([
        template_1.CodeTemplate("\n{#if isUniversalVar}\n    js_var_typeof({expression})\n{#elseif isString}\n    \"string\"\n{#elseif isNumber}\n    \"number\"\n{#elseif isBoolean}\n    \"number\"\n{#else}\n    \"object\"\n{/if}", ts.SyntaxKind.TypeOfExpression)
    ], CTypeOf);
    return CTypeOf;
}());
var CVoid = /** @class */ (function () {
    function CVoid(scope, node) {
        this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        scope.root.headerFlags.js_var = true;
        scope.root.headerFlags.js_var_to_undefined = true;
    }
    CVoid = __decorate([
        template_1.CodeTemplate("js_var_to_undefined({expression})", ts.SyntaxKind.VoidExpression)
    ], CVoid);
    return CVoid;
}());
var CDelete = /** @class */ (function () {
    function CDelete(scope, node) {
        this.topExpressionOfStatement = node.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.dict = (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
            && template_1.CodeTemplateFactory.createForNode(scope, node.expression.expression);
        if (ts.isElementAccessExpression(node.expression))
            this.argExpression = ts.isNumericLiteral(node.expression.argumentExpression)
                ? '"' + node.expression.argumentExpression.text + '"'
                : template_1.CodeTemplateFactory.createForNode(scope, node.expression.argumentExpression);
        else if (ts.isPropertyAccessExpression(node.expression))
            this.argExpression = new literals_1.CString(scope, node.expression.name.text);
        this.tempVarName = scope.root.symbolsHelper.addTemp(node, "tmp_dict_pos");
        scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.NumberVarType));
        scope.root.headerFlags.bool = true;
        scope.root.headerFlags.array_remove = true;
    }
    CDelete = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {tempVarName} = dict_find_pos({dict}->index->data, {dict}->index->size, {argExpression});\n    if ({tempVarName} >= 0)\n    {\n        ARRAY_REMOVE({dict}->index, {tempVarName}, 1);\n        ARRAY_REMOVE({dict}->values, {tempVarName}, 1);\n    }\n{/statements}\n{#if !topExpressionOfStatement}\n    TRUE\n{/if}", ts.SyntaxKind.DeleteExpression)
    ], CDelete);
    return CDelete;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../standard":14,"../template":42,"../typeguards":43,"../types":44,"./assignment":2,"./elementaccess":4,"./literals":7,"./regexfunc":8,"./typeconvert":10,"./variable":11}],6:[function(require,module,exports){
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
var types_1 = require("../types");
var standard_1 = require("../standard");
var typeguards_1 = require("../typeguards");
var CFunctionPrototype = /** @class */ (function () {
    function CFunctionPrototype(scope, node) {
        this.parameters = [];
        var funcType = scope.root.typeHelper.getCType(node);
        this.returnType = scope.root.typeHelper.getTypeString(funcType.returnType);
        this.name = node.name.getText();
        this.parameters = node.parameters.map(function (p, i) { return new variable_1.CVariable(scope, p.name.getText(), funcType.parameterTypes[i], { removeStorageSpecifier: true }); });
        if (funcType.instanceType)
            this.parameters.unshift(new variable_1.CVariable(scope, "this", funcType.instanceType, { removeStorageSpecifier: true }));
        for (var _i = 0, _a = funcType.closureParams; _i < _a.length; _i++) {
            var p = _a[_i];
            this.parameters.push(new variable_1.CVariable(scope, p.node.text, p.node, { removeStorageSpecifier: true }));
        }
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
        this.name = node.name && node.name.text;
        if (!this.name) {
            var funcExprName = "func";
            if (typeguards_1.isEqualsExpression(node.parent) && node.parent.right == node && ts.isIdentifier(node.parent.left))
                funcExprName = node.parent.left.text + "_func";
            if (ts.isVariableDeclaration(node.parent) && node.parent.initializer == node && ts.isIdentifier(node.parent.name))
                funcExprName = node.parent.name.text + "_func";
            this.name = root.symbolsHelper.addTemp(types_1.findParentSourceFile(node), funcExprName);
        }
        var funcType = root.typeHelper.getCType(node);
        this.funcDecl = new variable_1.CVariable(this, this.name, funcType.returnType, { removeStorageSpecifier: true, arraysToPointers: true });
        this.parameters = node.parameters.map(function (p, i) {
            return new variable_1.CVariable(_this, p.name.text, funcType.parameterTypes[i], { removeStorageSpecifier: true });
        });
        if (funcType.instanceType)
            this.parameters.unshift(new variable_1.CVariable(this, "this", funcType.instanceType, { removeStorageSpecifier: true }));
        if (funcType.needsClosureStruct) {
            var closureParamVarName = root.symbolsHelper.getClosureVarName(node);
            this.parameters.push(new variable_1.CVariable(this, closureParamVarName, funcType));
        }
        else {
            for (var _i = 0, _a = funcType.closureParams; _i < _a.length; _i++) {
                var p = _a[_i];
                var type = root.typeHelper.getCType(p.node);
                var ptype = p.assigned ? types_1.getTypeText(type) + "*" : type;
                this.parameters.push(new variable_1.CVariable(this, p.node.text, ptype, { removeStorageSpecifier: true }));
            }
        }
        this.variables = [];
        this.gcVarNames = root.memoryManager.getGCVariablesForScope(node);
        var _loop_1 = function (gcVarName) {
            if (root.variables.filter(function (v) { return v.name == gcVarName; }).length)
                return "continue";
            var gcType = gcVarName.indexOf("arrays") == -1 ? "ARRAY(void *)" : "ARRAY(ARRAY(void *))";
            root.variables.push(new variable_1.CVariable(root, gcVarName, gcType));
        };
        for (var _b = 0, _c = this.gcVarNames; _b < _c.length; _b++) {
            var gcVarName = _c[_b];
            _loop_1(gcVarName);
        }
        node.body.statements.forEach(function (s) { return _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, s)); });
        if (node.body.statements.length > 0 && node.body.statements[node.body.statements.length - 1].kind != ts.SyntaxKind.ReturnStatement) {
            this.destructors = new variable_1.CVariableDestructors(this, node);
        }
        var nodesInFunction = template_1.getAllNodesUnder(node);
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
    }
    CFunction = __decorate([
        template_1.CodeTemplate("\n{funcDecl}({parameters {, }=> {this}})\n{\n    {variables  {    }=> {this};\n}\n    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}\n\n    {statements {    }=> {this}}\n\n    {destructors}\n}")
    ], CFunction);
    return CFunction;
}());
exports.CFunction = CFunction;
var CFunctionExpression = /** @class */ (function () {
    function CFunctionExpression(scope, node) {
        this.expression = '';
        this.isClosureFunc = false;
        var func = new CFunction(scope.root, node);
        scope.root.functions.push(func);
        this.name = func.name;
        var type = scope.root.typeHelper.getCType(node);
        var parentFunc = types_1.findParentFunction(node.parent);
        if (parentFunc && type instanceof types_1.FuncType && type.needsClosureStruct) {
            this.isClosureFunc = true;
            this.closureVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            if (!scope.root.memoryManager.variableWasReused(node))
                scope.variables.push(new variable_1.CVariable(scope, this.closureVarName, type));
            this.allocator = new variable_1.CVariableAllocation(scope, this.closureVarName, type, node);
            var parentFuncType_1 = scope.root.typeHelper.getCType(parentFunc);
            var parentClosureVarName_1 = parentFuncType_1 && parentFuncType_1.needsClosureStruct && scope.root.symbolsHelper.getClosureVarName(parentFunc);
            this.closureParams = type.closureParams.map(function (p) {
                var key = p.node.text;
                var value = key;
                if (parentClosureVarName_1 && parentFuncType_1.closureParams.some(function (p) { return p.node.text === key; }))
                    value = parentClosureVarName_1 + "->" + key;
                return { key: key, value: value };
            });
        }
        if (ts.isFunctionExpression(node))
            this.expression = this.closureVarName || func.name;
    }
    CFunctionExpression = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if isClosureFunc}\n        {allocator}\n        {closureVarName}->func = {name};\n        {closureParams => {closureVarName}->{key} = {value};\n}\n    {/if}\n{/statements}\n{expression}", [ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.FunctionDeclaration])
    ], CFunctionExpression);
    return CFunctionExpression;
}());
exports.CFunctionExpression = CFunctionExpression;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../standard":14,"../template":42,"../typeguards":43,"../types":44,"./variable":11}],7:[function(require,module,exports){
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
var typeconvert_1 = require("./typeconvert");
var CArrayLiteralExpression = /** @class */ (function () {
    function CArrayLiteralExpression(scope, node) {
        this.universalWrapper = false;
        var arrSize = node.elements.length;
        var type = scope.root.typeHelper.getCType(node);
        if (type === types_1.UniversalVarType) {
            type = new types_1.ArrayType(types_1.UniversalVarType, 0, true);
            this.universalWrapper = true;
            scope.root.headerFlags.js_var_array = true;
        }
        if (type instanceof types_1.ArrayType) {
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
            this.expression = varName;
        }
        else
            this.expression = "/* Unsupported use of array literal expression */";
    }
    CArrayLiteralExpression = __decorate([
        template_1.CodeTemplate("\n{#if universalWrapper}\n    js_var_from_array({expression})\n{#else}\n    {expression}\n{/if}", ts.SyntaxKind.ArrayLiteralExpression)
    ], CArrayLiteralExpression);
    return CArrayLiteralExpression;
}());
var CObjectLiteralExpression = /** @class */ (function () {
    function CObjectLiteralExpression(scope, node) {
        var _this = this;
        this.expression = '';
        this.universalWrapper = false;
        var type = scope.root.typeHelper.getCType(node);
        if (type === types_1.UniversalVarType) {
            type = new types_1.DictType(types_1.UniversalVarType);
            this.universalWrapper = true;
            scope.root.headerFlags.js_var_dict = true;
        }
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
                .map(function (p) {
                var propName = (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text;
                return new assignment_1.CAssignment(scope, varName_1, _this.isDict ? '"' + propName + '"' : propName, type, p.initializer);
            });
            this.expression = varName_1;
        }
        else
            this.expression = "/* Unsupported use of object literal expression */";
    }
    CObjectLiteralExpression = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if isStruct || isDict}\n        {allocator}\n        {initializers}\n    {/if}\n{/statements}\n{#if universalWrapper}\n    js_var_from_dict({expression})\n{#else}\n    {expression}\n{/if}", ts.SyntaxKind.ObjectLiteralExpression)
    ], CObjectLiteralExpression);
    return CObjectLiteralExpression;
}());
exports.CObjectLiteralExpression = CObjectLiteralExpression;
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
    function CString(scope, nodeOrString) {
        this.universalWrapper = false;
        var s = typeof nodeOrString === 'string' ? '"' + nodeOrString + '"' : nodeOrString.getText();
        s = s.replace(/\\u([A-Fa-f0-9]{4})/g, function (match, g1) { return String.fromCharCode(parseInt(g1, 16)); });
        if (s.indexOf("'") == 0)
            this.value = '"' + s.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            this.value = s;
        if (typeof (nodeOrString) !== "string" && scope.root.typeHelper.getCType(nodeOrString) == types_1.UniversalVarType)
            this.value = new typeconvert_1.CAsUniversalVar(scope, this.value, types_1.StringVarType);
    }
    CString = __decorate([
        template_1.CodeTemplate("{value}", ts.SyntaxKind.StringLiteral)
    ], CString);
    return CString;
}());
exports.CString = CString;
var CNumber = /** @class */ (function () {
    function CNumber(scope, node) {
        this.universalWrapper = false;
        this.value = node.getText();
        if (scope.root.typeHelper.getCType(node) == types_1.UniversalVarType)
            this.value = new typeconvert_1.CAsUniversalVar(scope, this.value, types_1.NumberVarType);
    }
    CNumber = __decorate([
        template_1.CodeTemplate("{value}", ts.SyntaxKind.NumericLiteral)
    ], CNumber);
    return CNumber;
}());
exports.CNumber = CNumber;
var CBoolean = /** @class */ (function () {
    function CBoolean(scope, node) {
        this.value = node.kind == ts.SyntaxKind.TrueKeyword ? "TRUE" : "FALSE";
        scope.root.headerFlags.bool = true;
        if (scope.root.typeHelper.getCType(node) == types_1.UniversalVarType)
            this.value = new typeconvert_1.CAsUniversalVar(scope, this.value, types_1.BooleanVarType);
    }
    CBoolean = __decorate([
        template_1.CodeTemplate("{value}", [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword])
    ], CBoolean);
    return CBoolean;
}());
exports.CBoolean = CBoolean;
var CNull = /** @class */ (function () {
    function CNull(scope) {
        scope.root.headerFlags.js_var_from = true;
    }
    CNull = __decorate([
        template_1.CodeTemplate("js_var_from(JS_VAR_NULL)", ts.SyntaxKind.NullKeyword)
    ], CNull);
    return CNull;
}());
exports.CNull = CNull;
var CUndefined = /** @class */ (function () {
    function CUndefined(scope) {
        scope.root.headerFlags.js_var_from = true;
    }
    CUndefined = __decorate([
        template_1.CodeTemplate("js_var_from(JS_VAR_UNDEFINED)", ts.SyntaxKind.UndefinedKeyword)
    ], CUndefined);
    return CUndefined;
}());
exports.CUndefined = CUndefined;
var CNaN = /** @class */ (function () {
    function CNaN(scope, node) {
        scope.root.headerFlags.js_var_from = true;
    }
    CNaN = __decorate([
        template_1.CodeTemplate("js_var_from(JS_VAR_NAN)", ts.SyntaxKind.Count + 1)
    ], CNaN);
    return CNaN;
}());
exports.CNaN = CNaN;
var CThis = /** @class */ (function () {
    function CThis(scope, node) {
    }
    CThis = __decorate([
        template_1.CodeTemplate("this", ts.SyntaxKind.ThisKeyword)
    ], CThis);
    return CThis;
}());
exports.CThis = CThis;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":42,"../types":44,"./assignment":2,"./regexfunc":8,"./typeconvert":10,"./variable":11}],8:[function(require,module,exports){
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

},{"../regex":13,"../template":42,"./literals":7}],9:[function(require,module,exports){
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
var expressions_1 = require("./expressions");
var elementaccess_1 = require("./elementaccess");
var assignment_1 = require("./assignment");
var CLabeledStatement = /** @class */ (function () {
    function CLabeledStatement(scope, node) {
        var nodes = template_1.getAllNodesUnder(node);
        this.breakLabel = nodes.some(function (n) { return ts.isBreakStatement(n) && n.label.text === node.label.text; })
            ? " " + node.label.text + "_break:"
            : "";
        var hasContinue = nodes.some(function (n) { return ts.isContinueStatement(n) && n.label.text === node.label.text; });
        if (hasContinue) {
            if (ts.isForStatement(node.statement))
                this.statement = new CForStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isForOfStatement(node.statement))
                this.statement = new CForOfStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isWhileStatement(node.statement))
                this.statement = new CWhileStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isDoStatement(node.statement))
                this.statement = new CDoWhileStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isForInStatement(node.statement))
                this.statement = new CForInStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else
                this.statement = "/* Unsupported labeled statement " + node.getText() + " */";
        }
        else
            this.statement = template_1.CodeTemplateFactory.createForNode(scope, node.statement);
    }
    CLabeledStatement = __decorate([
        template_1.CodeTemplate("{statement}{breakLabel}", ts.SyntaxKind.LabeledStatement)
    ], CLabeledStatement);
    return CLabeledStatement;
}());
exports.CLabeledStatement = CLabeledStatement;
var CBreakStatement = /** @class */ (function () {
    function CBreakStatement(scope, node) {
        this.label = node.label && node.label.text + "_break";
    }
    CBreakStatement = __decorate([
        template_1.CodeTemplate("\n{#if label}\n    goto {label};\n{#else}\n    break;\n{/if}\n", ts.SyntaxKind.BreakStatement)
    ], CBreakStatement);
    return CBreakStatement;
}());
exports.CBreakStatement = CBreakStatement;
var CContinueStatement = /** @class */ (function () {
    function CContinueStatement(scope, node) {
        this.label = node.label && node.label.text + "_continue";
    }
    CContinueStatement = __decorate([
        template_1.CodeTemplate("\n{#if label}\n    goto {label};\n{#else}\n    continue;\n{/if}\n", ts.SyntaxKind.ContinueStatement)
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
        this.retVarName = null;
        this.closureParams = [];
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
        this.condition = new expressions_1.CCondition(scope, node.expression);
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
var CSwitchStatement = /** @class */ (function () {
    function CSwitchStatement(scope, node) {
        var _this = this;
        var exprType = scope.root.typeHelper.getCType(node.expression);
        this.nonIntegral = exprType != types_1.NumberVarType;
        this.expression = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        this.cases = node.caseBlock.clauses.map(function (clause, index) { return new CSwitchCaseClause(scope, clause, _this.nonIntegral ? index : null); });
        if (this.nonIntegral) {
            var tempVarName = scope.root.symbolsHelper.addTemp(node, "tmp_switch");
            scope.variables.push(new variable_1.CVariable(scope, tempVarName, types_1.NumberVarType));
            this.values = node.caseBlock.clauses.filter(function (c) { return ts.isCaseClause(c); }).map(function (clause, index) { return new CSwitchCaseCompare(scope, _this.expression, clause, index); });
            this.switch = tempVarName;
        }
        else
            this.switch = this.expression;
    }
    CSwitchStatement = __decorate([
        template_1.CodeTemplate("\n{#if nonIntegral}\n    {switch} = {values {\n        : }=> {this}}\n        : -1;\n{/if}\nswitch ({switch}) {\n    {cases {    }=> {this}\n}\n}\n", ts.SyntaxKind.SwitchStatement)
    ], CSwitchStatement);
    return CSwitchStatement;
}());
exports.CSwitchStatement = CSwitchStatement;
var CSwitchCaseClause = /** @class */ (function () {
    function CSwitchCaseClause(scope, clause, index) {
        this.variables = [];
        this.statements = [];
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.defaultClause = clause.kind === ts.SyntaxKind.DefaultClause;
        if (index != null)
            this.value = "" + index;
        else if (ts.isCaseClause(clause))
            this.value = template_1.CodeTemplateFactory.createForNode(scope, clause.expression);
        for (var _i = 0, _a = clause.statements; _i < _a.length; _i++) {
            var s = _a[_i];
            var statement = template_1.CodeTemplateFactory.createForNode(this, s);
            this.statements.push(statement);
        }
    }
    CSwitchCaseClause = __decorate([
        template_1.CodeTemplate("\n{#if !defaultClause}\n    case {value}:\n{#else}\n    default:\n{/if}\n        {statements {        }=> {this}}\n")
    ], CSwitchCaseClause);
    return CSwitchCaseClause;
}());
var CSwitchCaseCompare = /** @class */ (function () {
    function CSwitchCaseCompare(scope, expression, clause, index) {
        this.expression = expression;
        this.index = index;
        this.value = template_1.CodeTemplateFactory.createForNode(scope, clause.expression);
    }
    CSwitchCaseCompare = __decorate([
        template_1.CodeTemplate("!strcmp({expression}, {value}) ? {index}")
    ], CSwitchCaseCompare);
    return CSwitchCaseCompare;
}());
var CWhileStatement = /** @class */ (function () {
    function CWhileStatement(scope, node, continueLabel) {
        this.continueLabel = continueLabel;
        this.variables = [];
        this.statements = [];
        this.block = new CBlock(scope, node.statement);
        this.variables = this.block.variables;
        this.statements = this.block.statements;
        this.condition = new expressions_1.CCondition(scope, node.expression);
    }
    CWhileStatement = __decorate([
        template_1.CodeTemplate("\n{#if continueLabel}\n    while({condition}) {\n        {variables {    }=> {this};\n}\n        {statements {    }=> {this}}\n        {continueLabel}: ;\n    }\n{#else}\n    while ({condition})\n    {block}\n{/if}", ts.SyntaxKind.WhileStatement)
    ], CWhileStatement);
    return CWhileStatement;
}());
exports.CWhileStatement = CWhileStatement;
var CDoWhileStatement = /** @class */ (function () {
    function CDoWhileStatement(scope, node, continueLabel) {
        this.continueLabel = continueLabel;
        this.variables = [];
        this.statements = [];
        this.block = new CBlock(scope, node.statement);
        this.variables = this.block.variables;
        this.statements = this.block.statements;
        this.condition = new expressions_1.CCondition(scope, node.expression);
    }
    CDoWhileStatement = __decorate([
        template_1.CodeTemplate("\n{#if continueLabel}\n    do {\n        {variables {    }=> {this};\n}\n        {statements {    }=> {this}}\n        {continueLabel}: ;\n    } while ({condition});\n{#else}\n    do\n    {block}\n    while ({condition});\n{/if}", ts.SyntaxKind.DoStatement)
    ], CDoWhileStatement);
    return CDoWhileStatement;
}());
exports.CDoWhileStatement = CDoWhileStatement;
var CForStatement = /** @class */ (function () {
    function CForStatement(scope, node, continueLabel) {
        this.continueLabel = continueLabel;
        this.variables = [];
        this.statements = [];
        this.varDecl = null;
        this.block = new CBlock(scope, node.statement);
        this.variables = this.block.variables;
        this.statements = this.block.statements;
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            var declList = node.initializer;
            this.varDecl = new variable_1.CVariableDeclaration(scope, declList.declarations[0]);
            this.init = "";
        }
        else
            this.init = template_1.CodeTemplateFactory.createForNode(scope, node.initializer);
        this.condition = new expressions_1.CCondition(scope, node.condition);
        this.increment = node.incrementor ? template_1.CodeTemplateFactory.createForNode(scope, node.incrementor) : "";
    }
    CForStatement = __decorate([
        template_1.CodeTemplate("\n{#if varDecl}\n    {varDecl}\n{/if}\n{#if continueLabel}\n    {init};\n    while({condition}) {\n        {variables {    }=> {this};\n}\n        {statements {    }=> {this}}\n        {continueLabel}:\n        {increment};\n    }\n{#else}\n    for ({init};{condition};{increment})\n    {block}\n{/if}", ts.SyntaxKind.ForStatement)
    ], CForStatement);
    return CForStatement;
}());
exports.CForStatement = CForStatement;
var CForOfStatement = /** @class */ (function () {
    function CForOfStatement(scope, node, continueLabel) {
        this.continueLabel = continueLabel;
        this.variables = [];
        this.statements = [];
        this.cast = "";
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
        var arrType = scope.root.typeHelper.getCType(node.expression);
        var varAccess = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        this.elementAccess = new elementaccess_1.CSimpleElementAccess(scope, arrType, varAccess, this.iteratorVarName);
        this.arraySize = new elementaccess_1.CArraySize(scope, varAccess, arrType);
        if (arrType && arrType instanceof types_1.ArrayType && arrType.elementType instanceof types_1.ArrayType && arrType.elementType.isDynamicArray)
            this.cast = "(void *)";
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            var declInit = node.initializer.declarations[0];
            scope.variables.push(new variable_1.CVariable(scope, declInit.name.getText(), declInit.name));
            this.init = declInit.name.getText();
        }
        else
            this.init = new elementaccess_1.CElementAccess(scope, node.initializer);
        this.statements.push(template_1.CodeTemplateFactory.createForNode(this, node.statement));
        scope.variables = scope.variables.concat(this.variables);
        this.variables = [];
    }
    CForOfStatement = __decorate([
        template_1.CodeTemplate("\n{#if continueLabel}\n    {iteratorVarName} = 0;\n    while ({iteratorVarName} < {arraySize}) {\n        {variables {    }=> {this};\n}\n        {init} = {cast}{elementAccess};\n    {statements {    }=> {this}}\n        {continueLabel}:\n        {iteratorVarName}++;\n    }\n{#else}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)\n    {\n        {variables {    }=> {this};\n}\n        {init} = {cast}{elementAccess};\n        {statements {    }=> {this}}\n    }\n{/if}\n", ts.SyntaxKind.ForOfStatement)
    ], CForOfStatement);
    return CForOfStatement;
}());
exports.CForOfStatement = CForOfStatement;
var CForInStatement = /** @class */ (function () {
    function CForInStatement(scope, node, continueLabel) {
        this.continueLabel = continueLabel;
        this.variables = [];
        this.statements = [];
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
        this.varAccess = new elementaccess_1.CElementAccess(scope, node.expression);
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
        template_1.CodeTemplate("\n{#if continueLabel}\n    {iteratorVarName} = 0;\n    while ({iteratorVarName} < {varAccess}->index->size) {\n        {variables {    }=> {this};\n}\n        {init} = {varAccess}->index->data[{iteratorVarName}];\n        {statements {    }=> {this}}\n        {continueLabel}:\n        {iteratorVarName}++;\n    }\n{#else}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->index->size; {iteratorVarName}++)\n    {\n        {variables {    }=> {this};\n}\n        {init} = {varAccess}->index->data[{iteratorVarName}];\n        {statements {    }=> {this}}\n    }\n{/if}\n", ts.SyntaxKind.ForInStatement)
    ], CForInStatement);
    return CForInStatement;
}());
exports.CForInStatement = CForInStatement;
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
        if (ts.isBlock(node)) {
            node.statements.forEach(function (s) { return _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, s)); });
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
var CImport = /** @class */ (function () {
    function CImport(scope, node) {
        var moduleName = node.moduleSpecifier.text;
        this.externalInclude = moduleName.indexOf('ts2c-target') == 0;
        if (this.externalInclude) {
            moduleName = moduleName.split('/').slice(1).join('/');
            if (moduleName.slice(-6) == "/index")
                moduleName = moduleName.slice(0, -6);
            if (scope.root.includes.indexOf(moduleName) == -1)
                scope.root.includes.push(moduleName);
        }
        this.nodeText = node.getText();
    }
    CImport = __decorate([
        template_1.CodeTemplate("", ts.SyntaxKind.ImportDeclaration)
    ], CImport);
    return CImport;
}());
exports.CImport = CImport;
var CTryStatement = /** @class */ (function () {
    function CTryStatement(scope, node) {
        this.tryBlock = new CBlock(scope, node.tryBlock);
        this.catchBlock = node.catchClause ? new CBlock(scope, node.catchClause.block) : "";
        this.finallyBlock = node.finallyBlock ? new CBlock(scope, node.finallyBlock) : "";
        this.catchVarName = node.catchClause && node.catchClause.variableDeclaration && node.catchClause.variableDeclaration.name.getText();
        if (this.catchVarName)
            scope.variables.push(new variable_1.CVariable(scope, this.catchVarName, types_1.StringVarType));
        scope.root.headerFlags.try_catch = true;
    }
    CTryStatement = __decorate([
        template_1.CodeTemplate("\nTRY\n{tryBlock}\nCATCH\n{#if catchVarName}\n        {catchVarName} = err_defs->data[err_val - 1];\n{/if}\n{catchBlock}\n{finallyBlock}\nEND_TRY\n", ts.SyntaxKind.TryStatement)
    ], CTryStatement);
    return CTryStatement;
}());
exports.CTryStatement = CTryStatement;
var CThrowStatement = /** @class */ (function () {
    function CThrowStatement(scope, node) {
        this.value = template_1.CodeTemplateFactory.createForNode(scope, node.expression);
        scope.root.headerFlags.try_catch = true;
    }
    CThrowStatement = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    ARRAY_PUSH(err_defs, {value});\n{/statements}\nTHROW(err_defs->size);\n", ts.SyntaxKind.ThrowStatement)
    ], CThrowStatement);
    return CThrowStatement;
}());
exports.CThrowStatement = CThrowStatement;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":42,"../types":44,"./assignment":2,"./elementaccess":4,"./expressions":5,"./variable":11}],10:[function(require,module,exports){
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
var types_1 = require("../types");
var template_1 = require("../template");
var typeguards_1 = require("../typeguards");
var elementaccess_1 = require("./elementaccess");
var variable_1 = require("./variable");
var CAsUniversalVar = /** @class */ (function () {
    function CAsUniversalVar(scope, expr, type) {
        this.expression = typeguards_1.isNode(expr) ? template_1.CodeTemplateFactory.createForNode(scope, expr) : expr;
        type = type || typeguards_1.isNode(expr) && scope.root.typeHelper.getCType(expr);
        this.isUniversalVar = type === types_1.UniversalVarType;
        this.isString = type === types_1.StringVarType;
        this.isNumber = type === types_1.NumberVarType;
        this.isBoolean = type === types_1.BooleanVarType;
        this.isArray = type instanceof types_1.ArrayType;
        this.isDict = type instanceof types_1.StructType || type instanceof types_1.DictType;
        if (type === types_1.StringVarType)
            scope.root.headerFlags.js_var_from_str = true;
        if (type === types_1.NumberVarType)
            scope.root.headerFlags.js_var_from_int16_t = true;
        if (type === types_1.BooleanVarType)
            scope.root.headerFlags.js_var_from_uint8_t = true;
        if (type instanceof types_1.ArrayType)
            scope.root.headerFlags.js_var_array = true;
        if (type instanceof types_1.StructType || type instanceof types_1.DictType)
            scope.root.headerFlags.js_var_dict = true;
        scope.root.headerFlags.js_var = true;
    }
    CAsUniversalVar = __decorate([
        template_1.CodeTemplate("\n{#if isUniversalVar}\n    {expression}\n{#elseif isString}\n    js_var_from_str({expression})\n{#elseif isNumber}\n    js_var_from_int16_t({expression})\n{#elseif isBoolean}\n    js_var_from_uint8_t({expression})\n{#elseif isArray}\n    js_var_from_array({expression})\n{#elseif isDict}\n    js_var_from_dict({expression})\n{#else}\n    /** converting {expression} to js_var is not supported yet */\n{/if}")
    ], CAsUniversalVar);
    return CAsUniversalVar;
}());
exports.CAsUniversalVar = CAsUniversalVar;
var CAsNumber = /** @class */ (function () {
    function CAsNumber(scope, expr, type) {
        this.type = type;
        this.isSingleElementStaticArray = false;
        this.expression = typeguards_1.isNode(expr) ? template_1.CodeTemplateFactory.createForNode(scope, expr) : expr;
        type = type || typeguards_1.isNode(expr) && scope.root.typeHelper.getCType(expr);
        this.isNumber = type === types_1.NumberVarType;
        this.isString = type === types_1.StringVarType;
        this.isBoolean = type === types_1.BooleanVarType;
        this.isUniversalVar = type === types_1.UniversalVarType;
        if (type instanceof types_1.ArrayType && !type.isDynamicArray && type.capacity === 1) {
            this.isSingleElementStaticArray = true;
            this.arrayFirstElementAsNumber = new CAsNumber_1(scope, new elementaccess_1.CSimpleElementAccess(scope, type, this.expression, "0"), type.elementType);
        }
        if (this.isString)
            scope.root.headerFlags.str_to_int16_t = true;
        if (this.isUniversalVar)
            scope.root.headerFlags.js_var_to_number = true;
        if (!this.isNumber && !this.isBoolean && !this.isString && !this.isUniversalVar && !this.isSingleElementStaticArray)
            scope.root.headerFlags.js_var_from = true;
    }
    CAsNumber_1 = CAsNumber;
    CAsNumber = CAsNumber_1 = __decorate([
        template_1.CodeTemplate("\n{#if isNumber || isBoolean}\n    {expression}\n{#elseif isString}\n    str_to_int16_t({expression})\n{#elseif isUniversalVar}\n    js_var_to_number({expression})\n{#elseif isSingleElementStaticArray}\n    {arrayFirstElementAsNumber}\n{#else}\n    js_var_from(JS_VAR_NAN)\n{/if}")
    ], CAsNumber);
    return CAsNumber;
    var CAsNumber_1;
}());
exports.CAsNumber = CAsNumber;
var CAsString = /** @class */ (function () {
    function CAsString(scope, node) {
        var type = scope.root.typeHelper.getCType(node);
        this.arg = template_1.CodeTemplateFactory.createForNode(scope, node);
        this.isNumberLiteral = ts.isNumericLiteral(node);
        this.isNumber = !this.isNumberLiteral && type === types_1.NumberVarType;
        this.isString = type === types_1.StringVarType;
        this.isBoolean = type === types_1.BooleanVarType;
        this.isUniversalVar = type === types_1.UniversalVarType;
        this.isArray = type instanceof types_1.ArrayType;
        if (this.isNumber || this.isArray || this.isUniversalVar) {
            this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "buf");
            scope.variables.push(new variable_1.CVariable(scope, this.tmpVarName, "char *"));
            scope.root.headerFlags.gc_iterator = true;
        }
        if (this.isNumber)
            scope.root.headerFlags.str_int16_t_buflen = true;
        if (type instanceof types_1.ArrayType) {
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            var arrayElement = new elementaccess_1.CSimpleElementAccess(scope, type, this.arg, this.iteratorVarName);
            this.arrayElementCat = new CAsString_Concat(scope, node, this.tmpVarName, arrayElement, type.elementType);
            this.arraySize = new elementaccess_1.CArraySize(scope, this.arg, type);
            this.arrayStrLen = new CAsString_Length(scope, node, this.arg, type);
        }
    }
    CAsString = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if isNumber}\n        {tmpVarName} = malloc(STR_INT16_T_BUFLEN);\n        assert({tmpVarName} != NULL);\n        sprintf({tmpVarName}, \"%d\", {arg});\n        ARRAY_PUSH(gc_main, (void *){tmpVarName});\n    {#elseif isUniversalVar}\n        {tmpVarName} = js_var_to_str({arg}, &{needDisposeVarName});\n        if ({needDisposeVarName})\n            ARRAY_PUSH(gc_main, (void *){tmpVarName});\n    {#elseif isArray}\n        {tmpVarName} = malloc({arrayStrLen});\n        assert({tmpVarName} != NULL);\n        {tmpVarName}[0] = '\\0';\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n            if ({iteratorVarName} != 0)\n                strcat({tmpVarName}, \",\");\n            {arrayElementCat}\n        }\n        ARRAY_PUSH(gc_main, (void *){tmpVarName});\n    {/if}\n{/statements}\n{#if isNumberLiteral}\n    \"{arg}\"\n{#elseif isString}\n    {arg}\n{#elseif isBoolean}\n    ({arg} ? \"true\" : \"false\")\n{#elseif isUniversalVar || isArray || isNumber}\n    {tmpVarName}\n{#else}\n    \"[object Object]\"\n{/if}")
    ], CAsString);
    return CAsString;
}());
exports.CAsString = CAsString;
var CAsString_Length = /** @class */ (function () {
    function CAsString_Length(scope, node, arg, type) {
        var _this = this;
        this.arg = arg;
        this.type = type;
        this.isNumber = type === types_1.NumberVarType;
        this.isString = type === types_1.StringVarType;
        this.isBoolean = type === types_1.BooleanVarType;
        this.isArrayOfString = type instanceof types_1.ArrayType && type.elementType === types_1.StringVarType;
        this.isArrayOfNumber = type instanceof types_1.ArrayType && type.elementType === types_1.NumberVarType;
        this.isArrayOfBoolean = type instanceof types_1.ArrayType && type.elementType === types_1.BooleanVarType;
        this.isArrayOfUniversalVar = type instanceof types_1.ArrayType && type.elementType === types_1.UniversalVarType;
        this.isArrayOfArray = type instanceof types_1.ArrayType && type.elementType instanceof Array;
        this.isArrayOfObj = type instanceof types_1.ArrayType && (type.elementType instanceof types_1.DictType || type.elementType instanceof types_1.StructType);
        this.arraySize = type instanceof types_1.ArrayType && new elementaccess_1.CArraySize(scope, arg, type);
        if (this.isArrayOfString || this.isArrayOfUniversalVar) {
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            this.arrayElement = new elementaccess_1.CSimpleElementAccess(scope, type, arg, this.iteratorVarName);
            this.lengthVarName = scope.root.symbolsHelper.addTemp(node, "len");
            scope.variables.push(new variable_1.CVariable(scope, this.lengthVarName, types_1.NumberVarType));
            scope.root.headerFlags.strings = true;
        }
        if (this.isArrayOfUniversalVar) {
            this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "tmp", false);
            this.needDisposeVarName = scope.root.symbolsHelper.addTemp(node, "need_dispose", false);
            if (!scope.variables.some(function (v) { return v.name == _this.tmpVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, this.tmpVarName, types_1.StringVarType));
            if (!scope.variables.some(function (v) { return v.name == _this.needDisposeVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, this.needDisposeVarName, types_1.BooleanVarType));
            scope.root.headerFlags.js_var_to_str = true;
        }
    }
    CAsString_Length = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if isArrayOfString}\n        {lengthVarName} = {arraySize};\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)\n            {lengthVarName} += strlen({arrayElement});\n    {#elseif isArrayOfUniversalVar}\n        {lengthVarName} = {arraySize};\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n            {lengthVarName} += strlen({tmpVarName} = js_var_to_str({arrayElement}, &{needDisposeVarName}));\n            if ({needDisposeVarName})\n                free((void *){tmpVarName});\n        }\n    {/if}\n{/statements}\n{#if isNumber}\n    STR_INT16_T_BUFLEN\n{#elseif isString}\n    strlen({arg})\n{#elseif isBoolean}\n    (5-{arg})\n{#elseif isArrayOfNumber}\n    (STR_INT16_T_BUFLEN + 1) * {arraySize}\n{#elseif isArrayOfBoolean}\n    6 * {arraySize}\n{#elseif isArrayOfObj}\n    16 * {arraySize}\n{#elseif isArrayOfString || isArrayOfUniversalVar}\n    {lengthVarName}\n{#elseif isArrayOfArray}\n    /* determining string length of array {arg} is not supported yet */\n{#else}\n    15\n{/if}")
    ], CAsString_Length);
    return CAsString_Length;
}());
exports.CAsString_Length = CAsString_Length;
var CAsString_Concat = /** @class */ (function () {
    function CAsString_Concat(scope, node, buf, arg, type) {
        var _this = this;
        this.buf = buf;
        this.arg = arg;
        this.type = type;
        this.isArray = false;
        this.isNumber = type === types_1.NumberVarType;
        this.isString = type === types_1.StringVarType;
        this.isBoolean = type === types_1.BooleanVarType;
        this.isUniversalVar = type === types_1.UniversalVarType;
        if (this.isNumber)
            scope.root.headerFlags.str_int16_t_cat = true;
        if (this.isUniversalVar) {
            this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "tmp", false);
            this.needDisposeVarName = scope.root.symbolsHelper.addTemp(node, "need_dispose", false);
            if (!scope.variables.some(function (v) { return v.name == _this.tmpVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, this.tmpVarName, types_1.StringVarType));
            if (!scope.variables.some(function (v) { return v.name == _this.needDisposeVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, this.needDisposeVarName, types_1.BooleanVarType));
            scope.root.headerFlags.js_var_to_str = true;
        }
        if (type instanceof types_1.ArrayType) {
            this.isArray = true;
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            var arrayElement = new elementaccess_1.CSimpleElementAccess(scope, type, arg, this.iteratorVarName);
            this.arrayElementCat = new CAsString_Concat_1(scope, node, buf, arrayElement, type.elementType);
            this.arraySize = new elementaccess_1.CArraySize(scope, arg, type);
        }
    }
    CAsString_Concat_1 = CAsString_Concat;
    CAsString_Concat = CAsString_Concat_1 = __decorate([
        template_1.CodeTemplate("\n{#if isNumber}\n    str_int16_t_cat({buf}, {arg});\n{#elseif isString}\n    strcat({buf}, {arg});\n{#elseif isBoolean}\n    strcat({buf}, {arg} ? \"true\" : \"false\");\n{#elseif isUniversalVar}\n    strcat({buf}, ({tmpVarName} = js_var_to_str({arg}, &{needDisposeVarName})));\n    if ({needDisposeVarName})\n        free((void *){tmpVarName});\n{#elseif isArray}\n    for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n        if ({iteratorVarName} != 0)\n            strcat({buf}, \",\");\n        {arrayElementCat}\n    }\n{#else}\n    strcat({buf}, \"[object Object]\");\n{/if}\n")
    ], CAsString_Concat);
    return CAsString_Concat;
    var CAsString_Concat_1;
}());
exports.CAsString_Concat = CAsString_Concat;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":42,"../typeguards":43,"../types":44,"./elementaccess":4,"./variable":11}],11:[function(require,module,exports){
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
var typeguards_1 = require("../typeguards");
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
        var name = varDecl.name.getText();
        var type = scope.root.typeHelper.getCType(varDecl.name);
        if (type instanceof types_1.ArrayType && !type.isDynamicArray && ts.isArrayLiteralExpression(varDecl.initializer)) {
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
                return;
            }
        }
        if (!scope.variables.some(function (v) { return v.name === name; }))
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
        this.needAllocateStruct = varType instanceof types_1.StructType || varType instanceof types_1.FuncType && varType.needsClosureStruct;
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
        if (varType instanceof types_1.ArrayType && varType.elementType == types_1.UniversalVarType)
            scope.root.headerFlags.js_var_array = true;
        if (varType instanceof types_1.DictType && varType.elementType == types_1.UniversalVarType)
            scope.root.headerFlags.js_var_dict = true;
        else if (this.needAllocateDict)
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
var CTempVarReplacement = /** @class */ (function () {
    function CTempVarReplacement(scope, node, inlineCall, type) {
        this.inlineCall = inlineCall;
        this.type = type;
        this.varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
        this.reused = scope.root.memoryManager.variableWasReused(node);
        this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
        if (!this.reused)
            scope.variables.push(new CVariable(scope, this.varName, type));
        if (this.gcVarName) {
            scope.root.headerFlags.array = true;
            scope.root.headerFlags.gc_iterator = true;
        }
    }
    CTempVarReplacement = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if gcVarName}\n        {varName} = {inlineCall};\n        ARRAY_PUSH({gcVarName}, (void *){varName});\n    {/if}\n{/statements}\n{#if gcVarName}\n    {varName}\n{#elseif reused}\n    {inlineCall}\n{#else}\n    ({varName} = {inlineCall})\n{/if}")
    ], CTempVarReplacement);
    return CTempVarReplacement;
}());
exports.CTempVarReplacement = CTempVarReplacement;
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
        var type = typeguards_1.isNode(typeSource) ? scope.root.typeHelper.getCType(typeSource) : typeSource;
        if (type instanceof types_1.StructType)
            scope.root.symbolsHelper.ensureStruct(type, name);
        else if (type instanceof types_1.ArrayType && type.isDynamicArray)
            scope.root.symbolsHelper.ensureArrayStruct(type.elementType);
        else if (type instanceof types_1.FuncType && type.closureParams.length)
            scope.root.symbolsHelper.ensureClosureStruct(type, name);
        if (this.typeHasNumber(type))
            scope.root.headerFlags.int16_t = true;
        if (type == types_1.BooleanVarType)
            scope.root.headerFlags.bool = true;
        if (type instanceof types_1.ArrayType && type.elementType == types_1.UniversalVarType)
            scope.root.headerFlags.js_var_dict = true;
        if (type instanceof types_1.DictType && type.elementType == types_1.UniversalVarType)
            scope.root.headerFlags.js_var_dict = true;
        // root scope, make variables file-scoped by default
        if (scope.parent == null)
            this.static = true;
        if (options && options.removeStorageSpecifier)
            this.static = false;
        this.arraysToPointers = options && options.arraysToPointers;
        if (options && options.initializer)
            this.initializer = options.initializer;
        this.type = type;
        this.typeHelper = scope.root.typeHelper;
    }
    CVariable.prototype.typeHasNumber = function (type) {
        var _this = this;
        return type == types_1.NumberVarType
            || type instanceof types_1.ArrayType && this.typeHasNumber(type.elementType)
            || type instanceof types_1.ArrayType && type.isDynamicArray
            || type instanceof types_1.StructType && Object.keys(type.properties).some(function (k) { return _this.typeHasNumber(type.properties[k]); })
            || type instanceof types_1.DictType;
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
}());
exports.CVariable = CVariable;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../template":42,"../typeguards":43,"../types":44,"./assignment":2}],12:[function(require,module,exports){
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
var variable_1 = require("./nodes/variable");
// these imports are here only because it is necessary to run decorators
require("./nodes/statements");
require("./nodes/expressions");
require("./nodes/call");
require("./nodes/literals");
require("./nodes/function");
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
require("./standard/number/number");
require("./standard/console/log");
var typeguards_1 = require("./typeguards");
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
                            n.parent.kind = typeguards_1.SyntaxKind_NaNKeyword;
                    }
                    else
                        n.kind = typeguards_1.SyntaxKind_NaNKeyword;
                }
                if (symbol) {
                    if (tsTypeChecker.isUndefinedSymbol(symbol))
                        n.kind = ts.SyntaxKind.UndefinedKeyword;
                }
            }
        }
        this.typeHelper = new types_1.TypeHelper(tsTypeChecker, nodes);
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
        template_1.CodeTemplate("\n{#if headerFlags.strings || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat\n    || headerFlags.str_pos || headerFlags.str_rpos || headerFlags.array_str_cmp\n    || headerFlags.str_substring\n    || headerFlags.array_insert || headerFlags.array_remove || headerFlags.dict || headerFlags.js_var_dict\n    || headerFlags.js_var_from_str || headerFlags.js_var_to_str || headerFlags.js_var_eq || headerFlags.js_var_plus\n    || headerFlags.js_var_lessthan}\n    #include <string.h>\n{/if}\n{#if headerFlags.malloc || headerFlags.array || headerFlags.str_substring || headerFlags.str_slice\n    || headerFlags.str_to_int16_t || headerFlags.js_var_to_number || headerFlags.js_var_plus\n    || headerFlags.js_var_from_str || headerFlags.js_var_get || headerFlags.try_catch}\n    #include <stdlib.h>\n{/if}\n{#if headerFlags.malloc || headerFlags.array || headerFlags.str_substring || headerFlags.str_slice\n    || headerFlags.str_to_int16_t || headerFlags.js_var_to_number || headerFlags.js_var_plus \n    || headerFlags.js_var_from_str || headerFlags.js_var_get || headerFlags.try_catch}\n    #include <assert.h>\n{/if}\n{#if headerFlags.printf || headerFlags.parse_int16_t}\n    #include <stdio.h>\n{/if}\n{#if headerFlags.str_int16_t_buflen || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat || headerFlags.js_var_to_str || headerFlags.js_var_plus || headerFlags.js_var_lessthan}\n    #include <limits.h>\n{/if}\n{#if headerFlags.str_to_int16_t || headerFlags.js_var_get || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_lessthan}\n    #include <ctype.h>\n{/if}\n{#if headerFlags.try_catch || headerFlags.js_var_get}\n    #include <setjmp.h>\n{/if}\n\n{#if includes.length}\n    {includes => #include <{this}>\n}\n{/if}\n\n{#if headerFlags.bool || headerFlags.js_var_to_bool || headerFlags.js_var_eq || headerFlags.dict_remove }\n    #define TRUE 1\n    #define FALSE 0\n{/if}\n{#if headerFlags.bool || headerFlags.js_var || headerFlags.str_to_int16_t}\n    typedef unsigned char uint8_t;\n{/if}\n{#if headerFlags.int16_t || headerFlags.js_var || headerFlags.array ||\n     headerFlags.str_int16_t_cmp || headerFlags.str_pos || headerFlags.str_len ||\n     headerFlags.str_char_code_at || headerFlags.str_substring || headerFlags.str_slice ||\n     headerFlags.regex || headerFlags.str_to_int16_t || headerFlags.array_string_t ||\n     headerFlags.try_catch || headerFlags.parse_int16_t }\n    typedef short int16_t;\n{/if}\n{#if headerFlags.uint16_t || headerFlags.js_var_compute}\n    typedef unsigned short uint16_t;\n{/if}\n{#if headerFlags.regex}\n    struct regex_indices_struct_t {\n        int16_t index;\n        int16_t end;\n    };\n    struct regex_match_struct_t {\n        int16_t index;\n        int16_t end;\n        struct regex_indices_struct_t *matches;\n        int16_t matches_count;\n    };\n    typedef struct regex_match_struct_t regex_func_t(const char*, int16_t);\n    struct regex_struct_t {\n        const char * str;\n        regex_func_t * func;\n    };\n{/if}\n\n{#if headerFlags.gc_iterator || headerFlags.gc_iterator2 || headerFlags.dict || headerFlags.js_var_plus || headerFlags.js_var_get}\n    #define ARRAY(T) struct {\\\n        int16_t size;\\\n        int16_t capacity;\\\n        T *data;\\\n    } *\n{/if}\n\n{#if headerFlags.array || headerFlags.dict || headerFlags.js_var_dict || headerFlags.js_var_plus || headerFlags.try_catch || headerFlags.js_var_get}\n    #define ARRAY_CREATE(array, init_capacity, init_size) {\\\n        array = malloc(sizeof(*array)); \\\n        array->data = malloc((init_capacity) * sizeof(*array->data)); \\\n        assert(array->data != NULL); \\\n        array->capacity = init_capacity; \\\n        array->size = init_size; \\\n    }\n    #define ARRAY_PUSH(array, item) {\\\n        if (array->size == array->capacity) {  \\\n            array->capacity *= 2;  \\\n            array->data = realloc(array->data, array->capacity * sizeof(*array->data)); \\\n            assert(array->data != NULL); \\\n        }  \\\n        array->data[array->size++] = item; \\\n    }\n{/if}\n{#if headerFlags.array_pop}\n\t#define ARRAY_POP(a) (a->size != 0 ? a->data[--a->size] : 0)\n{/if}\n{#if headerFlags.array_insert || headerFlags.dict || headerFlags.js_var_dict}\n    #define ARRAY_INSERT(array, pos, item) {\\\n        ARRAY_PUSH(array, item); \\\n        if (pos < array->size - 1) {\\\n            memmove(&(array->data[(pos) + 1]), &(array->data[pos]), (array->size - (pos) - 1) * sizeof(*array->data)); \\\n            array->data[pos] = item; \\\n        } \\\n    }\n{/if}\n{#if headerFlags.array_remove}\n    #define ARRAY_REMOVE(array, pos, num) {\\\n        memmove(&(array->data[pos]), &(array->data[(pos) + num]), (array->size - (pos) - num) * sizeof(*array->data)); \\\n        array->size -= num; \\\n    }\n{/if}\n\n{#if headerFlags.dict}\n    #define DICT(T) struct { \\\n        ARRAY(const char *) index; \\\n        ARRAY(T) values; \\\n    } *\n{/if}\n\n{#if headerFlags.dict || headerFlags.js_var_dict || headerFlags.dict_find_pos}\n    int16_t dict_find_pos(const char ** keys, int16_t keys_size, const char * key) {\n        int16_t low = 0;\n        int16_t high = keys_size - 1;\n\n        if (keys_size == 0 || key == NULL)\n            return -1;\n\n        while (low <= high)\n        {\n            int mid = (low + high) / 2;\n            int res = strcmp(keys[mid], key);\n\n            if (res == 0)\n                return mid;\n            else if (res < 0)\n                low = mid + 1;\n            else\n                high = mid - 1;\n        }\n\n        return -1 - low;\n    }\n{/if}\n\n{#if headerFlags.dict || headerFlags.js_var_dict}\n    #define DICT_CREATE(dict, init_capacity) { \\\n        dict = malloc(sizeof(*dict)); \\\n        ARRAY_CREATE(dict->index, init_capacity, 0); \\\n        ARRAY_CREATE(dict->values, init_capacity, 0); \\\n    }\n    \n    int16_t tmp_dict_pos;\n    #define DICT_GET(dict, prop, default) ((tmp_dict_pos = dict_find_pos(dict->index->data, dict->index->size, prop)) < 0 ? default : dict->values->data[tmp_dict_pos])\n\n    int16_t tmp_dict_pos2;\n    #define DICT_SET(dict, prop, value) { \\\n        tmp_dict_pos2 = dict_find_pos(dict->index->data, dict->index->size, prop); \\\n        if (tmp_dict_pos2 < 0) { \\\n            tmp_dict_pos2 = -tmp_dict_pos2 - 1; \\\n            ARRAY_INSERT(dict->index, tmp_dict_pos2, prop); \\\n            ARRAY_INSERT(dict->values, tmp_dict_pos2, value); \\\n        } else \\\n            dict->values->data[tmp_dict_pos2] = value; \\\n    }\n\n{/if}\n\n{#if headerFlags.str_int16_t_buflen || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_to_str || headerFlags.js_var_lessthan}\n    #define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)\n{/if}\n{#if headerFlags.str_int16_t_cmp}\n    int str_int16_t_cmp(const char * str, int16_t num) {\n        char numstr[STR_INT16_T_BUFLEN];\n        sprintf(numstr, \"%d\", num);\n        return strcmp(str, numstr);\n    }\n{/if}\n{#if headerFlags.str_pos}\n    int16_t str_pos(const char * str, const char *search) {\n        int16_t i;\n        const char * found = strstr(str, search);\n        int16_t pos = 0;\n        if (found == 0)\n            return -1;\n        while (*str && str < found) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        return pos;\n    }\n{/if}\n{#if headerFlags.str_rpos}\n    int16_t str_rpos(const char * str, const char *search) {\n        int16_t i;\n        const char * found = strstr(str, search);\n        int16_t pos = 0;\n        const char * end = str + (strlen(str) - strlen(search));\n        if (found == 0)\n            return -1;\n        found = 0;\n        while (end > str && found == 0)\n            found = strstr(end--, search);\n        while (*str && str < found) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        return pos;\n    }\n{/if}\n{#if headerFlags.str_len || headerFlags.str_substring || headerFlags.str_slice}\n    int16_t str_len(const char * str) {\n        int16_t len = 0;\n        int16_t i = 0;\n        while (*str) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            str += i;\n            len += i == 4 ? 2 : 1;\n        }\n        return len;\n    }\n{/if}\n{#if headerFlags.str_char_code_at}\n    int16_t str_char_code_at(const char * str, int16_t pos) {\n        int16_t i, res = 0;\n        while (*str) {\n            i = 1;\n            if ((*str & 0xE0) == 0xC0) i=2;\n            else if ((*str & 0xF0) == 0xE0) i=3;\n            else if ((*str & 0xF8) == 0xF0) i=4;\n            if (pos == 0) {\n                res += (unsigned char)*str++;\n                if (i > 1) {\n                    res <<= 6; res -= 0x3080;\n                    res += (unsigned char)*str++;\n                }\n                return res;\n            }\n            str += i;\n            pos -= i == 4 ? 2 : 1;\n        }\n        return -1;\n    }\n{/if}\n{#if headerFlags.str_substring || headerFlags.str_slice}\n    const char * str_substring(const char * str, int16_t start, int16_t end) {\n        int16_t i, tmp, pos, len = str_len(str), byte_start = -1;\n        char *p, *buf;\n        start = start < 0 ? 0 : (start > len ? len : start);\n        end = end < 0 ? 0 : (end > len ? len : end);\n        if (end < start) {\n            tmp = start;\n            start = end;\n            end = tmp;\n        }\n        i = 0;\n        pos = 0;\n        p = (char *)str;\n        while (*p) {\n            if (start == pos)\n                byte_start = p - str;\n            if (end == pos)\n                break;\n            i = 1;\n            if ((*p & 0xE0) == 0xC0) i=2;\n            else if ((*p & 0xF0) == 0xE0) i=3;\n            else if ((*p & 0xF8) == 0xF0) i=4;\n            p += i;\n            pos += i == 4 ? 2 : 1;\n        }\n        len = byte_start == -1 ? 0 : p - str - byte_start;\n        buf = malloc(len + 1);\n        assert(buf != NULL);\n        memcpy(buf, str + byte_start, len);\n        buf[len] = '\\0';\n        return buf;\n    }\n{/if}\n{#if headerFlags.str_slice}\n    const char * str_slice(const char * str, int16_t start, int16_t end) {\n        int16_t len = str_len(str);\n        start = start < 0 ? len + start : start;\n        end = end < 0 ? len + end : end;\n        if (end - start < 0)\n            end = start;\n        return str_substring(str, start, end);\n    }\n{/if}\n{#if headerFlags.str_int16_t_cat}\n    void str_int16_t_cat(char *str, int16_t num) {\n        char numstr[STR_INT16_T_BUFLEN];\n        sprintf(numstr, \"%d\", num);\n        strcat(str, numstr);\n    }\n{/if}\n\n{#if headerFlags.array_int16_t_cmp}\n    int array_int16_t_cmp(const void* a, const void* b) {\n        return ( *(int16_t*)a - *(int16_t*)b );\n    }\n{/if}\n{#if headerFlags.array_str_cmp}\n    int array_str_cmp(const void* a, const void* b) { \n        return strcmp(*(const char **)a, *(const char **)b);\n    }\n{/if}\n\n{#if headerFlags.parse_int16_t}\n    int16_t parse_int16_t(const char * str) {\n        int r;\n        sscanf(str, \"%d\", &r);\n        return (int16_t) r;\n    }\n{/if}\n\n{#if headerFlags.js_var || headerFlags.str_to_int16_t}\n    enum js_var_type {JS_VAR_NULL, JS_VAR_UNDEFINED, JS_VAR_NAN, JS_VAR_BOOL, JS_VAR_INT16, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_DICT};\n    struct js_var {\n        enum js_var_type type;\n        int16_t number;\n        void *data;\n    };\n{/if}\n\n{#if headerFlags.js_var_array || headerFlags.js_var_dict || headerFlags.js_var_to_str || headerFlags.js_var_plus || headerFlags.js_var_lessthan}\n    struct array_js_var_t {\n        int16_t size;\n        int16_t capacity;\n        struct js_var *data;\n    };\n{/if}\n\n{#if headerFlags.array_string_t || headerFlags.js_var_dict || headerFlags.js_var_get || headerFlags.try_catch}\n    struct array_string_t {\n        int16_t size;\n        int16_t capacity;\n        const char ** data;\n    };\n{/if}\n\n{#if headerFlags.js_var_dict}\n    struct dict_js_var_t {\n        struct array_string_t *index;\n        struct array_js_var_t *values;\n    };\n{/if}\n\n{#if headerFlags.js_var_from || headerFlags.js_var_get}\n    struct js_var js_var_from(enum js_var_type type) {\n        struct js_var v;\n        v.type = type;\n        v.data = NULL;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_from_uint8_t}\n    struct js_var js_var_from_uint8_t(uint8_t b) {\n        struct js_var v;\n        v.type = JS_VAR_BOOL;\n        v.number = b;\n        v.data = NULL;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_from_int16_t}\n    struct js_var js_var_from_int16_t(int16_t n) {\n        struct js_var v;\n        v.type = JS_VAR_INT16;\n        v.number = n;\n        v.data = NULL;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_from_str}\n    struct js_var js_var_from_str(const char *s) {\n        struct js_var v;\n        v.type = JS_VAR_STRING;\n        v.data = (void *)s;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_array}\n    struct js_var js_var_from_array(struct array_js_var_t *arr) {\n        struct js_var v;\n        v.type = JS_VAR_ARRAY;\n        v.data = (void *)arr;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_dict}\n    struct js_var js_var_from_dict(struct dict_js_var_t *dict) {\n        struct js_var v;\n        v.type = JS_VAR_DICT;\n        v.data = (void *)dict;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.str_to_int16_t || headerFlags.js_var_to_number || headerFlags.js_var_eq || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_lessthan}\n    struct js_var str_to_int16_t(const char * str) {\n        struct js_var v;\n        const char *p = str;\n        int r;\n\n        v.data = NULL;\n\n        while (*p && isspace(*p))\n            p++;\n\n        if (*p == 0)\n            str = \"0\";\n\n        if (*p == '-' && *(p+1))\n            p++;\n\n        while (*p) {\n            if (!isdigit(*p)) {\n                v.type = JS_VAR_NAN;\n                return v;\n            }\n            p++;\n        }\n\n        sscanf(str, \"%d\", &r);\n        v.type = JS_VAR_INT16;\n        v.number = (int16_t)r;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_to_str || headerFlags.js_var_plus || headerFlags.js_var_lessthan}\n    const char * js_var_to_str(struct js_var v, uint8_t *need_dispose)\n    {\n        char *buf;\n        int16_t i;\n        *need_dispose = 0;\n\n        if (v.type == JS_VAR_INT16) {\n            buf = malloc(STR_INT16_T_BUFLEN);\n            assert(buf != NULL);\n            *need_dispose = 1;\n            sprintf(buf, \"%d\", v.number);\n            return buf;\n        } else if (v.type == JS_VAR_BOOL)\n            return v.number ? \"true\" : \"false\";\n        else if (v.type == JS_VAR_STRING)\n            return (const char *)v.data;\n        else if (v.type == JS_VAR_ARRAY) {\n            struct array_js_var_t * arr = (struct array_js_var_t *)v.data;\n            uint8_t dispose_elem = 0;\n            buf = malloc(1);\n            assert(buf != NULL);\n            *need_dispose = 1;\n            buf[0] = 0;\n            for (i = 0; i < arr->size; i++) {\n                const char * elem = js_var_to_str(arr->data[i], &dispose_elem);\n                buf = realloc(buf, strlen(buf) + strlen(elem) + 1 + (i != 0 ? 1 : 0));\n                assert(buf != NULL);\n                if (i != 0)\n                    strcat(buf, \",\");\n                strcat(buf, elem);\n                if (dispose_elem)\n                    free((void *)elem);\n            }\n            return buf;\n        }\n        else if (v.type == JS_VAR_DICT)\n            return \"[object Object]\";\n        else if (v.type == JS_VAR_NAN)\n            return \"NaN\";\n        else if (v.type == JS_VAR_NULL)\n            return \"null\";\n        else if (v.type == JS_VAR_UNDEFINED)\n            return \"undefined\";\n\n        return NULL;\n    }\n{/if}\n\n{#if headerFlags.js_var_to_number || headerFlags.js_var_eq || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_lessthan}\n\n    struct js_var js_var_to_number(struct js_var v)\n    {\n        struct js_var result;\n        result.type = JS_VAR_INT16;\n        result.number = 0;\n\n        if (v.type == JS_VAR_INT16)\n            result.number = v.number;\n        else if (v.type == JS_VAR_BOOL)\n            result.number = v.number;\n        else if (v.type == JS_VAR_STRING)\n            return str_to_int16_t((const char *)v.data);\n        else if (v.type == JS_VAR_ARRAY) {\n            struct array_js_var_t * arr = (struct array_js_var_t *)v.data;\n            if (arr->size == 0)\n                result.number = 0;\n            else if (arr->size > 1)\n                result.type = JS_VAR_NAN;\n            else\n                result = js_var_to_number(arr->data[0]);\n        } else if (v.type != JS_VAR_NULL)\n            result.type = JS_VAR_NAN;\n\n        return result;\n    }\n\n{/if}\n\n{#if headerFlags.js_var_to_bool}\n\n    uint8_t js_var_to_bool(struct js_var v)\n    {\n        if (v.type == JS_VAR_INT16)\n            return v.number != 0;\n        else if (v.type == JS_VAR_BOOL)\n            return v.number;\n        else if (v.type == JS_VAR_STRING)\n            return *((const char *)v.data) != 0;\n        else if (v.type == JS_VAR_NULL || v.type == JS_VAR_UNDEFINED || v.type == JS_VAR_NAN)\n            return FALSE;\n        else\n            return TRUE;\n    }\n\n{/if}\n\n{#if headerFlags.js_var_to_undefined}\n    struct js_var js_var_to_undefined(void *value) {\n        struct js_var v;\n        v.type = JS_VAR_UNDEFINED;\n        v.data = NULL;\n        return v;\n    }\n{/if}\n\n{#if headerFlags.js_var_typeof}\n\n    const char * js_var_typeof(struct js_var v)\n    {\n        if (v.type == JS_VAR_INT16 || v.type == JS_VAR_NAN)\n            return \"number\";\n        else if (v.type == JS_VAR_BOOL)\n            return \"boolean\";\n        else if (v.type == JS_VAR_STRING)\n            return \"string\";\n        else if (v.type == JS_VAR_UNDEFINED)\n            return \"undefined\";\n        else\n            return \"object\";\n    }\n\n{/if}\n\n{#if headerFlags.try_catch || headerFlags.js_var_get}\n    int err_i = 0;\n    jmp_buf err_jmp[10];\n    #define TRY { int err_val = setjmp(err_jmp[err_i++]); if (!err_val) {\n    #define CATCH } else {\n    #define THROW(x) longjmp(err_jmp[--err_i], x)\n    struct array_string_t * err_defs;\n    #define END_TRY err_defs->size--; } }\n{/if}\n\n{#if headerFlags.js_var_get}\n    struct js_var js_var_get(struct js_var v, struct js_var arg) {\n        struct js_var tmp;\n        const char *key;\n        uint8_t need_dispose = 0;\n\n        if (v.type == JS_VAR_ARRAY) {\n            tmp = js_var_to_number(arg);\n            if (tmp.type == JS_VAR_NAN)\n                return js_var_from(JS_VAR_UNDEFINED);\n            else\n                return ((struct array_js_var_t *)v.data)->data[tmp.number];\n        } else if (v.type == JS_VAR_DICT) {\n            key = js_var_to_str(arg, &need_dispose);\n            tmp = DICT_GET(((struct dict_js_var_t *)v.data), key, js_var_from(JS_VAR_UNDEFINED));\n            if (need_dispose)\n                free((void *)key);\n            return tmp;\n        } else if (v.type == JS_VAR_NULL || v.type == JS_VAR_UNDEFINED) {\n            ARRAY_PUSH(err_defs, \"TypeError: Cannot read property of null or undefined.\");\n            THROW(err_defs->size);\n        } else\n            return js_var_from(JS_VAR_UNDEFINED);\n    }\n{/if}\n\n{#if headerFlags.js_var_eq}\n    uint8_t js_var_eq(struct js_var left, struct js_var right, uint8_t strict)\n    {\n        if (left.type == right.type) {\n            if (left.type == JS_VAR_NULL || left.type == JS_VAR_UNDEFINED)\n                return TRUE;\n            else if (left.type == JS_VAR_NAN)\n                return FALSE;\n            else if (left.type == JS_VAR_INT16 || left.type == JS_VAR_BOOL)\n                return left.number == right.number ? TRUE : FALSE;\n            else if (left.type == JS_VAR_STRING)\n                return !strcmp((const char *)left.data, (const char *)right.data) ? TRUE : FALSE;\n            else\n                return left.data == right.data;\n        } else if (!strict) {\n            if ((left.type == JS_VAR_NULL && right.type == JS_VAR_UNDEFINED) || (left.type == JS_VAR_UNDEFINED && right.type == JS_VAR_NULL))\n                return TRUE;\n            else if ((left.type == JS_VAR_INT16 && right.type == JS_VAR_STRING) || (left.type == JS_VAR_STRING && right.type == JS_VAR_INT16))\n                return js_var_eq(js_var_to_number(left), js_var_to_number(right), strict);\n            else if (left.type == JS_VAR_BOOL)\n                return js_var_eq(js_var_to_number(left), right, strict);\n            else if (right.type == JS_VAR_BOOL)\n                return js_var_eq(left, js_var_to_number(right), strict);\n            else\n                return FALSE;\n        } else\n            return FALSE;\n    }\n{/if}\n\n{#if headerFlags.js_var_lessthan}\n    int16_t js_var_lessthan(struct js_var left, struct js_var right)\n    {\n        struct js_var left_to_number, right_to_number;\n        const char *left_as_string, *right_as_string;\n        uint8_t need_dispose_left, need_dispose_right;\n        int16_t result;\n\n        if ((left.type == JS_VAR_STRING || left.type == JS_VAR_ARRAY || left.type == JS_VAR_DICT)\n            && (right.type == JS_VAR_STRING || right.type == JS_VAR_ARRAY || right.type == JS_VAR_DICT))\n        {\n            left_as_string = js_var_to_str(left, &need_dispose_left);\n            right_as_string = js_var_to_str(right, &need_dispose_right);\n            \n            result = strcmp(left_as_string, right_as_string) < 0 ? 1 : -1;\n\n            if (need_dispose_left)\n                free((void *)left_as_string);\n            if (need_dispose_right)\n                free((void *)right_as_string);\n            return result;\n        } else {\n            left_to_number = js_var_to_number(left);\n            right_to_number = js_var_to_number(right);\n\n            if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN)\n                return 0;\n            if (left_to_number.number == 0 && right_to_number.number == 0)\n                return -1;\n            return left_to_number.number < right_to_number.number ? 1 : -1;\n        }\n    }\n{/if}\n\n{#if headerFlags.gc_main || headerFlags.js_var_plus}\n    static ARRAY(void *) gc_main;\n{/if}\n\n{#if headerFlags.js_var_plus}\n\n    struct js_var js_var_plus(struct js_var left, struct js_var right)\n    {\n        struct js_var result, left_to_number, right_to_number;\n        const char *left_as_string, *right_as_string;\n        uint8_t need_dispose_left, need_dispose_right;\n        result.data = NULL;\n\n        if (left.type == JS_VAR_STRING || right.type == JS_VAR_STRING \n            || left.type == JS_VAR_ARRAY || right.type == JS_VAR_ARRAY\n            || left.type == JS_VAR_DICT || right.type == JS_VAR_DICT)\n        {\n            left_as_string = js_var_to_str(left, &need_dispose_left);\n            right_as_string = js_var_to_str(right, &need_dispose_right);\n            \n            result.type = JS_VAR_STRING;\n            result.data = malloc(strlen(left_as_string) + strlen(right_as_string) + 1);\n            assert(result.data != NULL);\n            ARRAY_PUSH(gc_main, result.data);\n\n            strcpy(result.data, left_as_string);\n            strcat(result.data, right_as_string);\n\n            if (need_dispose_left)\n                free((void *)left_as_string);\n            if (need_dispose_right)\n                free((void *)right_as_string);\n            return result;\n        }\n\n        left_to_number = js_var_to_number(left);\n        right_to_number = js_var_to_number(right);\n\n        if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN) {\n            result.type = JS_VAR_NAN;\n            return result;\n        }\n\n        result.type = JS_VAR_INT16;\n        result.number = left_to_number.number + right_to_number.number;\n        return result;\n    }\n\n{/if}\n\n{#if headerFlags.js_var_compute}\n\n    enum js_var_op {JS_VAR_MINUS, JS_VAR_ASTERISK, JS_VAR_SLASH, JS_VAR_PERCENT, JS_VAR_SHL, JS_VAR_SHR, JS_VAR_USHR, JS_VAR_OR, JS_VAR_AND};\n    struct js_var js_var_compute(struct js_var left, enum js_var_op op, struct js_var right)\n    {\n        struct js_var result, left_to_number, right_to_number;\n        result.data = NULL;\n\n        left_to_number = js_var_to_number(left);\n        right_to_number = js_var_to_number(right);\n\n        if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN) {\n            if (op == JS_VAR_MINUS || op == JS_VAR_ASTERISK || op == JS_VAR_SLASH || op == JS_VAR_PERCENT) {\n                result.type = JS_VAR_NAN;\n                return result;\n            }\n        }\n        \n        result.type = JS_VAR_INT16;\n        switch (op) {\n            case JS_VAR_MINUS:\n                result.number = left_to_number.number - right_to_number.number;\n                break;\n            case JS_VAR_ASTERISK:\n                result.number = left_to_number.number * right_to_number.number;\n                break;\n            case JS_VAR_SLASH:\n                result.number = left_to_number.number / right_to_number.number;\n                break;\n            case JS_VAR_PERCENT:\n                result.number = left_to_number.number % right_to_number.number;\n                break;\n            case JS_VAR_SHL:\n                result.number = left_to_number.number << right_to_number.number;\n                break;\n            case JS_VAR_SHR:\n                result.number = left_to_number.number >> right_to_number.number;\n                break;\n            case JS_VAR_USHR:\n                result.number = ((uint16_t)left_to_number.number) >> right_to_number.number;\n                break;\n            case JS_VAR_AND:\n                result.number = left_to_number.number & right_to_number.number;\n                break;\n            case JS_VAR_OR:\n                result.number = left_to_number.number | right_to_number.number;\n                break;\n        }\n        return result;\n    }\n\n{/if}\n\n{userStructs => struct {name} {\n    {properties {    }=> {this};\n}};\n}\n\n{#if headerFlags.regex}\n    void regex_clear_matches(struct regex_match_struct_t *match_info, int16_t groupN) {\n        int16_t i;\n        for (i = 0; i < groupN; i++) {\n            match_info->matches[i].index = -1;\n            match_info->matches[i].end = -1;\n        }\n    }\n{/if}\n\n{#if headerFlags.regex_match}\n    struct array_string_t *regex_match(struct regex_struct_t regex, const char * s) {\n        struct regex_match_struct_t match_info;\n        struct array_string_t *match_array = NULL;\n        int16_t i;\n\n        match_info = regex.func(s, TRUE);\n        if (match_info.index != -1) {\n            ARRAY_CREATE(match_array, match_info.matches_count + 1, match_info.matches_count + 1);\n            match_array->data[0] = str_substring(s, match_info.index, match_info.end);\n            for (i = 0;i < match_info.matches_count; i++) {\n                if (match_info.matches[i].index != -1 && match_info.matches[i].end != -1)\n                    match_array->data[i + 1] = str_substring(s, match_info.matches[i].index, match_info.matches[i].end);\n                else\n                    match_array->data[i + 1] = str_substring(s, 0, 0);\n            }\n        }\n        if (match_info.matches_count)\n            free(match_info.matches);\n\n        return match_array;\n    }\n{/if}\n\n{#if headerFlags.gc_iterator || headerFlags.js_var_plus}\n    int16_t gc_i;\n{/if}\n{#if headerFlags.gc_iterator2}\n    int16_t gc_j;\n{/if}\n\n{variables => {this};\n}\n\n{functionPrototypes => {this}\n}\n\n{functions => {this}\n}\n\nint main(void) {\n    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}\n    {#if headerFlags.try_catch || headerFlags.js_var_get}\n        ARRAY_CREATE(err_defs, 2, 0);\n    {/if}\n\n    {statements {    }=> {this}}\n\n    {destructors}\n    return 0;\n}\n")
    ], CProgram);
    return CProgram;
}());
exports.CProgram = CProgram;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./memory":1,"./nodes/call":3,"./nodes/expressions":5,"./nodes/function":6,"./nodes/literals":7,"./nodes/statements":9,"./nodes/variable":11,"./standard/array/concat":15,"./standard/array/forEach":16,"./standard/array/indexOf":17,"./standard/array/join":18,"./standard/array/lastIndexOf":19,"./standard/array/pop":20,"./standard/array/push":21,"./standard/array/reverse":22,"./standard/array/shift":23,"./standard/array/slice":24,"./standard/array/sort":25,"./standard/array/splice":26,"./standard/array/unshift":27,"./standard/console/log":28,"./standard/global/parseInt":29,"./standard/number/number":30,"./standard/string/charAt":31,"./standard/string/charCodeAt":32,"./standard/string/concat":33,"./standard/string/indexOf":34,"./standard/string/lastIndexOf":35,"./standard/string/match":36,"./standard/string/search":37,"./standard/string/slice":38,"./standard/string/substring":39,"./standard/string/toString":40,"./symbols":41,"./template":42,"./typeguards":43,"./types":44}],13:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],16:[function(require,module,exports){
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
        var _this = this;
        this.variables = [];
        this.statements = [];
        this.iteratorFnAccess = null;
        this.arraySize = '';
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        var propAccess = call.expression;
        var objType = scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = template_1.CodeTemplateFactory.templateToString(new elementaccess_1.CElementAccess(scope, propAccess.expression));
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(call);
        this.arraySize = objType.isDynamicArray ? this.varAccess + "->size" : objType.capacity + "";
        var iteratorFunc = call.arguments[0];
        scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
        this.paramName = iteratorFunc.parameters[0].name.text;
        iteratorFunc.body.statements.forEach(function (s) { return _this.statements.push(template_1.CodeTemplateFactory.createForNode(_this, s)); });
        this.variables.push(new variable_1.CVariable(scope, this.paramName, objType.elementType));
    }
    CArrayForEach = __decorate([
        template_1.CodeTemplate("\nfor ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n    {variables {   }=> {this};\n}\n    {paramName} = {varAccess}[{iteratorVarName}];\n    {statements {    }=> {this}}\n}\n")
    ], CArrayForEach);
    return CArrayForEach;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],17:[function(require,module,exports){
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
var expressions_1 = require("../../nodes/expressions");
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
            // Synthesize binary node that represents comparison expression
            var iteratorIdent = ts.createIdentifier(this.iteratorVarName);
            var arrayElement = ts.createElementAccess(propAccess.expression, iteratorIdent);
            var comparison = ts.createBinary(arrayElement, ts.SyntaxKind.EqualsEqualsToken, call.arguments[0]);
            iteratorIdent.parent = arrayElement;
            arrayElement.parent = comparison;
            scope.root.typeHelper.registerSyntheticNode(iteratorIdent, types_1.NumberVarType);
            scope.root.typeHelper.registerSyntheticNode(arrayElement, objType.elementType);
            scope.root.typeHelper.registerSyntheticNode(comparison, types_1.BooleanVarType);
            this.comparison = new expressions_1.CBinaryExpression(scope, comparison);
            scope.root.headerFlags.array = true;
        }
    }
    CArrayIndexOf = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && staticArraySize}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {staticArraySize}; {iteratorVarName}++) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {#elseif !topExpressionOfStatement}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->size; {iteratorVarName}++) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayIndexOf);
    return CArrayIndexOf;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/expressions":5,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],18:[function(require,module,exports){
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
            this.arraySize = new elementaccess_1.CArraySize(scope, this.varAccess, type);
            this.iteratorVarName = scope.root.symbolsHelper.addIterator(call);
            scope.variables.push(new variable_1.CVariable(scope, this.iteratorVarName, types_1.NumberVarType));
            this.arrayElement = new elementaccess_1.CSimpleElementAccess(scope, type, this.varAccess, this.iteratorVarName);
            this.catFuncName = type.elementType == types_1.NumberVarType ? "str_int16_t_cat" : "strcat";
            this.tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(call);
            if (!scope.root.memoryManager.variableWasReused(call))
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, "char *"));
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
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement}\n        {tempVarName} = malloc({calculatedStringLength});\n        assert({tempVarName} != NULL);\n        ((char *){tempVarName})[0] = '\\0';\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++) {\n            if ({iteratorVarName} > 0)\n                strcat((char *){tempVarName}, {separator});\n            {catFuncName}((char *){tempVarName}, {arrayElement});\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayJoin);
    return CArrayJoin;
}());
var CCalculateStringSize = /** @class */ (function () {
    function CCalculateStringSize(scope, varAccess, iteratorVarName, type, node) {
        this.varAccess = varAccess;
        this.iteratorVarName = iteratorVarName;
        this.type = type;
        this.arrayOfStrings = type.elementType == types_1.StringVarType;
        this.arrayOfNumbers = type.elementType == types_1.NumberVarType;
        this.arrayCapacity = type.capacity + "";
        this.arraySize = new elementaccess_1.CArraySize(scope, this.varAccess, type);
        this.arrayElement = new elementaccess_1.CSimpleElementAccess(scope, type, varAccess, iteratorVarName);
        if (this.arrayOfStrings) {
            this.lengthVarName = scope.root.symbolsHelper.addTemp(node, "len");
            scope.variables.push(new variable_1.CVariable(scope, this.lengthVarName, types_1.NumberVarType));
        }
    }
    CCalculateStringSize = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if arrayOfStrings}\n        {lengthVarName} = 0;\n        for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)\n            {lengthVarName} += strlen({arrayElement});\n    {/if}\n{/statements}\n{#if type.isDynamicArray && arrayOfStrings}\n    {arraySize} == 0 ? 1 : {lengthVarName} + strlen({separator})*({arraySize}-1) + 1\n{#elseif arrayCapacity > 0 && arrayOfStrings}\n    {lengthVarName} + strlen({separator})*({arraySize}-1) + 1\n{#elseif type.isDynamicArray && arrayOfNumbers}\n    {varAccess}->size == 0 ? 1 : STR_INT16_T_BUFLEN*{varAccess}->size + strlen({separator})*({arraySize}-1) + 1\n{#elseif arrayCapacity > 0 && arrayOfNumbers}\n    STR_INT16_T_BUFLEN*{arraySize}+strlen({separator})*({arraySize}-1)+1\n{#else}\n    1\n{/if}")
    ], CCalculateStringSize);
    return CCalculateStringSize;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/literals":7,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],19:[function(require,module,exports){
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
            // Synthesize binary node that represents comparison expression
            var iteratorIdent = ts.createIdentifier(this.iteratorVarName);
            var arrayElement = ts.createElementAccess(propAccess.expression, iteratorIdent);
            var comparison = ts.createBinary(arrayElement, ts.SyntaxKind.EqualsEqualsToken, call.arguments[0]);
            iteratorIdent.parent = arrayElement;
            arrayElement.parent = comparison;
            scope.root.typeHelper.registerSyntheticNode(iteratorIdent, types_1.NumberVarType);
            scope.root.typeHelper.registerSyntheticNode(arrayElement, objType.elementType);
            scope.root.typeHelper.registerSyntheticNode(comparison, types_1.BooleanVarType);
            this.comparison = new expressions_1.CBinaryExpression(scope, comparison);
            scope.root.headerFlags.array = true;
        }
    }
    CArrayLastIndexOf = __decorate([
        template_1.CodeTemplate("\n{#statements}\n    {#if !topExpressionOfStatement && staticArraySize}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = {staticArraySize} - 1; {iteratorVarName} >= 0; {iteratorVarName}--) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {#elseif !topExpressionOfStatement}\n        {tempVarName} = -1;\n        for ({iteratorVarName} = {varAccess}->size - 1; {iteratorVarName} >= 0; {iteratorVarName}--) {\n            if ({comparison}) {\n                {tempVarName} = {iteratorVarName};\n                break;\n            }\n        }\n    {/if}\n{/statements}\n{#if !topExpressionOfStatement}\n    {tempVarName}\n{/if}")
    ], CArrayLastIndexOf);
    return CArrayLastIndexOf;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../nodes/elementaccess":4,"../../nodes/expressions":5,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],20:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":42,"../../types":44}],21:[function(require,module,exports){
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
var typeconvert_1 = require("../../nodes/typeconvert");
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
        var type = scope.root.typeHelper.getCType(propAccess.expression);
        this.varAccess = new elementaccess_1.CElementAccess(scope, propAccess.expression);
        var args = call.arguments.map(function (a) { return type.elementType === types_1.UniversalVarType ? new typeconvert_1.CAsUniversalVar(scope, a) : template_1.CodeTemplateFactory.createForNode(scope, a); });
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
},{"../../nodes/elementaccess":4,"../../nodes/typeconvert":10,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],22:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],23:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],24:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],25:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":42,"../../types":44}],26:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],27:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],28:[function(require,module,exports){
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
var typeguards_1 = require("../../typeguards");
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
                var nodesUnder = template_1.getAllNodesUnder(node_1);
                var hasSideEffects = nodesUnder.some(function (n) { return typeguards_1.isSideEffectExpression(n); });
                var accessor = "";
                if (hasSideEffects && (type instanceof types_1.ArrayType || type instanceof types_1.StructType || type instanceof types_1.DictType || type === types_1.UniversalVarType)) {
                    var tempVarName = scope.root.symbolsHelper.addTemp(node_1, "tmp_result");
                    // crutch
                    var tempVarType = type;
                    if (tempVarType instanceof types_1.ArrayType && !tempVarType.isDynamicArray)
                        tempVarType = types_1.getTypeText(tempVarType.elementType) + "*";
                    scope.variables.push(new variable_1.CVariable(scope, tempVarName, tempVarType));
                    printfs.push(new assignment_1.CAssignment(scope, tempVarName, null, tempVarType, node_1, false));
                    accessor = tempVarName;
                }
                else if (ts.isStringLiteral(node_1))
                    accessor = template_1.CodeTemplateFactory.templateToString(new literals_1.CString(scope, node_1)).slice(1, -1);
                else
                    accessor = template_1.CodeTemplateFactory.templateToString(template_1.CodeTemplateFactory.createForNode(scope, node_1));
                var options = {
                    prefix: (i_1 > 0 && j == 0 ? " " : "") + prefix,
                    postfix: postfix + (i_1 == printNodes.length - 1 && j == nodeExpressions.length - 1 ? "\\n" : "")
                };
                printfs.push(new CPrintf(scope, node_1, accessor, type, options));
            }
        };
        for (var i_1 = 0; i_1 < printNodes.length; i_1++) {
            _loop_1(i_1);
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
    if (type == types_1.StringVarType && ts.isBinaryExpression(printNode)) {
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
        this.isStringLiteral = varType == types_1.StringVarType && printNode.kind == ts.SyntaxKind.StringLiteral;
        this.isCString = varType == types_1.StringVarType;
        this.isRegex = varType == types_1.RegexVarType;
        this.isInteger = varType == types_1.NumberVarType;
        this.isBoolean = varType == types_1.BooleanVarType;
        this.isUniversalVar = varType == types_1.UniversalVarType;
        this.quoted = options.quotedString;
        if (this.isUniversalVar) {
            this.tempVarName = scope.root.symbolsHelper.addTemp(printNode, "tmp_str", false);
            this.needDisposeVarName = scope.root.symbolsHelper.addTemp(printNode, "tmp_need_dispose", false);
            if (!scope.variables.some(function (v) { return v.name == _this.tempVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, this.tempVarName, types_1.StringVarType));
            if (!scope.variables.some(function (v) { return v.name == _this.needDisposeVarName; }))
                scope.variables.push(new variable_1.CVariable(scope, this.needDisposeVarName, types_1.BooleanVarType));
            scope.root.headerFlags.js_var_to_str = true;
        }
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
                var opts = { quotedString: true, propName: k, indent: this.INDENT + "    " };
                if (varType.propertyDefs[k].recursive) {
                    var objString = "[object Object]";
                    var stringLit = ts.createLiteral(objString);
                    this.elementPrintfs.push(new CPrintf_1(scope, stringLit, objString, types_1.StringVarType, opts));
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
},{"../../nodes/assignment":2,"../../nodes/literals":7,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../typeguards":43,"../../types":44}],29:[function(require,module,exports){
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
        scope.root.headerFlags.parse_int16_t = true;
    }
    CParseInt = __decorate([
        template_1.CodeTemplate("parse_int16_t({arguments {, }=> {this}})")
    ], CParseInt);
    return CParseInt;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../standard":14,"../../template":42,"../../types":44}],30:[function(require,module,exports){
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
var NumberCallResolver = /** @class */ (function () {
    function NumberCallResolver() {
    }
    NumberCallResolver.prototype.matchesNode = function (typeHelper, call) {
        return ts.isIdentifier(call.expression) && call.expression.text == "Number";
    };
    NumberCallResolver.prototype.returnType = function (typeHelper, call) {
        var type = typeHelper.getCType(call.arguments[0]);
        return type == types_1.NumberVarType ? types_1.NumberVarType : types_1.UniversalVarType;
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
var CNumberCall = /** @class */ (function () {
    function CNumberCall(scope, call) {
        this.call = "";
        this.arg = template_1.CodeTemplateFactory.createForNode(scope, call.arguments[0]);
        var type = scope.root.typeHelper.getCType(call.arguments[0]);
        if (type != types_1.NumberVarType && type != types_1.UniversalVarType) {
            this.call = "str_to_int16_t";
            scope.root.headerFlags.str_to_int16_t = true;
        }
        else if (type == types_1.UniversalVarType) {
            this.call = "js_var_to_number";
            scope.root.headerFlags.js_var_to_number = true;
        }
    }
    CNumberCall = __decorate([
        template_1.CodeTemplate("\n{#if call}\n    {call}({arg})\n{#else}\n    {arg}\n{/if}")
    ], CNumberCall);
    return CNumberCall;
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../standard":14,"../../template":42,"../../types":44}],31:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],32:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":42,"../../types":44}],33:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],34:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":42,"../../types":44}],35:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":42,"../../types":44}],36:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],37:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../standard":14,"../../template":42,"../../types":44}],38:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],39:[function(require,module,exports){
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
},{"../../nodes/elementaccess":4,"../../nodes/variable":11,"../../standard":14,"../../template":42,"../../types":44}],40:[function(require,module,exports){
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
},{"../../standard":14,"../../template":42,"../../types":44}],41:[function(require,module,exports){
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
                "js_var_typeof", "js_var_eq", "js_var_op", "js_var_compute",
                "regex_clear_matches", "regex_match",
                "gc_main", "gc_i", "gc_j"
            ]
        };
        this.iteratorVarNames = ['i', 'j', 'k', 'l', 'm', 'n'];
        this.closureVarNames = [];
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
        var structs = Object.keys(this.userStructs).filter(function (k) { return !_this.userStructs[k].external; }).map(function (k) { return ({
            name: k,
            properties: Object.keys(_this.userStructs[k].properties).map(function (pk) { return ({
                name: pk,
                type: _this.userStructs[k].propertyDefs[pk].recursive ? _this.userStructs[k] : _this.userStructs[k].properties[pk]
            }); })
        }); });
        return [structs];
    };
    SymbolsHelper.prototype.ensureClosureStruct = function (type, name) {
        var _this = this;
        if (!type.structName)
            type.structName = name + "_t";
        var i = 0;
        var params = type.closureParams.reduce(function (a, p) {
            a[p.node.text] = { type: _this.typeHelper.getCType(p.node), order: ++i };
            return a;
        }, {});
        params["func"] = { type: type.getText(true), order: 0 };
        var closureStruct = new types_1.StructType(params);
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
            var propType = structType.propertyDefs[propName].recursive ? structType.getText() : structType.propertyDefs[propName].type;
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
    SymbolsHelper.prototype.addTemp = function (scopeNode, proposedName, reserve) {
        if (reserve === void 0) { reserve = true; }
        var parentFunc = types_1.findParentFunction(scopeNode);
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
    return SymbolsHelper;
}());
exports.SymbolsHelper = SymbolsHelper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./types":44}],42:[function(require,module,exports){
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
    CodeTemplateFactory.templateToString = function (template) {
        return typeof (template) === "string" ? template : template.resolve();
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
function getAllNodesUnder(node) {
    var i = 0;
    var nodes = [node];
    while (i < nodes.length)
        nodes.push.apply(nodes, nodes[i++].getChildren());
    return nodes;
}
exports.getAllNodesUnder = getAllNodesUnder;
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

},{}],43:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],44:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = (typeof window !== "undefined" ? window['ts'] : typeof global !== "undefined" ? global['ts'] : null);
var standard_1 = require("./standard");
var typeguards_1 = require("./typeguards");
var template_1 = require("./template");
exports.UniversalVarType = "struct js_var";
exports.VoidType = "void";
exports.PointerVarType = "void *";
exports.StringVarType = "const char *";
exports.NumberVarType = "int16_t";
exports.BooleanVarType = "uint8_t";
exports.RegexVarType = "struct regex_struct_t";
exports.RegexMatchVarType = "struct regex_match_struct_t";
var getTypeBodyText = function (t) { return typeof t === "string" ? t : t.getBodyText(); };
exports.getTypeText = function (t) { return typeof (t) === "string" ? t : t.getText(); };
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
        return "{" + Object.keys(this.propertyDefs).sort().map(function (k) { return k + ": " + (_this.propertyDefs[k].recursive ? _this.getText() : getTypeBodyText(_this.properties[k])); }).join("; ") + "}";
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
    function FuncType(returnType, parameterTypes, instanceType, closureParams, needsClosureStruct) {
        if (parameterTypes === void 0) { parameterTypes = []; }
        if (instanceType === void 0) { instanceType = null; }
        if (closureParams === void 0) { closureParams = []; }
        if (needsClosureStruct === void 0) { needsClosureStruct = false; }
        this.returnType = returnType;
        this.parameterTypes = parameterTypes;
        this.instanceType = instanceType;
        this.closureParams = closureParams;
        this.needsClosureStruct = needsClosureStruct;
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
        var retType = exports.getTypeText(this.returnType).replace(/ \{var\}\[\d+\]/g, "* {var}").replace(/^static /, "");
        if (retType.indexOf("{var}") == -1)
            retType += " {var}";
        return retType.replace(" {var}", " (*{var})") + "("
            + this.parameterTypes
                .map(function (t) { return exports.getTypeText(t).replace(/\ {var\}/, "").replace(/^static /, ""); })
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
            + "[[" + this.closureParams.map(function (p) { return p.node.text; }).join(", ") + (this.needsClosureStruct ? " (struct) " : "") + "]]";
    };
    return FuncType;
}());
exports.FuncType = FuncType;
function operandsToNumber(leftType, op, rightType) {
    return typeguards_1.isNumberOp(op) || typeguards_1.isIntegerOp(op)
        || op == ts.SyntaxKind.PlusToken && !toNumberCanBeNaN(leftType) && !toNumberCanBeNaN(rightType)
        || typeguards_1.isRelationalOp(op) && (leftType !== exports.StringVarType || rightType !== exports.StringVarType);
}
exports.operandsToNumber = operandsToNumber;
function getBinExprResultType(mergeTypes, leftType, op, rightType) {
    if (op === ts.SyntaxKind.EqualsToken)
        return rightType;
    if (typeguards_1.isRelationalOp(op) || typeguards_1.isEqualityOp(op) || op === ts.SyntaxKind.InKeyword || op === ts.SyntaxKind.InstanceOfKeyword)
        return exports.BooleanVarType;
    if (leftType == null || rightType == null)
        return null;
    if (typeguards_1.isLogicOp(op))
        return mergeTypes(leftType, rightType).type;
    if (typeguards_1.isNumberOp(op) || typeguards_1.isIntegerOp(op))
        return toNumberCanBeNaN(leftType) || toNumberCanBeNaN(rightType) ? exports.UniversalVarType : exports.NumberVarType;
    if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.PlusEqualsToken)
        return leftType === exports.UniversalVarType || rightType === exports.UniversalVarType ? exports.UniversalVarType
            : toPrimitive(leftType) === exports.StringVarType || toPrimitive(rightType) === exports.StringVarType ? exports.StringVarType
                : toPrimitive(leftType) === exports.NumberVarType && toPrimitive(rightType) == exports.NumberVarType ? exports.NumberVarType
                    : null;
    console.log("WARNING: unexpected binary expression!");
    return null;
}
exports.getBinExprResultType = getBinExprResultType;
function getUnaryExprResultType(op, operandType) {
    if (op === ts.SyntaxKind.ExclamationToken) {
        return exports.BooleanVarType;
    }
    else if (op === ts.SyntaxKind.TildeToken) {
        return exports.NumberVarType;
    }
    else {
        return toNumberCanBeNaN(operandType) ? exports.UniversalVarType : exports.NumberVarType;
    }
}
exports.getUnaryExprResultType = getUnaryExprResultType;
function toNumberCanBeNaN(t) {
    return t !== null && t !== exports.PointerVarType && t !== exports.NumberVarType && t !== exports.BooleanVarType && !(t instanceof ArrayType && !t.isDynamicArray && t.capacity == 1 && !toNumberCanBeNaN(t.elementType));
}
exports.toNumberCanBeNaN = toNumberCanBeNaN;
function toPrimitive(t) {
    return t === null || t === exports.PointerVarType ? t : t === exports.NumberVarType || t === exports.BooleanVarType ? exports.NumberVarType : exports.StringVarType;
}
exports.toPrimitive = toPrimitive;
function findParentFunction(node) {
    var parentFunc = node;
    while (parentFunc && !typeguards_1.isFunction(parentFunc))
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
function isUnder(refNode, node) {
    var parent = node;
    while (parent && parent != refNode)
        parent = parent.parent;
    return parent;
}
exports.isUnder = isUnder;
function hasType(refType, type) {
    return refType == type
        || refType instanceof StructType && Object.keys(refType.properties).some(function (k) { return hasType(refType.properties[k], type); })
        || refType instanceof ArrayType && hasType(refType.elementType, type)
        || refType instanceof DictType && hasType(refType.elementType, type)
        || refType instanceof FuncType && hasType(refType.returnType, type)
        || refType instanceof FuncType && hasType(refType.instanceType, type)
        || refType instanceof FuncType && refType.parameterTypes.some(function (pt) { return hasType(pt, type); });
}
exports.hasType = hasType;
var TypeHelper = /** @class */ (function () {
    function TypeHelper(typeChecker, allNodes) {
        this.typeChecker = typeChecker;
        this.allNodes = allNodes;
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
        if (cType instanceof ArrayType || cType instanceof StructType || cType instanceof DictType || cType instanceof FuncType)
            return cType.getText();
        else if (typeof cType === 'string')
            return cType;
        else
            return "/* Cannot determine variable type from source " + (source && source.getText ? source.getText() : JSON.stringify(source)) + "*/";
    };
    /** Postprocess TypeScript AST for better type inference and map TS types to C types */
    /** Creates typeOfNodeDict that is later used in getCType */
    TypeHelper.prototype.inferTypes = function () {
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
        // left hand side
        addEquality(ts.isIdentifier, function (n) { return n; }, function (n) { return _this.getDeclaration(n); });
        addEquality(ts.isPropertyAssignment, function (n) { return n; }, function (n) { return n.initializer; });
        addEquality(ts.isPropertyAssignment, function (n) { return n.parent; }, type(function (n) {
            var propName = (ts.isIdentifier(n.name) || typeguards_1.isStringLiteralAsIdentifier(n.name)) && n.name.text;
            if (propName)
                return struct(propName, n.pos, _this.getCType(n) || exports.PointerVarType);
            else
                return new DictType(_this.getCType(n));
        }));
        addEquality(ts.isPropertyAssignment, function (n) { return n; }, type(function (n) {
            var propName = (ts.isIdentifier(n.name) || typeguards_1.isStringLiteralAsIdentifier(n.name)) && n.name.text;
            var type = _this.getCType(n.parent);
            return type instanceof StructType ? type.properties[propName]
                : type instanceof DictType ? type.elementType
                    : null;
        }));
        addEquality(ts.isPropertyAssignment, function (n) { return n; }, type(function (n) {
            var type = _this.getCType(n.initializer);
            if (type instanceof FuncType && type.closureParams.length)
                return new FuncType(type.returnType, type.parameterTypes, type.instanceType, type.closureParams, true);
            else
                return null;
        }));
        addEquality(ts.isPropertyAccessExpression, function (n) { return n; }, function (n) { return n.name; });
        addEquality(typeguards_1.isFieldPropertyAccess, function (n) { return n.expression; }, type(function (n) { return struct(n.name.getText(), n.pos, _this.getCType(n) || exports.PointerVarType); }));
        addEquality(typeguards_1.isFieldPropertyAccess, function (n) { return n; }, type(function (n) {
            var type = _this.getCType(n.expression);
            return type instanceof StructType ? type.properties[n.name.getText()]
                : type instanceof ArrayType && n.name.getText() == "length" ? exports.NumberVarType
                    : type === exports.StringVarType && n.name.getText() == "length" ? exports.NumberVarType
                        : type instanceof ArrayType || type instanceof DictType ? type.elementType
                            : type === exports.UniversalVarType && n.name.getText() == "length" ? exports.NumberVarType
                                : type === exports.UniversalVarType ? exports.UniversalVarType
                                    : null;
        }));
        addEquality(typeguards_1.isFieldElementAccess, function (n) { return n.expression; }, type(function (n) {
            var type = _this.getCType(n.argumentExpression);
            var elementType = _this.getCType(n) || exports.PointerVarType;
            return typeguards_1.isStringLiteralAsIdentifier(n.argumentExpression) ? struct(n.argumentExpression.text, n.pos, elementType)
                : ts.isNumericLiteral(n.argumentExpression) ? new ArrayType(elementType, 0, false)
                    : type == exports.NumberVarType ? new ArrayType(elementType, 0, false)
                        : type == exports.StringVarType ? new DictType(elementType)
                            : null;
        }));
        addEquality(typeguards_1.isFieldElementAccess, function (n) { return n; }, type(function (n) {
            var type = _this.getCType(n.expression);
            return ts.isStringLiteral(n.argumentExpression) && type instanceof StructType ? type.properties[n.argumentExpression.getText().slice(1, -1)]
                : ts.isStringLiteral(n.argumentExpression) && type instanceof ArrayType && n.argumentExpression.getText().slice(1, -1) == "length" ? exports.NumberVarType
                    : ts.isStringLiteral(n.argumentExpression) && type === exports.StringVarType && n.argumentExpression.getText().slice(1, -1) == "length" ? exports.NumberVarType
                        : ts.isStringLiteral(n.argumentExpression) && type === exports.UniversalVarType && n.argumentExpression.getText().slice(1, -1) == "length" ? exports.NumberVarType
                            : type instanceof ArrayType || type instanceof DictType ? type.elementType
                                : type === exports.UniversalVarType ? exports.UniversalVarType
                                    : null;
        }));
        var _loop_1 = function (i_1) {
            addEquality(ts.isArrayLiteralExpression, function (n) { return n; }, type(function (n) {
                var elemType = _this.getCType(n.elements[i_1]);
                return elemType ? new ArrayType(elemType, 0, false) : null;
            }));
            addEquality(ts.isArrayLiteralExpression, function (n) { return n.elements[i_1]; }, type(function (n) {
                var arrType = _this.getCType(n);
                return arrType && arrType instanceof ArrayType ? arrType.elementType
                    : arrType === exports.UniversalVarType ? exports.UniversalVarType
                        : null;
            }));
        };
        for (var i_1 = 0; i_1 < 10; i_1++) {
            _loop_1(i_1);
        }
        // expressions
        addEquality(typeguards_1.isEqualsExpression, function (n) { return n.left; }, function (n) { return n.right; });
        addEquality(typeguards_1.isEqualsExpression, function (n) { return n.left; }, type(function (n) {
            var type = _this.getCType(n.right);
            if (type instanceof FuncType && type.closureParams.length)
                return new FuncType(type.returnType, type.parameterTypes, type.instanceType, type.closureParams, true);
            else
                return null;
        }));
        addEquality(ts.isConditionalExpression, function (n) { return n.whenTrue; }, function (n) { return n.whenFalse; });
        addEquality(ts.isConditionalExpression, function (n) { return n; }, function (n) { return n.whenTrue; });
        addEquality(typeguards_1.isUnaryExpression, function (n) { return n; }, type(function (n) { return getUnaryExprResultType(n.operator, _this.getCType(n.operand)); }));
        addEquality(typeguards_1.isUnaryExpression, function (n) { return n.operand; }, type(function (n) {
            var resultType = _this.getCType(n);
            if (resultType == exports.UniversalVarType && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken))
                return exports.UniversalVarType;
            else
                return null;
        }));
        addEquality(ts.isBinaryExpression, function (n) { return n; }, type(function (n) { return getBinExprResultType(_this.mergeTypes.bind(_this), _this.getCType(n.left), n.operatorToken.kind, _this.getCType(n.right)); }));
        addEquality(ts.isBinaryExpression, function (n) { return n.left; }, type(function (n) {
            var resultType = _this.getCType(n);
            var operandType = _this.getCType(n.left);
            var rightType = _this.getCType(n.right);
            if (resultType === exports.UniversalVarType) {
                return typeguards_1.isCompoundAssignment(n.operatorToken) ? exports.UniversalVarType
                    : operandType instanceof ArrayType ? new ArrayType(exports.UniversalVarType, 0, true)
                        : operandType instanceof StructType || operandType instanceof DictType ? new DictType(exports.UniversalVarType)
                            : null;
            }
            else if (operandsToNumber(operandType, n.operatorToken.kind, rightType) && toNumberCanBeNaN(operandType))
                return exports.UniversalVarType;
            else
                return null;
        }));
        addEquality(ts.isBinaryExpression, function (n) { return n.right; }, type(function (n) {
            var resultType = _this.getCType(n);
            var operandType = _this.getCType(n.right);
            var leftType = _this.getCType(n.left);
            if (resultType === exports.UniversalVarType && !typeguards_1.isLogicOp(n.operatorToken.kind)) {
                return operandType instanceof ArrayType ? new ArrayType(exports.UniversalVarType, 0, true)
                    : operandType instanceof StructType || operandType instanceof DictType ? new DictType(exports.UniversalVarType)
                        : null;
            }
            else if (operandsToNumber(leftType, n.operatorToken.kind, operandType) && toNumberCanBeNaN(operandType))
                return exports.UniversalVarType;
            else
                return null;
        }));
        addEquality(typeguards_1.isNullOrUndefinedOrNaN, function (n) { return n; }, type(exports.UniversalVarType));
        addEquality(ts.isParenthesizedExpression, function (n) { return n; }, function (n) { return n.expression; });
        addEquality(ts.isVoidExpression, function (n) { return n; }, type(exports.UniversalVarType));
        addEquality(ts.isVoidExpression, function (n) { return n.expression; }, type(exports.PointerVarType));
        addEquality(ts.isTypeOfExpression, function (n) { return n; }, type(exports.StringVarType));
        addEquality(typeguards_1.isDeleteExpression, function (n) { return n; }, type(exports.BooleanVarType));
        addEquality(typeguards_1.isDeleteExpression, function (n) { return n.expression.expression; }, type(function (n) { return new DictType(exports.UniversalVarType); }));
        // functions
        addEquality(ts.isCallExpression, function (n) { return n.expression; }, function (n) { return _this.getDeclaration(n); });
        addEquality(ts.isCallExpression, function (n) { return n.expression; }, type(function (n) { return _this.getCType(n) ? new FuncType(_this.getCType(n), n.arguments.map(function (arg) { return _this.getCType(arg); })) : null; }));
        addEquality(ts.isCallExpression, function (n) { return n; }, type(function (n) { return FuncType.getReturnType(_this, n.expression); }));
        addEquality(ts.isParameter, function (n) { return n; }, function (n) { return n.name; });
        addEquality(ts.isParameter, function (n) { return n; }, function (n) { return n.initializer; });
        addEquality(ts.isNewExpression, function (n) { return n; }, type(function (n) {
            return ts.isIdentifier(n.expression) && n.expression.text === "Object" ? new StructType({})
                : FuncType.getInstanceType(_this, n.expression);
        }));
        var _loop_2 = function (i_2) {
            addEquality(ts.isNewExpression, function (n) { return n.arguments[i_2]; }, function (n) {
                var func = _this.getDeclaration(n.expression);
                return func && ts.isFunctionDeclaration(func) ? func.parameters[i_2] : null;
            });
        };
        for (var i_2 = 0; i_2 < 10; i_2++) {
            _loop_2(i_2);
        }
        addEquality(typeguards_1.isThisKeyword, function (n) { return findParentFunction(n); }, type(function (n) { return new FuncType(exports.VoidType, [], _this.getCType(n)); }));
        addEquality(typeguards_1.isThisKeyword, function (n) { return n; }, type(function (n) { return FuncType.getInstanceType(_this, findParentFunction(n)); }));
        addEquality(typeguards_1.isMethodCall, function (n) { return n.expression.expression; }, type(function (n) { return standard_1.StandardCallHelper.getObjectType(_this, n); }));
        addEquality(ts.isCallExpression, function (n) { return n; }, type(function (n) { return standard_1.StandardCallHelper.getReturnType(_this, n); }));
        var _loop_3 = function (i_3) {
            addEquality(ts.isCallExpression, function (n) { return n.arguments[i_3]; }, type(function (n) { return typeguards_1.isLiteral(n.arguments[i_3]) ? null : standard_1.StandardCallHelper.getArgumentTypes(_this, n)[i_3]; }));
        };
        for (var i_3 = 0; i_3 < 10; i_3++) {
            _loop_3(i_3);
        }
        // crutch for callback argument type in foreach
        addEquality(typeguards_1.isFunctionArgInMethodCall, function (n) { return n.parameters[0]; }, type(function (n) {
            var objType = _this.getCType(n.parent.expression.expression);
            return objType instanceof ArrayType && n.parent.expression.name.text == "forEach" ? objType.elementType : null;
        }));
        addEquality(typeguards_1.isFunction, function (n) { return n; }, type(function (n) { return new FuncType(exports.VoidType, n.parameters.map(function (p) { return _this.getCType(p); })); }));
        addEquality(typeguards_1.isFunction, function (n) { return n; }, type(function (node) {
            if (!findParentFunction(node.parent))
                return null;
            var nodesInFunction = template_1.getAllNodesUnder(node);
            var closureParams = [];
            nodesInFunction.filter(function (n) { return ts.isIdentifier(n); })
                .forEach(function (ident) {
                var identDecl = _this.getDeclaration(ident);
                if (identDecl && typeguards_1.isFunction(identDecl) && !isUnder(node, identDecl)) {
                    var identDeclType = _this.getCType(identDecl);
                    var _loop_4 = function (param) {
                        if (!closureParams.some(function (p) { return p.node.text === param.node.text; }))
                            closureParams.push(param);
                    };
                    for (var _i = 0, _a = identDeclType.closureParams; _i < _a.length; _i++) {
                        var param = _a[_i];
                        _loop_4(param);
                    }
                }
                else {
                    var identDeclFunc = identDecl && findParentFunction(identDecl);
                    var isFieldName = ts.isPropertyAccessExpression(ident.parent) && ident.parent.name === ident;
                    var assigned = typeguards_1.isEqualsExpression(ident.parent) || typeguards_1.isCompoundAssignment(ident.parent);
                    if (identDeclFunc && identDeclFunc != node && isUnder(identDeclFunc, node) && !isFieldName) {
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
            return new FuncType(exports.VoidType, [], null, closureParams);
        }));
        var _loop_5 = function (i_4) {
            addEquality(typeguards_1.isFunction, function (n) { return n.parameters[i_4]; }, type(function (n) {
                var type = _this.getCType(n);
                return type instanceof FuncType ? type.parameterTypes[i_4] : null;
            }));
        };
        for (var i_4 = 0; i_4 < 10; i_4++) {
            _loop_5(i_4);
        }
        // statements
        addEquality(ts.isVariableDeclaration, function (n) { return n; }, function (n) { return n.initializer; });
        addEquality(ts.isVariableDeclaration, function (n) { return n; }, type(function (n) {
            var type = _this.getCType(n.initializer);
            if (type instanceof FuncType && type.closureParams.length)
                return new FuncType(type.returnType, type.parameterTypes, type.instanceType, type.closureParams, true);
            else
                return null;
        }));
        addEquality(typeguards_1.isForOfWithSimpleInitializer, function (n) { return n.expression; }, type(function (n) { return new ArrayType(_this.getCType(n.initializer.declarations[0]) || exports.PointerVarType, 0, false); }));
        addEquality(typeguards_1.isForOfWithSimpleInitializer, function (n) { return n.initializer.declarations[0]; }, type(function (n) {
            var type = _this.getCType(n.expression);
            return type instanceof ArrayType ? type.elementType : null;
        }));
        addEquality(typeguards_1.isForOfWithIdentifierInitializer, function (n) { return n.expression; }, type(function (n) { return new ArrayType(_this.getCType(n.initializer) || exports.PointerVarType, 0, false); }));
        addEquality(typeguards_1.isForOfWithIdentifierInitializer, function (n) { return n.initializer; }, type(function (n) {
            var type = _this.getCType(n.expression);
            return type instanceof ArrayType ? type.elementType : null;
        }));
        addEquality(ts.isForInStatement, function (n) { return n.initializer; }, type(exports.StringVarType));
        addEquality(ts.isForInStatement, function (n) { return n.expression; }, type(function (n) { return new DictType(exports.PointerVarType); }));
        addEquality(ts.isReturnStatement, function (n) { return n.expression; }, type(function (n) { return FuncType.getReturnType(_this, findParentFunction(n)); }));
        addEquality(ts.isReturnStatement, function (n) { return findParentFunction(n); }, type(function (n) { return _this.getCType(n.expression) ? new FuncType(_this.getCType(n.expression)) : null; }));
        addEquality(ts.isCaseClause, function (n) { return n.expression; }, function (n) { return n.parent.parent.expression; });
        addEquality(ts.isCatchClause, function (n) { return n.variableDeclaration; }, type(exports.StringVarType));
        this.resolveTypes(typeEqualities);
    };
    TypeHelper.prototype.resolveTypes = function (typeEqualities) {
        var _this = this;
        this.allNodes.forEach(function (n) { return _this.setNodeType(n, _this.getCType(n)); });
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
        for (var k in this.typeOfNodeDict) {
            var type = this.typeOfNodeDict[k].type;
            if (type instanceof ArrayType && !type.isDynamicArray && type.capacity == 0)
                type.isDynamicArray = true;
            if (type instanceof StructType && Object.keys(type.properties).length == 0)
                this.typeOfNodeDict[k].type = new DictType(exports.PointerVarType);
        }
        /*
        this.allNodes
            .filter(n => !ts.isToken(n) && !ts.isBlock(n) && n.kind != ts.SyntaxKind.SyntaxList)
            .forEach(n => console.log(n.getText(), "|", ts.SyntaxKind[n.kind], "|", JSON.stringify(this.getCType(n))));
        */
    };
    /** Mostly used inside inferTypes */
    TypeHelper.prototype.registerSyntheticNode = function (n, t) {
        if (!n || !(n.flags & ts.NodeFlags.Synthesized))
            return false;
        n.end = TypeHelper.syntheticNodesCounter++;
        this.setNodeType(n, t);
    };
    TypeHelper.prototype.setNodeType = function (n, t) {
        if (n && t)
            this.typeOfNodeDict[n.pos + "_" + n.end] = { node: n, type: t };
    };
    TypeHelper.prototype.getDeclaration = function (n) {
        var s = this.typeChecker.getSymbolAtLocation(n);
        return s && s.valueDeclaration;
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
    TypeHelper.prototype.convertType = function (tsType, node) {
        if (!tsType || tsType.flags == ts.TypeFlags.Void)
            return exports.VoidType;
        if (tsType.flags == ts.TypeFlags.String || tsType.flags == ts.TypeFlags.StringLiteral)
            return exports.StringVarType;
        if (tsType.flags == ts.TypeFlags.Number || tsType.flags == ts.TypeFlags.NumberLiteral)
            return exports.NumberVarType;
        if (tsType.flags == ts.TypeFlags.Boolean || tsType.flags == (ts.TypeFlags.Boolean + ts.TypeFlags.Union))
            return exports.BooleanVarType;
        if (tsType.flags & ts.TypeFlags.Object && tsType.getProperties().length > 0 && tsType.getProperties().every(function (s) { return /[a-zA-Z_]/.test(s.name); })) {
            var structType = this.generateStructure(tsType);
            var baseType = this.typeChecker.getBaseTypeOfLiteralType(tsType);
            var cTypeTag = baseType && baseType.symbol && baseType.symbol.getJsDocTags().filter(function (t) { return t.name == "ctype"; })[0];
            structType.forcedType = cTypeTag && cTypeTag.text.trim();
            structType.external = baseType && baseType.symbol && findParentSourceFile(baseType.symbol.declarations[0]).isDeclarationFile;
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
            var propType = this.convertType(propTsType, declaration.name) || exports.PointerVarType;
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
            elementType = this.convertType(this.typeChecker.getTypeAtLocation(arrLiteral.elements[0])) || exports.PointerVarType;
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
        else if (type1 === exports.VoidType)
            return type2_result;
        else if (type2 === exports.VoidType)
            return type1_result;
        else if (type1 === exports.PointerVarType)
            return type2_result;
        else if (type2 === exports.PointerVarType)
            return type1_result;
        else if (type1 === exports.UniversalVarType)
            return type1_result;
        else if (type2 === exports.UniversalVarType)
            return type2_result;
        else if (type1 === exports.StringVarType && type2 instanceof StructType) {
            if (Object.keys(type2.properties).length == 1 && (type2.properties["length"] == exports.PointerVarType || type2.properties["length"] == exports.NumberVarType))
                return type1_result;
        }
        else if (type1 instanceof StructType && type2 === exports.StringVarType) {
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
                var recursive1 = type1.propertyDefs[p] && type1.propertyDefs[p].recursive;
                var recursive2 = type2.propertyDefs[p] && type2.propertyDefs[p].recursive;
                var result = void 0;
                if (recursive1 || recursive2)
                    result = { type: recursive1 ? type1 : type2, replaced: recursive1 != recursive2 };
                else
                    result = this.mergeTypes(type1.properties[p], type2.properties[p]);
                var order = Math.max(type1.propertyDefs[p] ? type1.propertyDefs[p].order : 0, type2.propertyDefs[p] ? type2.propertyDefs[p].order : 0);
                newProps[p] = { type: result.type, order: order, recursive: type1 == result.type || type2 == result.type };
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
        else if (type1 instanceof DictType && type2 instanceof StructType) {
            return this.mergeDictAndStruct(type1, type2);
        }
        else if (type1 instanceof StructType && type2 instanceof DictType) {
            return this.mergeDictAndStruct(type2, type1);
        }
        else if (type1 instanceof DictType && type2 instanceof DictType) {
            var _a = this.mergeTypes(type1.elementType, type2.elementType), elemType = _a.type, replaced = _a.replaced;
            if (replaced)
                return { type: this.ensureNoTypeDuplicates(new DictType(elemType)), replaced: true };
            else
                return noChanges;
        }
        else if (type1 instanceof FuncType && type2 instanceof FuncType) {
            var _b = this.mergeTypes(type1.returnType, type2.returnType), returnType = _b.type, returnTypeReplaced = _b.replaced;
            var _c = this.mergeTypes(type1.instanceType, type2.instanceType), instanceType = _c.type, instanceTypeReplaced = _c.replaced;
            var paramCount = Math.max(type1.parameterTypes.length, type2.parameterTypes.length);
            var paramTypesReplaced = type1.parameterTypes.length !== type2.parameterTypes.length;
            var paramTypes = [];
            for (var i_5 = 0; i_5 < paramCount; i_5++) {
                var _d = this.mergeTypes(type1.parameterTypes[i_5], type2.parameterTypes[i_5]), pType = _d.type, pTypeReplaced = _d.replaced;
                paramTypes.push(pType);
                if (pTypeReplaced)
                    paramTypesReplaced = true;
            }
            var closureParamCount = Math.max(type1.closureParams.length, type2.closureParams.length);
            var closureParamsReplaced = type1.closureParams.length !== type2.closureParams.length;
            var closureParams = [];
            for (var i_6 = 0; i_6 < closureParamCount; i_6++) {
                closureParams.push(type1.closureParams[i_6] || type2.closureParams[i_6]);
            }
            if (returnTypeReplaced || instanceTypeReplaced || paramTypesReplaced || closureParamsReplaced || type1.needsClosureStruct != type2.needsClosureStruct)
                return { type: this.ensureNoTypeDuplicates(new FuncType(returnType, paramTypes, instanceType, closureParams, type1.needsClosureStruct || type2.needsClosureStruct)), replaced: true };
            else
                return noChanges;
        }
        else
            return { type: exports.UniversalVarType, replaced: true };
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
    TypeHelper.prototype.mergeDictAndStruct = function (dictType, structType) {
        var elementType = dictType.elementType;
        for (var k in structType.properties)
            (elementType = this.mergeTypes(elementType, structType.properties[k]).type);
        return { type: this.ensureNoTypeDuplicates(new DictType(elementType)), replaced: true };
    };
    TypeHelper.syntheticNodesCounter = 0;
    return TypeHelper;
}());
exports.TypeHelper = TypeHelper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./standard":14,"./template":42,"./typeguards":43}],45:[function(require,module,exports){
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
},{"./src/program":12}]},{},[45])(45)
});
