import * as kataw from '@andrei-markeev/kataw';
import { addStandardCallSymbols } from "./standard";
import { getAllNodesInFunction, isCall, isCatchClause, isExpressionStatement, isFieldAccess, isFunction, isFunctionDeclaration, isFunctionExpression, isParenthesizedExpression, isPropertyDefinition, isReturnStatement, isStringLiteral, isVariableDeclaration, isWithStatement, SyntaxKind_NaNIdentifier } from './types/utils';
import { SymbolsHelper } from './symbols';
import { parse } from './parser';
import { getFileSystemWrapper } from './fs';
import { getPossibleFilePaths } from './modules';

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
    const rootDir = fileSystem.path.dirname(entryFileName);
    let curDir = rootDir;

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
                else if (n.parent.kind === kataw.SyntaxKind.ExportSpecifier)
                    symbolsHelper.addToExportedSymbols(n);
                else if (n.parent.kind === kataw.SyntaxKind.ImportSpecifier) {
                    const specifier = <kataw.ImportSpecifier>n.parent;
                    const importDecl = <kataw.ImportDeclaration>n.parent.parent.parent.parent.parent;
                    const moduleNameNode = importDecl.fromClause.from;
                    const moduleName = isStringLiteral(moduleNameNode) ? moduleNameNode.text : null;

                    const filePaths = getPossibleFilePaths(rootDir, curDir, moduleName);
                    let moduleRootNodeFound = false;
                    for (const filePath of filePaths) {
                        const moduleRootNodeId = loaded[filePath];
                        if (typeof moduleRootNodeId === 'number') {
                            const exports = symbolsHelper.exportedSymbols[moduleRootNodeId];
                            const exportName = specifier.name ? specifier.name.text : specifier.binding.text;
                            const found = exports?.find(e => e.valueDeclaration.text === exportName);
                            if (!found)
                                console.warn('Symbol with name ' + exportName + ' was not found among module ' + filePath + ' exports.');
                            else
                                symbolsHelper.insertExistingSymbolIntoScope(specifier.binding, found);
                            moduleRootNodeFound = true;
                            break;
                        }
                    }
                    if (!moduleRootNodeFound)
                        console.warn('Failed to resolve import "' + moduleName + '" in file ' + rootInfo[0].fileName + '.');
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
                        const filePaths = getPossibleFilePaths(rootDir, curDir, moduleName)

                        while (filePaths.length > 0) {
                            const filePath = filePaths.shift();
                            if (loaded[filePath])
                                continue;
                            
                            loaded[filePath] = true;
                            if (!fileSystem.fs.existsSync(filePath))
                                continue;

                            const contents = fileSystem.fs.readFileSync(filePath, 'utf-8');
                            const parseResult = parse(filePath, contents, { allowTypes: filePath.endsWith('.d.ts') });
                            if (parseResult.fatalErrors.length > 0)
                                continue;

                            const rootId = astInfo.nextNodeId++;
                            parseResult.rootNode.id = rootId;
                            parseResult.rootNode.rootId = rootId;

                            loaded[filePath] = rootId;

                            symbolsHelper.createSymbolScope(rootId, rootNode.start, rootNode.end);
                            symbolsHelper.addStandardSymbols(rootId);
                            addStandardCallSymbols(rootId, symbolsHelper);
                        
                            rootNodes.unshift(parseResult.rootNode);
                            rootInfo.unshift({ rootId, fileName: filePath });
                            curDir = fileSystem.path.dirname(rootInfo[0].fileName);
                            kataw.visitEachChild(kataw.createTransform(), parseResult.rootNode, createVisitor(parseResult.rootNode));
                            rootInfo.shift();
                            curDir = fileSystem.path.dirname(rootInfo[0].fileName);
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
