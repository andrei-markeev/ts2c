import * as ts from 'typescript';

import { CProgram } from './src/program';

export function transpile(source: string): string {
    var sourceFile = ts.createSourceFile('source.ts', source, ts.ScriptTarget.ES5, true);
    var compilerHost: ts.CompilerHost = {
        getSourceFile: (fileName, target) => 'source.ts' ? sourceFile : null,
        writeFile: (name, text, writeByteOrderMark) => { },
        getDefaultLibFileName: () => { return "lib.d.ts"; },
        useCaseSensitiveFileNames: () => { return false; },
        getCanonicalFileName: fileName => fileName,
        getCurrentDirectory: () => "",
        getDirectories: () => [],
        getNewLine: () => "\n",
        fileExists: fileName => fileName == 'source.ts',
        readFile: fileName => fileName == 'source.ts' ? source : null,
        directoryExists: dirName => dirName == "",
    };
    var program = ts.createProgram(['source.ts'], { noLib: true }, compilerHost);
    return new CProgram(program)["resolve"]();
};
