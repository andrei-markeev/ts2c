import {CProgram} from './src/program';
import * as ts from 'typescript';

declare function require(name: string);
declare var process: any;

// Public API
if (typeof window !== 'undefined')
    window["ts2c"] = {
        transpile(source: string): string {
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
        }
    };

// When used in Node environment, this file is also a command line tool
(function () {

    if (typeof process !== 'undefined' && process.nextTick && !process.browser && typeof require !== "undefined") {

        var fs = require('fs');

        if (process.argv.length < 2)
            process.exit();

        var fileNames = process.argv.slice(2);
        var program = ts.createProgram(fileNames, { noLib: true, allowJs: true });

        var output = new CProgram(program)["resolve"]();
        fs.writeFileSync(fileNames[0].slice(0, -3) + '.c', output);

        process.exit();

    }

})();