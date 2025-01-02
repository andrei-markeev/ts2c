import { SyntaxNode } from "kataw";

declare global {
    var console: {
        error: (...args: any) => void;
        warn: (...args: any) => void;
        log: (...args: any) => void;
    }
}

declare module "kataw" {
    interface SyntaxNode {
        id: string;
        parent?: SyntaxNode;
    }
}
