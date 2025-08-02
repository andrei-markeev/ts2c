var performance = require("node:perf_hooks").performance;
import { parse } from './src/parser';
import { SymbolsHelper } from './src/symbols';
import { TypeHelper } from './src/types/typehelper';
import { MemoryManager } from './src/memory';
import { collectSymbolsAndTransformAst } from './src/ast';
import { CProgram, HeaderFlags } from './src/program';
import { CCommon } from './src/common';
import { CHeader } from './src/header';

// these imports are here only because it is necessary to run decorators
import './src/nodes/statements';
import './src/nodes/expressions';
import './src/nodes/call';
import './src/nodes/literals';
import './src/nodes/function';

import './src/standard/global/parseInt';
import './src/standard/global/isNaN';

import './src/standard/array/forEach';
import './src/standard/array/push';
import './src/standard/array/pop';
import './src/standard/array/unshift';
import './src/standard/array/shift';
import './src/standard/array/splice';
import './src/standard/array/slice';
import './src/standard/array/concat';
import './src/standard/array/join';
import './src/standard/array/indexOf';
import './src/standard/array/lastIndexOf';
import './src/standard/array/sort';
import './src/standard/array/reverse';

import './src/standard/string/search';
import './src/standard/string/charCodeAt';
import './src/standard/string/charAt';
import './src/standard/string/concat';
import './src/standard/string/substring';
import './src/standard/string/slice';
import './src/standard/string/toString';
import './src/standard/string/indexOf';
import './src/standard/string/lastIndexOf';
import './src/standard/string/match';

import './src/standard/number/number';

import './src/standard/console/log';

import './src/standard/typedarray/uint8array';

export function transpile(sourceCode: string): string;
export function transpile(sourceCode: string, options: { fileName?: string, terminal?: boolean, multiFiles?: false | undefined }): string;
export function transpile(sourceCode: string, options: { fileName?: string, terminal?: boolean, multiFiles: true }): { fileName: string, source: string }[];

export function transpile(sourceCode: string, options?: { fileName?: string, terminal?: boolean, multiFiles?: boolean }): string | { fileName: string, source: string }[] {
    const entryFilePath = options?.fileName || "__main__.ts";
    const endOfPathPos = entryFilePath.lastIndexOf('/');
    let baseDir = '';
    let commonHeaderPath = 'common.h';
    if (endOfPathPos > -1) {
        baseDir = entryFilePath.substring(0, endOfPathPos);
        commonHeaderPath = baseDir + '/common.h';
    }
    
    const startParse = performance.now();
    var parseResult = parse(entryFilePath, sourceCode, { useColors: options?.terminal });
    console.log('parse:', performance.now() - startParse);
    if (parseResult.fatalErrors.length > 0) {
        if (options?.terminal && typeof process === 'object')
            process.exit(1);
        else {
            const transpiledCode = '/*\n' + parseResult.fatalErrors.join('\n') + '\n*/';
            if (options?.multiFiles)
                return [{ fileName: parseResult.rootNode.fileName.replace(/(\.ts|\.js)$/, '.c'), source: transpiledCode }];
            else
                return transpiledCode;
        }
    }

    const startProcessAst = performance.now();
    const symbolsHelper = new SymbolsHelper();
    const { rootNodes, nodes } = collectSymbolsAndTransformAst(parseResult.rootNode, options?.fileName, symbolsHelper);
    nodes.sort((a, b) => b.rootId - a.rootId || a.start - b.start);
    console.log('process ast:', performance.now() - startProcessAst);

    const startInferTypes = performance.now();
    const typeHelper = new TypeHelper(symbolsHelper);
    typeHelper.inferTypes(nodes);
    console.log('infer types:', performance.now() - startInferTypes);

    const startEscapeAnalysis = performance.now();
    const memoryManager = new MemoryManager(typeHelper, symbolsHelper, typeHelper.standardCallHelper);
    memoryManager.scheduleNodeDisposals(nodes);
    console.log('escape analysis:', performance.now() - startEscapeAnalysis);

    const transpiled: { fileName: string, source: string }[] = [];
    let commonFlags: HeaderFlags | null = null
    if (rootNodes.filter(n => !n.fileName.endsWith('.d.ts')).length > 1)
        commonFlags = new HeaderFlags();
    for (const rootNode of rootNodes) {
        if (rootNode.fileName.endsWith('.d.ts'))
            continue;

        const startEmit = performance.now();
        const program = new CProgram(rootNode, commonFlags, symbolsHelper, typeHelper, typeHelper.standardCallHelper, memoryManager);
        const transpiledProgramCode = program["resolve"]();
        const transpiledFileName = rootNode.fileName.replace(/(\.ts|\.js)$/, '.c');
        console.log('emit ' + transpiledFileName + ':', performance.now() - startEmit);

        if (symbolsHelper.exportedSymbols[rootNode.id]) {

            const startEmitHeader = performance.now();
            const header = new CHeader(program, rootNode, symbolsHelper, typeHelper);
            const transpiledHeaderCode = header["resolve"]();
            const transpiledHeaderFileName = rootNode.fileName.replace(/(\.ts|\.js)$/, '.h');
            console.log('emit ' + transpiledHeaderFileName + ':', performance.now() - startEmitHeader);

            transpiled.push({ fileName: transpiledHeaderFileName, source: transpiledHeaderCode });
        }
        transpiled.push({ fileName: transpiledFileName, source: transpiledProgramCode });
    }
    if (commonFlags !== null) {
        const startEmitCommonHeader = performance.now();
        transpiled.unshift({ fileName: commonHeaderPath, source: new CCommon(commonFlags, true)["resolve"]() });
        console.log('emit common.h:', performance.now() - startEmitCommonHeader);
    }

    if (options?.multiFiles)
        return transpiled;
    else if (transpiled.length > 1)
        return transpiled.map(t => '/* File: ' + t.fileName + ' */\n\n' + t.source).join('\n\n');
    else
        return transpiled[0].source;
}
