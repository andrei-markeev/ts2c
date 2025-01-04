import { parseScript } from '@andrei-markeev/kataw';
import { CProgram } from './src/program';

export function transpile(sourceCode: string): string {
    var rootNode = parseScript(sourceCode, { impliedStrict: true }, (source, kind, message, start, end) => {
        if (kind === 16) {
            console.error('[' + start + '..' + end + ']:', message);
            return;
        } else
            console.warn('[' + start + '..' + end + ']:', message);
    });
    return new CProgram(rootNode)["resolve"]();
};
