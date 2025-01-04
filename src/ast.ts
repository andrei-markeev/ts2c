var performance = require("node:perf_hooks").performance;
import * as kataw from '@andrei-markeev/kataw';
import { addStandardCallSymbols } from "./standard";
import { getAllNodesInFunction, isCall, isCatchClause, isExpressionStatement, isFieldAccess, isFunction, isFunctionDeclaration, isFunctionExpression, isParenthesizedExpression, isPropertyDefinition, isReturnStatement, isVariableDeclaration, isWithStatement, SyntaxKind_NaNIdentifier } from './types/utils';
import { SymbolsHelper } from './symbols';

export let astInfo = {
    nextNodeId: 1
}

export function collectSymbolsAndTransformAst(rootNode: kataw.RootNode, symbolsHelper: SymbolsHelper) {
    symbolsHelper.createSymbolScope(rootNode.start, rootNode.end);
    symbolsHelper.addStandardSymbols();
    addStandardCallSymbols(symbolsHelper);

    const visitStart = performance.now();
    const nodes: kataw.SyntaxNode[] = [rootNode];
    const transform = kataw.createTransform();
    const createVisitor = (parent: kataw.SyntaxNode) => {
        return (n: kataw.SyntaxNode) => {
            n.parent = parent;
            n.id = astInfo.nextNodeId++;
            nodes.push(n);
            // TODO: imports
            if (kataw.isIdentifier(n)) {
                if (isFunctionDeclaration(n.parent) && n.parent.name === n)
                    symbolsHelper.registerSymbol(n);
                else if (n.parent.kind === kataw.SyntaxKind.FormalParameterList)
                    symbolsHelper.registerSymbol(n);
                else if (isVariableDeclaration(n.parent) && n.parent.binding === n)
                    symbolsHelper.registerSymbol(n);
                else if (isPropertyDefinition(n.parent) && n.parent.left === n)
                    symbolsHelper.registerSymbol(n);
                else if (isCatchClause(n.parent) && n.parent.catchParameter === n)
                    symbolsHelper.registerSymbol(n);
                else if (isFieldAccess(n.parent))
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
                symbolsHelper.createSymbolScope(n.formalParameterList.start, n.end);
            } else if (isWithStatement(n)) {
                symbolsHelper.createSymbolScope(n.statement.start, n.end);
                // TODO: add symbols from n.expression into scope
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
    rootNode.id = astInfo.nextNodeId++;
    kataw.visitEachChild(transform, rootNode, createVisitor(rootNode));
    symbolsHelper.renameConflictingSymbols();
    console.log('visit all nodes', performance.now() - visitStart);

    return nodes;
}