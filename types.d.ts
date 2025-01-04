import { SyntaxNode } from "@andrei-markeev/kataw";

declare global {
    var console: {
        error: (...args: any) => void;
        warn: (...args: any) => void;
        log: (...args: any) => void;
    }
    var process: undefined | { exit(exitCode: number): void; }
}

declare module "@andrei-markeev/kataw" {
    interface SyntaxNode {
        id: number;
        parent?: SyntaxNode;
    }
}
