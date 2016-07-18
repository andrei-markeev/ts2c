import * as ts from 'typescript'

export class GlobalContext {

    public static fileNames: string[];
    public static program: ts.Program;
    public static typeChecker: ts.TypeChecker;

    public static init(fileNamesOrSourceCode: string[] | string) {
        if (typeof fileNamesOrSourceCode === 'string') {
            var sourceFile = ts.createSourceFile('source.ts', fileNamesOrSourceCode, ts.ScriptTarget.ES5, true);
            var compilerHost: ts.CompilerHost = {
                getSourceFile: (fileName, target) => 'source.ts' ? sourceFile : null,
                writeFile: (name, text, writeByteOrderMark) => { },
                getDefaultLibFileName: () => { return "lib.d.ts"; },
                useCaseSensitiveFileNames: () => { return false; },
                getCanonicalFileName: fileName => fileName,
                getCurrentDirectory: () => "",
                getNewLine: () => "\n",
                fileExists: fileName => fileName == 'source.ts',
                readFile: fileName => fileName == 'source.ts' ? fileNamesOrSourceCode : null,
                directoryExists: dirName => dirName == "",
            };
            this.program = ts.createProgram(['source.ts'], { noLib: true}, compilerHost);
            this.typeChecker = this.program.getTypeChecker();
        }
        else {
            this.fileNames = fileNamesOrSourceCode;
            this.program = ts.createProgram(this.fileNames, { noLib: true });
            this.typeChecker = this.program.getTypeChecker();
        }
    }

}