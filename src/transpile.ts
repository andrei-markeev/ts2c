import * as ts from 'typescript'
import {GlobalContext} from './global';
import {MemoryManager} from './memory';
import {Emitter, EmitTarget, HeaderKey} from './emit';
import {TypeHelper, CType, StructType, ArrayType} from './types';
import {PrintfTranspiler} from './printf';

export class Transpiler {
    private emitter: Emitter = new Emitter();
    private typeHelper: TypeHelper = new TypeHelper(this.emitter);
    private memoryManager: MemoryManager = new MemoryManager(this.typeHelper);
    private printfTranspiler: PrintfTranspiler = new PrintfTranspiler(this.emitter, this.typeHelper, this.transpileNode.bind(this), this.addError.bind(this));
    private errors: string[] = [];

    public transpile(sourceFile: ts.SourceFile) {
        this.typeHelper.figureOutVariablesAndTypes(sourceFile);
        this.memoryManager.preprocess();
        this.memoryManager.insertGCVariablesCreationIfNecessary(this.emitter);
        this.transpileNode(sourceFile);
        this.memoryManager.insertDestructorsIfNecessary(sourceFile, this.emitter);
        
        if (this.errors.length)
            return this.errors.join("\n");
        else
            return this.emitter.finalize();
    }

    private transpileNode(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
                {
                    this.emitter.beginFunction();
                    let funcDecl = <ts.FunctionDeclaration>node;
                    let signature = GlobalContext.typeChecker.getSignatureFromDeclaration(funcDecl);
                    let returnType = this.typeHelper.convertType(signature.getReturnType());
                    this.emitter.emit(this.typeHelper.getTypeString(returnType));
                    this.emitter.emit(' ');
                    this.emitter.emit(funcDecl.name.getText());
                    this.emitter.emit('(');
                    let parameters = [];
                    for (let param of signature.parameters) {
                        let code = '';
                        code += this.typeHelper.getTypeString(this.typeHelper.convertType(GlobalContext.typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration), <ts.Identifier>param.valueDeclaration.name));
                        code += ' ';
                        code += param.getName();
                        parameters.push(code);
                    }
                    this.emitter.emit(parameters.join(', '));
                    this.emitter.emit(')\n');

                    this.emitter.emit('{\n');
                    this.emitter.increaseIndent();
                    this.emitter.beginFunctionBody();
                    funcDecl.body.statements.forEach(s => this.transpileNode(s));
                    if (funcDecl.body.statements[funcDecl.body.statements.length - 1].kind != ts.SyntaxKind.ReturnStatement) {
                        this.memoryManager.insertDestructorsIfNecessary(funcDecl, this.emitter);
                    }
                    this.emitter.decreaseIndent();
                    this.emitter.emit('}\n');
                    this.emitter.finalizeFunction();
                }
                break;
            case ts.SyntaxKind.VariableStatement:
                {
                    let varStatement = <ts.VariableStatement>node;
                    for (let varDecl of varStatement.declarationList.declarations) {
                        let varInfo = this.typeHelper.getVariableInfo(<ts.Identifier>varDecl.name);
                        let cType = varInfo && varInfo.type;
                        let cTypeString = cType && this.typeHelper.getTypeString(cType) || "void *";
                        if (cTypeString.indexOf('{var}') != -1)
                            this.emitter.emitToBeginningOfFunction(cTypeString.replace('{var}', varDecl.name.getText()))
                        else
                            this.emitter.emitToBeginningOfFunction(cTypeString + " " + varDecl.name.getText());
                        this.emitter.emitToBeginningOfFunction(";\n");
                        if (varDecl.initializer) {
                            if (varDecl.initializer.kind == ts.SyntaxKind.ObjectLiteralExpression)
                                this.transpileObjectLiteralAssignment(<ts.Identifier>varDecl.name, cType, <ts.ObjectLiteralExpression>varDecl.initializer);
                            else if (varDecl.initializer.kind == ts.SyntaxKind.ArrayLiteralExpression)
                                this.transpileArrayLiteralAssignment(<ts.Identifier>varDecl.name, <ts.ArrayLiteralExpression>varDecl.initializer);
                            else {
                                this.emitter.emit(varDecl.name.getText());
                                this.emitter.emit(" = ");
                                this.transpileNode(varDecl.initializer);
                                this.emitter.emit(';\n');
                            }
                        }
                    }
                }
                break;
            case ts.SyntaxKind.Block:
                {
                    this.emitter.emit('{\n');
                    this.emitter.increaseIndent();
                    node.getChildren().forEach(c => this.transpileNode(c));
                    this.emitter.decreaseIndent();
                    this.emitter.emit('}\n');
                }
                break;
            case ts.SyntaxKind.IfStatement:
                {
                    let ifStatement = (<ts.IfStatement>node);
                    this.emitter.emit('if (');
                    this.transpileNode(ifStatement.expression);
                    this.emitter.emit(')\n');
                    if (ifStatement.thenStatement.kind != ts.SyntaxKind.Block)
                        this.emitter.increaseIndent();
                    this.transpileNode(ifStatement.thenStatement);
                    if (ifStatement.thenStatement.kind != ts.SyntaxKind.Block)
                        this.emitter.decreaseIndent();
                    if (ifStatement.elseStatement) {
                        this.emitter.emit('else\n')
                        if (ifStatement.elseStatement.kind != ts.SyntaxKind.Block)
                            this.emitter.increaseIndent();
                        this.transpileNode(ifStatement.elseStatement);
                        if (ifStatement.elseStatement.kind != ts.SyntaxKind.Block)
                            this.emitter.decreaseIndent();
                    }
                }
                break;
            case ts.SyntaxKind.ForStatement:
                {
                    let forStatement = <ts.ForStatement>node;
                    this.emitter.emit("for (");
                    if (forStatement.initializer)
                        this.transpileNode(forStatement.initializer);
                    this.emitter.emit(";");
                    if (forStatement.condition)
                        this.transpileNode(forStatement.condition);
                    this.emitter.emit(";");
                    if (forStatement.incrementor)
                        this.transpileNode(forStatement.incrementor);
                    this.emitter.emit(")\n")
                    this.transpileNode(forStatement.statement);
                }
                break;
            case ts.SyntaxKind.ForOfStatement:
                {
                    let forOfStatement = <ts.ForOfStatement>node;
                    if (forOfStatement.expression.kind != ts.SyntaxKind.Identifier) {
                        this.addError("Unsupported type of expression as array in for of: " + forOfStatement.getText());
                        break;
                    }

                    let symbols = GlobalContext.typeChecker.getSymbolsInScope(node, ts.SymbolFlags.Variable);
                    let iteratorVarName = "i";
                    if (symbols.filter(s => s.name == iteratorVarName).length > 0) {
                        let index = 1;
                        while (symbols.filter(s => s.name == iteratorVarName + "_" + index).length > 0)
                            index++;
                        iteratorVarName += "_" + index;
                    }
                    this.emitter.emitOnceToBeginningOfFunction("int16_t " + iteratorVarName);

                    let arrayName = forOfStatement.expression.getText();
                    let arrayVarInfo = this.typeHelper.getVariableInfo(<ts.Identifier>forOfStatement.expression);
                    let arrayType = <ArrayType>arrayVarInfo.type;
                    let arraySize = arrayVarInfo.newElementsAdded ? arrayName + ".size" : arrayType.capacity + "";

                    this.emitter.emit("for (" + iteratorVarName + " = 0; " + iteratorVarName + " < " + arraySize + "; " + iteratorVarName + "++)\n");
                    if (forOfStatement.initializer)
                        this.transpileNode(forOfStatement.initializer);
                    this.emitter.emit("{\n");
                    this.emitter.increaseIndent();
                    if (forOfStatement.statement.kind == ts.SyntaxKind.Block)
                        (<ts.Block>forOfStatement.statement).statements.forEach(s => this.transpileNode(s));
                    else
                        this.transpileNode(forOfStatement.statement);
                    this.emitter.decreaseIndent();
                    this.emitter.emit("}\n");

                }
                break;
            case ts.SyntaxKind.ForInStatement:
                this.addError("For-in statement is not yet supported!");
                break;
            case ts.SyntaxKind.ReturnStatement:
                {
                    this.memoryManager.insertDestructorsIfNecessary(node, this.emitter);
                    this.emitter.emit('return');
                    let expr = (<ts.ReturnStatement>node).expression;
                    if (expr) {
                        this.emitter.emit(' ');
                        this.transpileNode(expr);
                    }
                    this.emitter.emit(';\n');
                }
                break;
            case ts.SyntaxKind.ExpressionStatement:
                {
                    node.getChildren().forEach(c => this.transpileNode(c));
                    this.emitter.emit(";\n");
                }
                break;
            case ts.SyntaxKind.CallExpression:
                {
                    let call = <ts.CallExpression>node;
                    let callReplaced = false;
                    if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
                        let propAccess = <ts.PropertyAccessExpression>call.expression;
                        if (propAccess.expression.kind == ts.SyntaxKind.Identifier
                            && propAccess.expression.getText() == 'console'
                            && propAccess.name.getText() == 'log') {
                            this.emitter.emitPredefinedHeader(HeaderKey.stdioh);
                            callReplaced = true;
                            for (let i = 0; i < call.arguments.length; i++)
                                this.printfTranspiler.transpile(call.arguments[i]);
                        } else if (propAccess.expression.kind == ts.SyntaxKind.Identifier
                            && propAccess.name.getText() == 'push'
                            && call.arguments.length == 1) {

                            let varInfo = this.typeHelper.getVariableInfo(<ts.Identifier>propAccess.expression);
                            if (varInfo && varInfo.type instanceof ArrayType) {
                                this.emitter.emitPredefinedHeader(HeaderKey.array);
                                this.emitter.emit("ARRAY_PUSH(");
                                this.emitter.emit(propAccess.expression.getText());
                                this.emitter.emit(",");
                                this.transpileNode(call.arguments[0]);
                                this.emitter.emit(")");
                                callReplaced = true;
                            }
                        } else if (propAccess.expression.kind == ts.SyntaxKind.Identifier
                            && propAccess.name.getText() == 'pop'
                            && call.arguments.length == 0) {

                            let varInfo = this.typeHelper.getVariableInfo(<ts.Identifier>propAccess.expression);
                            if (varInfo && varInfo.type instanceof ArrayType) {
                                this.emitter.emitPredefinedHeader(HeaderKey.array_pop);
                                this.emitter.emit("ARRAY_POP(");
                                this.emitter.emit(propAccess.expression.getText());
                                this.emitter.emit(")");
                                callReplaced = true;
                            }
                        }
                    }
                    if (!callReplaced) {
                        this.transpileNode(call.expression);
                        this.emitter.emit("(");
                        for (let i = 0; i < call.arguments.length; i++) {
                            this.transpileNode(call.arguments[i]);
                            if (i != call.arguments.length - 1)
                                this.emitter.emit(", ");
                        }
                        this.emitter.emit(")");
                    }
                }
                break;
            case ts.SyntaxKind.PropertyAccessExpression:
                {
                    let propAccess = <ts.PropertyAccessExpression>node;
                    let callReplaced = false;
                    if (propAccess.expression.kind == ts.SyntaxKind.Identifier
                        && propAccess.name.getText() == 'length') {

                        let varInfo = this.typeHelper.getVariableInfo(<ts.Identifier>propAccess.expression);
                        let varType = varInfo && varInfo.type;
                        if (varType instanceof ArrayType) {
                            if (varInfo.newElementsAdded) {
                                this.emitter.emit(propAccess.expression.getText());
                                this.emitter.emit(".");
                                this.emitter.emit("size");
                            } else
                                this.emitter.emit(varType.capacity + "");
                            callReplaced = true;
                        }
                    }

                    if (!callReplaced) {
                        this.transpileNode(propAccess.expression);
                        this.emitter.emit('->');
                        this.emitter.emit(propAccess.name.getText());
                    }
                }
                break;
            case ts.SyntaxKind.ElementAccessExpression:
                {
                    let appropriateTypeFound = false;
                    let elemAccess = <ts.ElementAccessExpression>node;
                    if (elemAccess.expression.kind == ts.SyntaxKind.Identifier && elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                        this.emitter.emit(elemAccess.expression.getText());
                        this.emitter.emit("->");
                        this.emitter.emit(elemAccess.argumentExpression.getText().slice(1, -1));
                        appropriateTypeFound = true;
                    }
                    else if (elemAccess.expression.kind == ts.SyntaxKind.Identifier) {
                        let varInfo = this.typeHelper.getVariableInfo(<ts.Identifier>elemAccess.expression);
                        if (varInfo && varInfo.type instanceof ArrayType) {
                            this.emitter.emit(elemAccess.expression.getText());
                            if (varInfo.newElementsAdded)
                                this.emitter.emit(".data");
                            this.emitter.emit("[");
                            this.transpileNode(elemAccess.argumentExpression);
                            this.emitter.emit("]");
                            appropriateTypeFound = true;
                        }
                    }

                    if (!appropriateTypeFound) {
                        this.emitter.emit("js_get(");
                        this.transpileNode(elemAccess.expression);
                        this.emitter.emit(', ');
                        this.transpileNode(elemAccess.argumentExpression);
                        this.emitter.emit(')');
                    }
                }
                break;
            case ts.SyntaxKind.BinaryExpression:
                {
                    let binExpr = <ts.BinaryExpression>node;
                    let leftType = this.typeHelper.convertType(GlobalContext.typeChecker.getTypeAtLocation(binExpr.left));
                    let rightType = this.typeHelper.convertType(GlobalContext.typeChecker.getTypeAtLocation(binExpr.right));
                    if (binExpr.operatorToken.kind == ts.SyntaxKind.EqualsEqualsToken && leftType == 'char *' && rightType == 'char *') {
                        this.emitter.emit("strcmp(");
                        this.transpileNode(binExpr.left);
                        this.emitter.emit(", ");
                        this.transpileNode(binExpr.right);
                        this.emitter.emit(") == 0");
                        this.emitter.emitPredefinedHeader(HeaderKey.stringh);
                    }
                    else if (binExpr.operatorToken.kind == ts.SyntaxKind.EqualsEqualsToken && (leftType != 'int16_t' || rightType != 'int16_t')) {
                        this.emitter.emitPredefinedHeader(HeaderKey.js_eq)
                        this.emitter.emit("js_eq(");
                        this.transpileNode(binExpr.left);
                        this.emitter.emit(", ");
                        this.transpileNode(binExpr.right);
                        this.emitter.emit(")");
                    }
                    else if (binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken && binExpr.parent.kind != ts.SyntaxKind.ExpressionStatement)
                        this.addError("Assignments inside expressions are not yet supported.");
                    else if (binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken && binExpr.left.kind == ts.SyntaxKind.Identifier && binExpr.right.kind == ts.SyntaxKind.ObjectLiteralExpression) {
                        this.transpileObjectLiteralAssignment(<ts.Identifier>binExpr.left, leftType, <ts.ObjectLiteralExpression>binExpr.right);
                    }
                    else if (binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken && binExpr.left.kind == ts.SyntaxKind.Identifier && binExpr.right.kind == ts.SyntaxKind.ArrayLiteralExpression) {
                        this.transpileArrayLiteralAssignment(<ts.Identifier>binExpr.left, <ts.ArrayLiteralExpression>binExpr.right);
                    }
                    else {
                        this.transpileNode(binExpr.left);
                        this.emitter.emit(this.convertOperatorToken(binExpr.operatorToken));
                        this.transpileNode(binExpr.right);
                    }
                }
                break;
            case ts.SyntaxKind.PrefixUnaryExpression:
                {
                    let prefixUnaryExpr = <ts.PrefixUnaryExpression>node;
                    let rightType = this.typeHelper.convertType(GlobalContext.typeChecker.getTypeAtLocation(prefixUnaryExpr.operand));
                    let operationReplaced = false;
                    let error = false;
                    switch (prefixUnaryExpr.operator) {
                        case ts.SyntaxKind.ExclamationToken:
                            if (rightType == "char *") {
                                this.emitter.emit("(!");
                                this.transpileStringExpression(prefixUnaryExpr.operand);
                                this.emitter.emit(" || !");
                                this.transpileStringExpression(prefixUnaryExpr.operand);
                                this.emitter.emit("[0])");
                                operationReplaced = true;
                            }
                            else
                                this.emitter.emit("!");
                            break;
                        default:
                            this.addError("Non-supported unary operator: " + ts.SyntaxKind[node.kind]);
                            error = true;
                    }
                    if (!operationReplaced && !error)
                        this.transpileNode(prefixUnaryExpr.operand);
                }
                break;
            case ts.SyntaxKind.TrueKeyword:
                this.emitter.emit("TRUE");
                this.emitter.emitPredefinedHeader(HeaderKey.bool);
                break;
            case ts.SyntaxKind.FalseKeyword:
                this.emitter.emitPredefinedHeader(HeaderKey.bool);
                this.emitter.emit("FALSE");
                break;
            case ts.SyntaxKind.NullKeyword:
                this.emitter.emit("NULL");
                break;
            case ts.SyntaxKind.NumericLiteral:
                this.emitter.emit(node.getText());
                break;
            case ts.SyntaxKind.StringLiteral:
                this.emitter.emit(this.convertString(node.getText()));
                break;
            case ts.SyntaxKind.Identifier:
                this.emitter.emit(node.getText());
                break;
            case ts.SyntaxKind.SourceFile:
            case ts.SyntaxKind.SyntaxList:
            case ts.SyntaxKind.EndOfFileToken:
                node.getChildren().forEach(c => this.transpileNode(c));
                break;
            case ts.SyntaxKind.SemicolonToken:
                break;
            default:
                this.addError("Non-supported node: " + ts.SyntaxKind[node.kind]);
                break;
        }

    }

    private transpileObjectLiteralAssignment(varName: ts.Identifier, cType: CType, objLiteral: ts.ObjectLiteralExpression) {
        if (cType instanceof StructType) {
            this.emitter.emit(varName.getText());
            this.emitter.emit(" = ");
            this.emitter.emit('malloc(sizeof(*' + varName.getText() + '));\n');
            this.emitter.emit('assert(' + varName.getText() + ' != NULL);\n');
            this.emitter.emitPredefinedHeader(HeaderKey.asserth);
            this.emitter.emitPredefinedHeader(HeaderKey.stdlibh);
            this.memoryManager.insertGlobalPointerIfNecessary(varName, this.emitter);
        }
        for (let prop of objLiteral.properties) {
            let propAssign = <ts.PropertyAssignment>prop;
            this.emitter.emit(varName.getText() + "->");
            this.emitter.emit(propAssign.name.getText());
            this.emitter.emit(" = ");
            this.transpileNode(propAssign.initializer);
            this.emitter.emit(";\n");
        }
    }

    private transpileArrayLiteralAssignment(varName: ts.Identifier, arrLiteral: ts.ArrayLiteralExpression) {
        let varInfo = this.typeHelper.getVariableInfo(varName);
        if (!varInfo || !(varInfo.type instanceof ArrayType))
            throw new Error("Internal error: Variable " + varName.getText() + " is not array, but it is assigned array literal.");
        let arrType = <ArrayType>varInfo.type;
        if (varInfo.newElementsAdded) {
            let optimizedCap = Math.max(arrType.capacity * 2, 4);
            this.emitter.emit("ARRAY_CREATE(" + varName.getText() + ", " + optimizedCap + ", " + arrType.capacity + ");\n");
            this.emitter.emitPredefinedHeader(HeaderKey.asserth);
            this.emitter.emitPredefinedHeader(HeaderKey.stdlibh);
            this.memoryManager.insertGlobalPointerIfNecessary(varName, this.emitter);
        }
        for (let i = 0; i < arrLiteral.elements.length; i++) {
            this.emitter.emit(varName.getText());
            if (varInfo.newElementsAdded)
                this.emitter.emit(".data");
            this.emitter.emit("[" + i + "]");
            this.emitter.emit(" = ");
            this.transpileNode(arrLiteral.elements[i]);
            this.emitter.emit(";\n");
        }
    }

    private convertOperatorToken(token: ts.Node) {
        switch (token.kind) {
            case ts.SyntaxKind.GreaterThanEqualsToken:
                return " >= ";
            case ts.SyntaxKind.GreaterThanToken:
                return " > ";
            case ts.SyntaxKind.LessThanEqualsToken:
                return " <= ";
            case ts.SyntaxKind.LessThanToken:
                return " < ";
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
                return " == ";
            case ts.SyntaxKind.EqualsEqualsToken:
                return " == ";
            case ts.SyntaxKind.PlusToken:
                return " + ";
            case ts.SyntaxKind.MinusToken:
                return " - ";
            case ts.SyntaxKind.AsteriskToken:
                return " * ";
            case ts.SyntaxKind.SlashToken:
                return " / ";
            case ts.SyntaxKind.EqualsToken:
                return " = ";
            default:
                this.addError("Unsupported operator: " + token.getText()); 
                return "<unsupported operator>";
        }
    }

    private transpileStringExpression(tsNode: ts.Node) {
        if (tsNode.kind != ts.SyntaxKind.Identifier) {
            this.emitter.emit("(");
            this.transpileNode(tsNode);
            this.emitter.emit(")");
        } else
            this.emitter.emit(tsNode.getText());
    }

    private convertString(tsString: string) {
        if (tsString.indexOf("'") == 0) {
            return '"' + tsString.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        }
        return tsString;
    }

    private addError(error: string) {
        this.errors.push(error);
    }

}