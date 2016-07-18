import {GlobalContext} from './src/global';
import {Transpiler} from './src/transpile';
import * as ts from 'typescript';

declare function require(name: string);
declare var process: any;

// Public API
if (typeof window !== 'undefined')
    window["ts2c"] = {
        transpile(source: string): string {
            GlobalContext.init(source);
            let sourceFile = GlobalContext.program.getSourceFiles()[0];
            return new Transpiler().transpile(sourceFile);
        }
    };

// When used in Node environment, this file is also a command line tool
(function () {

    if (typeof process !== 'undefined' && process.nextTick && !process.browser && typeof require !== "undefined") {

        var fs = require('fs');

        if (process.argv.length < 2)
            process.exit();

        var fileNames = process.argv.slice(2);
        GlobalContext.init(fileNames);

        for (var source of GlobalContext.program.getSourceFiles()) {
            let transpiler = new Transpiler();
            var cprogram = transpiler.transpile(source);
            fs.writeFileSync(source.fileName.slice(0, -3) + '.c', cprogram);
        }

        process.exit();

    }

})();