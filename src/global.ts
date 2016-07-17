import * as ts from 'typescript'

export class GlobalContext {

    public static fileNames: string[];
    public static program: ts.Program;
    public static typeChecker: ts.TypeChecker;

    public static init(fileNames: string[]) {
        this.fileNames = fileNames;
        this.program = ts.createProgram(this.fileNames, { noLib: true });
        this.typeChecker = this.program.getTypeChecker();
    }

}