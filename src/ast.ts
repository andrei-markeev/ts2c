import * as kataw from '@andrei-markeev/kataw';
import { addStandardCallSymbols } from "./standard";
import { getAllNodesInFunction, isCall, isCatchClause, isExpressionStatement, isFieldAccess, isFunction, isFunctionDeclaration, isFunctionExpression, isParenthesizedExpression, isPropertyDefinition, isReturnStatement, isStringLiteral, isVariableDeclaration, isWithStatement, SyntaxKind_NaNIdentifier } from './types/utils';
import { SymbolsHelper } from './symbols';
import { parse } from './parser';

export let astInfo = {
    nextNodeId: 1
}

export function collectSymbolsAndTransformAst(rootNode: kataw.RootNode, entryFileName: string | undefined, symbolsHelper: SymbolsHelper) {
    rootNode.id = astInfo.nextNodeId++;
    rootNode.rootId = rootNode.id;

    symbolsHelper.createSymbolScope(rootNode.id, rootNode.start, rootNode.end);
    symbolsHelper.addStandardSymbols(rootNode.id);
    addStandardCallSymbols(rootNode.id, symbolsHelper);

    const fileSystem = getFileSystemWrapper();
    const nodes: kataw.SyntaxNode[] = [rootNode];
    const rootNodes: kataw.RootNode[] = [rootNode];
    const loaded: Record<string, number | boolean> = { [entryFileName]: rootNode.id };
    const rootInfo = [{ rootId: rootNode.id, fileName: entryFileName }];
    const transform = kataw.createTransform();
    const createVisitor = (parent: kataw.SyntaxNode) => {
        return (n: kataw.SyntaxNode) => {
            n.parent = parent;
            n.rootId = rootInfo[0].rootId;
            n.id = astInfo.nextNodeId++;
            nodes.push(n);

            if (kataw.isIdentifier(n)) {
                if (isFunctionDeclaration(n.parent) && n.parent.name === n) {
                    const exported = n.parent.parent.kind === kataw.SyntaxKind.ExportDeclaration;
                    symbolsHelper.registerSymbol(n, exported);
                } else if (isVariableDeclaration(n.parent) && n.parent.binding === n) {
                    const exported = n.parent.parent.parent.parent.kind === kataw.SyntaxKind.ExportDeclaration;
                    symbolsHelper.registerSymbol(n, exported);
                } else if (n.parent.kind === kataw.SyntaxKind.FormalParameterList)
                    symbolsHelper.registerSymbol(n);
                else if (isPropertyDefinition(n.parent) && n.parent.left === n)
                    symbolsHelper.registerSymbol(n);
                else if (isCatchClause(n.parent) && n.parent.catchParameter === n)
                    symbolsHelper.registerSymbol(n);
                else if (n.parent.kind === kataw.SyntaxKind.ImportSpecifier) {
                    const specifier = <kataw.ImportSpecifier>n.parent;
                    const importDecl = <kataw.ImportDeclaration>n.parent.parent.parent.parent.parent;
                    const moduleNameNode = importDecl.fromClause.from;
                    const moduleName = isStringLiteral(moduleNameNode) ? moduleNameNode.text : null;
                    let filePath: string;
                    if (moduleName.startsWith('.'))
                        filePath = fileSystem.path.join(fileSystem.path.dirname(rootInfo[0].fileName), moduleName + '.ts');
                    else
                        filePath = fileSystem.path.join(fileSystem.path.dirname(rootInfo[0].fileName), 'node_modules', moduleName + '.ts');
                    const loadedValue = loaded[filePath];
                    if (typeof loadedValue === 'number') {
                        const exports = symbolsHelper.exportedSymbols[loadedValue];
                        const exportName = specifier.name ? specifier.name.text : specifier.binding.text;
                        const found = exports.find(e => e.valueDeclaration.text === exportName);
                        if (!found)
                            console.warn('Symbol with name ' + specifier.name.text + ' was not found among module ' + filePath + ' exports.');
                        else
                            symbolsHelper.insertExistingSymbolIntoScope(specifier.binding, found);
                    }
                } else if (isFieldAccess(n.parent))
                    symbolsHelper.addReference(n);
                else
                    symbolsHelper.addReference(n);

                if (n.text === "NaN" && symbolsHelper.isGlobalSymbol(n))
                    n.kind = SyntaxKind_NaNIdentifier;
                else if (n.text === "Number" && symbolsHelper.isGlobalSymbol(n) && isFieldAccess(n.parent) && n.parent.member === n && kataw.isIdentifier(n.parent.expression) && n.parent.expression.text === 'NaN')
                    n.parent.kind = SyntaxKind_NaNIdentifier;
                else if (n.text === "undefined" && symbolsHelper.isGlobalSymbol(n))
                    n.kind = kataw.SyntaxKind.UndefinedKeyword;

                if (!n.text && n.kind === kataw.SyntaxKind.ThisKeyword)
                    (n as any).text = 'this';
            } else if (isFunction(n)) {
                symbolsHelper.createSymbolScope(n.rootId, n.formalParameterList.start, n.end);
            } else if (isWithStatement(n)) {
                symbolsHelper.createSymbolScope(n.rootId, n.statement.start, n.end);
                // TODO: add symbols from n.expression into scope
            }

            if (n.kind === kataw.SyntaxKind.ImportDeclaration) {
                // TODO:
                // convert import to variable declaration
                // if it's module specifier only, then ignore export statements
                const importDecl = <kataw.ImportDeclaration>n;
                const moduleNameNode = importDecl.moduleSpecifier || importDecl.fromClause.from;
                if (isStringLiteral(moduleNameNode)) {
                    const moduleName = moduleNameNode.text;
                    if (fileSystem === null)
                        console.error('File system is not supported in this environment! Skipping import of ' + moduleName);
                    else {
                        let filePath: string;
                        if (moduleName.startsWith('.'))
                            filePath = fileSystem.path.join(fileSystem.path.dirname(rootInfo[0].fileName), moduleName + '.ts');
                        else
                            filePath = fileSystem.path.join(fileSystem.path.dirname(rootInfo[0].fileName), 'node_modules', moduleName + '.ts');

                        if (!loaded[filePath]) {
                            loaded[filePath] = true;
                            if (fileSystem.fs.existsSync(filePath)) {
                                const contents = fileSystem.fs.readFileSync(filePath, 'utf-8');
                                const parseResult = parse(filePath, contents);
                                if (parseResult.fatalErrors.length === 0) {
                                    const rootId = astInfo.nextNodeId++;
                                    parseResult.rootNode.id = rootId;
                                    parseResult.rootNode.rootId = rootId;

                                    loaded[filePath] = rootId;

                                    symbolsHelper.createSymbolScope(rootId, rootNode.start, rootNode.end);
                                    symbolsHelper.addStandardSymbols(rootId);
                                    addStandardCallSymbols(rootId, symbolsHelper);
                                
                                    rootNodes.unshift(parseResult.rootNode);
                                    rootInfo.unshift({ rootId, fileName: filePath });
                                    kataw.visitEachChild(kataw.createTransform(), parseResult.rootNode, createVisitor(parseResult.rootNode));
                                    rootInfo.shift();
                                }
                            }
                        }
                    }
                }
            }

            const iifeVariant1 = isExpressionStatement(n)
                && isParenthesizedExpression(n.expression)
                && isCall(n.expression.expression)
                && isFunctionExpression(n.expression.expression.expression)
                && n.expression.expression.argumentList.elements.length === 0;
            const iifeVariant2 = isExpressionStatement(n)
                && isCall(n.expression)
                && isParenthesizedExpression(n.expression.expression)
                && isFunctionExpression(n.expression.expression.expression)
                && n.expression.argumentList.elements.length === 0;
            if (iifeVariant1 || iifeVariant2) {
                const fexpr = <kataw.FunctionExpression>(n as any).expression.expression.expression;
                const returns = getAllNodesInFunction(fexpr).filter(isReturnStatement);
                if (returns.length === 0) {
                    const statements = fexpr.contents.functionStatementList.statements;
                    const block = kataw.createBlock(statements, kataw.NodeFlags.None, n.start, n.end);
                    const blockStatement = kataw.createBlockStatement(block, kataw.NodeFlags.IsStatement, n.start, n.end);
                    const parentStatementsList = <kataw.FunctionStatementList>n.parent;
                    const index = parentStatementsList.statements.indexOf(n);
                    parentStatementsList.statements.splice(index, 1, blockStatement);
                    blockStatement.id = n.id;
                    blockStatement.parent = parentStatementsList;
                    n = blockStatement;
                }
            }

            kataw.visitEachChild(transform, n, createVisitor(n));
        }
    }
    kataw.visitEachChild(transform, rootNode, createVisitor(rootNode));
    symbolsHelper.renameConflictingSymbols();

    return { rootNodes, nodes };
}

function getFileSystemWrapper() {
    if (typeof process === 'object') {
        const path = require('path');
        const fs = require('fs');
        return {
            path: {
                join: path.join,
                dirname: path.dirname
            },
            fs: {
                existsSync: fs.existsSync,
                readFileSync: fs.readFileSync
            }
        }
    } else if (typeof XMLHttpRequest === 'object') {
        return {
            path: {
                join: (...parts: string[]) => parts.map(p => p.replace(/^\/+|\/+$/, '')).filter(p => p !== '').join('/'),
                dirname: (filePath: string) => filePath.substring(0, filePath.lastIndexOf('/'))
            },
            fs: {
                existsSync: checkFileExistsWithXHR,
                readFileSync: fetchFileWithXHR
            }
        }
    }
}

function fetchFileWithXHR(filePath: string) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', filePath, false);
    xhr.send();
    if (xhr.status === 200) {
        return xhr.responseText
    } else {
        console.error('Failed to load file ' + filePath + ': server returned ' + xhr.status + ' ' + xhr.responseText);
        return undefined;
    }
}

function checkFileExistsWithXHR(filePath: string) {
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', filePath, false);
    xhr.send();
    return xhr.status < 400;
}