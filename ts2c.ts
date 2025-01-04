var performance = require("node:perf_hooks").performance;
import { parseModule } from '@andrei-markeev/kataw';
import { CProgram } from './src/program';
import { collectSymbolsAndTransformAst } from './src/ast';
import { SymbolsHelper } from './src/symbols';
import { TypeHelper } from './src/types/typehelper';
import { MemoryManager } from './src/memory';

export function transpile(sourceCode: string, options?: { fileName: string, terminal: boolean }): string {
    let fatalError: string = '';
    const startParse = performance.now();
    var rootNode = parseModule(sourceCode, { impliedStrict: true }, (_, kind, message, start, end) => {
        const formatted = getFormattedMessage(sourceCode, options?.fileName || "unknown.js", kind, message, start, end, options?.terminal);
        if (kind === 16) {
            console.error(formatted);
            fatalError += formatted + '\n';
        } else
            console.warn(formatted)
    });
    console.log('parse:', performance.now() - startParse);
    if (fatalError.length > 0) {
        if (options?.terminal && typeof process === 'object')
            globalThis.process.exit(1);
        else
            return '/*\n' + fatalError + '*/';
    }

    const startProcessAst = performance.now();
    const symbolsHelper = new SymbolsHelper();
    const nodes = collectSymbolsAndTransformAst(rootNode, symbolsHelper);
    nodes.sort((a, b) => a.start - b.start);
    console.log('process ast:', performance.now() - startProcessAst);

    const startInferTypes = performance.now();
    const typeHelper = new TypeHelper(symbolsHelper);
    typeHelper.inferTypes(nodes);
    console.log('infer types:', performance.now() - startInferTypes);

    const startEscapeAnalysis = performance.now();
    const memoryManager = new MemoryManager(typeHelper, symbolsHelper, typeHelper.standardCallHelper);
    memoryManager.scheduleNodeDisposals(nodes);
    console.log('escape analysis:', performance.now() - startEscapeAnalysis);

    const startEmit = performance.now();
    const transpiledCode = new CProgram(rootNode, symbolsHelper, typeHelper, typeHelper.standardCallHelper, memoryManager)["resolve"]();
    console.log('emit:', performance.now() - startEmit);

    return transpiledCode;
};

function getFormattedMessage(sourceCode, fileName, kind, message, start, end, useColors) {
    const relativePos = getLinePos(sourceCode, start, end);
    let output = fileName + ":";
    output += getLineNumber(sourceCode, start).toString() + ":";
    output += relativePos.pos + ":";
    if (useColors)
        output += kind === 16 ? " \x1b[31merror:\x1b[0m" : " warning:";
    else
        output += kind === 16 ? " error:" : " warning:";

    output += " " + message;
    return output;
}

function getLinePos(src: string, pos: number, end: number): any {
    const lastLine = src.lastIndexOf('\n', pos) + 1; // cut off the \n
    return {
        pos: pos - lastLine,
        end: end - lastLine
    };
}

function getLineNumber(src: string, pos: number) {
    let lineCount = 1;
    let currentIdx = 0;
    while (true) {
        const next = src.indexOf('\n', currentIdx + 1);
        if (next === -1) {
            return lineCount + 1;
        }
        if (pos >= currentIdx && pos <= next) {
            return lineCount;
        }
        lineCount++;
        currentIdx = next;
    }
}
