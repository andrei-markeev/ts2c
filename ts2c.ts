import {GlobalContext} from './src/global';
import {Transpiler} from './src/transpile';
import * as ts from 'typescript';

declare function require(name:string);
declare var process: any;

// Public API
export namespace ts2c
{
    export function transpile(source: string, options?: Options): string {
        var fileNames = ['source.ts'];
        var sourceFile = ts.createSourceFile('source.ts', source, ts.ScriptTarget.ES5);
        return new Transpiler().transpile(sourceFile);
    }

    export interface Options {
        // no options for now, but there will be,
        // because targeting different microcontrollers is very different
    }
}

// When used in Node environment, this file is also a command line tool
(function() {

    if (process && process.nextTick && !process.browser && typeof require !== "undefined")
    {

        var fs = require('fs');

        if (process.argv.length < 2)
            process.exit();

        var fileNames = process.argv.slice(2);
        GlobalContext.init(fileNames);

        for (var source of GlobalContext.program.getSourceFiles())
        {
            let transpiler = new Transpiler();
            var cprogram = transpiler.transpile(source);
            fs.writeFileSync(source.fileName.slice(0, -3) + '.c', cprogram);
        }

        process.exit();

    }

})();