export enum HeaderKey {
    stringh,
    stdlibh,
    stdioh,
    asserth,
    bool,
    uint8_t,
    int16_t,
    js_var,
    js_eq,
    array,
    array_pop,
    gc_iterator
}

export enum EmitTarget {
    global,
    header,
    mainFunction,
    beginningOfFunction,
    functionBody
}

export class Emitter {
    transpiledCode: { [key: number]: string } = {};
    defaultTarget: EmitTarget = EmitTarget.mainFunction;
    predefinedHeaders: { [key: number]: boolean } = {};
    indentText: string = '    ';
    beginningOfFunctionIndentText: string = '    ';
    beginningOfFunctionOnceStrings: { [key: string]: boolean } = {};
    nextIndent: boolean = true;
    targetsStack: { target: EmitTarget, indent: string }[] = [];

    public emit(s: string) {
        this.emitInternal(s, this.defaultTarget);
    }
    public emitToHeader(s: string) {
        var savedIndent = this.indentText;
        this.indentText = '';
        this.emitInternal(s, EmitTarget.header);
        this.indentText = savedIndent;
    }
    public emitOnceToHeader(s: string) {
        if (this.transpiledCode[EmitTarget.header] && this.transpiledCode[EmitTarget.header].indexOf(s) > -1)
            return;
        this.emitToHeader(s);
    }
    public increaseIndent() {
        this.indentText += '    ';
    }
    public decreaseIndent() {
        this.indentText = this.indentText.substr(4);
    }
    public beginFunction() {
        this.pushEmitTarget(EmitTarget.global);
    }
    public beginFunctionBody() {
        this.transpiledCode[EmitTarget.beginningOfFunction] = '';
        this.transpiledCode[EmitTarget.functionBody] = '';
        this.beginningOfFunctionIndentText = this.indentText;
        this.pushEmitTarget(EmitTarget.functionBody);
    }
    public emitToBeginningOfFunction(s: string) {
        if (this.defaultTarget == EmitTarget.mainFunction) {
            this.emitToHeader(s);
            return;
        }

        var savedIndent = this.indentText;
        this.indentText = this.beginningOfFunctionIndentText;
        this.emitInternal(s, EmitTarget.beginningOfFunction);
        this.indentText = savedIndent;
    }
    public emitOnceToBeginningOfFunction(s: string) {
        if (this.beginningOfFunctionOnceStrings[s])
            return;
        this.emitToBeginningOfFunction(s);
        this.beginningOfFunctionOnceStrings[s] = true;        
    }
    public finalizeFunction() {
        this.transpiledCode[EmitTarget.global] += this.transpiledCode[EmitTarget.beginningOfFunction];
        this.transpiledCode[EmitTarget.global] += this.transpiledCode[EmitTarget.functionBody];

        this.popEmitTarget();
        this.popEmitTarget();
    }
    private emitInternal(s: string, target: EmitTarget) {
        this.transpiledCode[target] = this.transpiledCode[target] || '';

        if (this.nextIndent) {
            this.transpiledCode[target] += this.indentText;
            this.nextIndent = false;
        }
        if (s.indexOf('\n') != -1)
            this.nextIndent = true;
        this.transpiledCode[target] += s;
    }

    public emitPredefinedHeader(key: HeaderKey) {
        this.predefinedHeaders[key] = true;
    }
    public finalize(): string {
        var headers = '';
        if (this.predefinedHeaders[HeaderKey.stringh])
            headers += "#include <string.h>\n";
        if (this.predefinedHeaders[HeaderKey.stdlibh])
            headers += "#include <stdlib.h>\n";
        if (this.predefinedHeaders[HeaderKey.stdioh])
            headers += "#include <stdio.h>\n";
        if (this.predefinedHeaders[HeaderKey.stdlibh])
            headers += "#include <assert.h>\n";
        headers += '\n';
        if (this.predefinedHeaders[HeaderKey.bool])
            headers += "#define TRUE 1\n#define FALSE 0\n";
        headers += '\n';
        if (this.predefinedHeaders[HeaderKey.bool] || this.predefinedHeaders[HeaderKey.js_var])
            headers += "typedef unsigned char uint8_t;\n";
        if (this.predefinedHeaders[HeaderKey.int16_t] || this.predefinedHeaders[HeaderKey.array] || this.predefinedHeaders[HeaderKey.js_var])
            headers += "typedef int int16_t;\n";
        headers += '\n';
        if (this.predefinedHeaders[HeaderKey.js_var]) {
            headers += "enum js_var_type {JS_VAR_BOOL, JS_VAR_INT, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_STRUCT, JS_VAR_DICT};\n"
            headers += "struct js_var {\n    enum js_var_type type;\n    uint8_t bool;\n    int16_t number;\n    char *string;\n    void *obj;\n};\n";
        }
        headers += '\n';

        if (this.predefinedHeaders[HeaderKey.array])
            headers += `
#define ARRAY(T) struct {\\
    int16_t size;\\
    int16_t capacity;\\
    T *data;\\
}
#define ARRAY_CREATE(array, init_capacity, init_size) { \\
    array.data = malloc(init_capacity * sizeof(*array.data)); \\
    assert(array.data != NULL); \\
    array.capacity = init_capacity; \\
    array.size = init_size; \\
}
#define ARRAY_PUSH(array, item) {\\
    if (array.size == array.capacity) {  \\
        array.capacity *= 2;  \\
        array.data = realloc(array.data, array.capacity * sizeof(*array.data)); \\
    }  \\
    array.data[array.size++] = item; \\
}
`;
        if (this.predefinedHeaders[HeaderKey.array_pop])
            headers += "#define ARRAY_POP(a) (a.size != 0 && --a.size ? a.data[a.size] : 0)\n"; 

        if (this.predefinedHeaders[HeaderKey.js_eq])
            headers += `
uint8_t js_eq(struct js_var *a, struct js_var *b) {
    /* TODO: implement */
}
`;
        if (this.predefinedHeaders[HeaderKey.gc_iterator])
            headers += "int16_t _gc_i;\n";

        headers += "\n";

        headers += this.transpiledCode[EmitTarget.header] || '';

        headers += "\n";

        headers += this.transpiledCode[EmitTarget.global] || '';

        headers += "\n";

        headers = headers.replace(/\n{3,}/g, '\n\n');

        return headers + "int main() {\n" + (this.transpiledCode[EmitTarget.mainFunction] || '') + "    return 0;\n}\n";
    }

    private pushEmitTarget(target: EmitTarget) {
        this.targetsStack.push({ target: this.defaultTarget, indent: this.indentText });
        this.defaultTarget = target;
        if (target == EmitTarget.mainFunction)
            this.indentText = '    ';
        else if (target == EmitTarget.global)
            this.indentText = '';
    }
    private popEmitTarget() {
        var v = this.targetsStack.pop();
        this.defaultTarget = v.target;
        this.indentText = v.indent;
    }

}