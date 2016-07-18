import {GlobalContext} from './global';
import {TypeHelper, CType, StructType, ArrayType, UniversalVarType} from './types';
import {Emitter} from './emit';
import * as ts from 'typescript';

class PrintfVariable {
    name: string;
    type: CType;
}

export class PrintfTranspiler {
    constructor(
        private emitter: Emitter,
        private typeHelper: TypeHelper,
        private transpileNode: { (node: ts.Node): void },
        private addError: { (error: string): void }
    ) { }

    public transpile(printNode: ts.Node | PrintfVariable, newLine: boolean = true) {
        let cType: CType;
        let varName: string;
        if (printNode instanceof PrintfVariable) {
            cType = printNode.type;
            varName = printNode.name;
        } else if (printNode.kind == ts.SyntaxKind.Identifier) {
            let varInfo = this.typeHelper.getVariableInfo(<ts.Identifier>printNode);
            cType = varInfo && varInfo.type || "void *";
            varName = printNode.getText();
        } else {
            cType = this.typeHelper.convertType(GlobalContext.typeChecker.getTypeAtLocation(printNode));
        }

        if (cType == 'char *') {
            if (!(printNode instanceof PrintfVariable) && printNode.kind == ts.SyntaxKind.StringLiteral)
            {
                this.emitter.emit("printf(\"" + printNode.getText().slice(1,-1) + (newLine ? "\\n" : "") + "\")");
            }
            else
            {
                this.emitter.emit("printf(\"%s" + (newLine ? "\\n" : "") + "\", ");
                this.printfTranspilePrintNode(printNode);
                this.emitter.emit(")");
            }
        } else if (cType == 'int16_t') {
            this.emitter.emit("printf(\"%d" + (newLine ? "\\n" : "") + "\", ");
            this.printfTranspilePrintNode(printNode);
            this.emitter.emit(")");
        } else if (cType == 'uint8_t') {
            this.emitter.emit("printf(");
            this.printfTranspilePrintNode(printNode);
            this.emitter.emit(" ? \"true" + (newLine ? "\\n" : "") + "\" : \"false" + (newLine ? "\\n" : "") + "\")");
        } else if (cType instanceof StructType) {
            let propKeysToDisplay = [];
            this.emitter.emit("printf(\"{ ");
            for (let propKey in cType.properties) {
                this.emitter.emit(propKey + ": ");
                if (cType.properties[propKey] instanceof ArrayType)
                    this.emitter.emit("[Array]");
                else if (cType.properties[propKey] instanceof StructType)
                    this.emitter.emit("[Object]");
                else if (cType.properties[propKey] == "char *") {
                    this.emitter.emit("%s");
                    propKeysToDisplay.push(propKey);
                }
                else if (cType.properties[propKey] == "int16_t") {
                    this.emitter.emit("%d");
                    propKeysToDisplay.push(propKey);
                }
                else if (cType.properties[propKey] == "bool") {
                    this.emitter.emit("%s");
                    propKeysToDisplay.push(propKey);
                }
                else
                    this.emitter.emit("[not supported]");
                this.emitter.emit(", ");
            }
            this.emitter.emit("}" + (newLine ? "\\n" : "") + "\"");
            for (let propKey of propKeysToDisplay) {
                this.emitter.emit(", ");
                this.printfTranspilePrintNode(printNode);
                this.emitter.emit("->" + propKey);
                if (cType.properties[propKey] == 'uint8_t')
                    this.emitter.emit(" ? \"true" + (newLine ? "\\n" : "") + "\" : \"false" + (newLine ? "\\n" : "") + "\"");
            }
            this.emitter.emit(")");
        } else if (cType instanceof ArrayType && !(printNode instanceof PrintfVariable) && printNode.kind == ts.SyntaxKind.Identifier) {
            let symbols = GlobalContext.typeChecker.getSymbolsInScope(printNode.parent, ts.SymbolFlags.Variable);
            let iteratorVarName = "i";
            if (symbols.filter(s => s.name == iteratorVarName).length > 0) {
                let index = 1;
                while (symbols.filter(s => s.name == iteratorVarName + "_" + index).length > 0)
                    index++;
                iteratorVarName += "_" + index;
            }
            let arrayName = printNode.getText();
            let arrayVarInfo = this.typeHelper.getVariableInfo(<ts.Identifier>printNode);
            let arraySize = arrayVarInfo.newElementsAdded ? arrayName + ".size" : cType.capacity + "";

            this.emitter.emitOnceToBeginningOfFunction("int16_t " + iteratorVarName + ";\n");
            this.emitter.emit("printf(\"[ \");\n");
            this.emitter.emit("for (" + iteratorVarName + " = 0; " + iteratorVarName + " < " + arraySize + "; " + iteratorVarName + "++) {\n");
            this.emitter.increaseIndent();
            this.emitter.emit("if (" + iteratorVarName + " != 0)\n")
            this.emitter.emit("    printf(\", \");\n");
            let printfVar = new PrintfVariable();
            printfVar.name = arrayName + (arrayVarInfo.newElementsAdded ? ".data" : "") + "[" + iteratorVarName + "]";
            printfVar.type = cType.elementType;
            this.transpile(printfVar, false);
            this.emitter.emit(";\n");
            this.emitter.decreaseIndent();
            this.emitter.emit("}\n");
            this.emitter.emit("printf(\" ]" + (newLine ? "\\n" : "") + "\")");
        } else if (cType == UniversalVarType) {
            this.emitter.emit("switch (");
            this.printfTranspilePrintNode(printNode);
            this.emitter.emit(".type) {\n");
            this.emitter.increaseIndent();

            this.emitter.emit("case JS_VAR_BOOL:\n")
            this.emitter.emit("    printf(");
            this.printfTranspilePrintNode(printNode);
            this.emitter.emit(" ? \"true\" : \"false\");\n");
            this.emitter.emit("    break;\n");

            this.emitter.emit("case JS_VAR_INT:\n")
            this.emitter.emit("    printf(\"%d\", ");
            this.printfTranspilePrintNode(printNode);
            this.emitter.emit(");\n");
            this.emitter.emit("    break;\n");

            this.emitter.emit("case JS_VAR_STRING:\n")
            this.emitter.emit("    printf(\"%s\", ");
            this.printfTranspilePrintNode(printNode);
            this.emitter.emit(");\n");
            this.emitter.emit("    break;\n");

            // TODO: implement JS_VAR_ARRAY, JS_VAR_STRUCT & JS_VAR_DICT

            this.emitter.decreaseIndent();
            this.emitter.emit("}" + (newLine ? "\\n" : ""));
        } else {
            this.addError("ERROR: console.log for type " + cType + " is not supported!");
        }

    }

    private printfTranspilePrintNode(printNode: PrintfVariable | ts.Node) {
        if (printNode instanceof PrintfVariable)
            this.emitter.emit(printNode.name);
        else if (printNode.kind == ts.SyntaxKind.Identifier)
            this.emitter.emit(printNode.getText());
        else if (printNode.kind == ts.SyntaxKind.StringLiteral
                || printNode.kind == ts.SyntaxKind.NumericLiteral)
            this.transpileNode(printNode);
        else {
            this.emitter.emit("(");
            this.transpileNode(printNode);
            this.emitter.emit(")");
        }
    }
}