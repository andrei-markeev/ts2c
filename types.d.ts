import { ForInStatement, ForOfStatement, ForStatement, SyntaxNode, VariableDeclarationList, VariableStatement } from "@andrei-markeev/kataw";
import { SymbolInfo } from "./src/symbols";

declare global {
    var console: {
        error: (...args: any) => void;
        warn: (...args: any) => void;
        log: (...args: any) => void;
    }
    var process: undefined | { exit(exitCode: number): void; }
    var XMLHttpRequest: any;
}

declare module "@andrei-markeev/kataw" {
    interface SyntaxNode {
        /** id of the RootNode to which the node belongs */
        rootId: number;
        /** id of the node */
        id: number;
        parent?: SyntaxNode;
    }
    interface Identifier {
        symbol?: SymbolInfo;
    }
}
