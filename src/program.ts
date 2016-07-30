import * as ts from 'typescript'
import {MemoryManager} from './memory';
import {TypeHelper, ArrayType} from './types';
import {CodeTemplate, CodeTemplateFactory} from './template';
import {CFunction} from './nodes/function';
import {CVariable, CVariableDestructors} from './nodes/variable';

// these imports are here only because it is necessary to run decorators
import './nodes/statements';
import './nodes/expressions';

export interface IScope {
    parent: IScope;
    func: IScope;
    root: CProgram;
    variables: CVariable[];
    statements: any[];
}

class HeaderFlags {
    strings: boolean = false;
    printf: boolean = false;
    malloc: boolean = false;
    bool: boolean = false;
    uint8_t: boolean = false;
    int16_t: boolean = false;
    js_var: boolean = false;
    array: boolean = false;
    array_pop: boolean = false;
    gc_iterator: boolean = false;
    dict: boolean = false;
    str_int16_t_cmp: boolean = false;
    str_int16_t_cat: boolean = false;
    str_pos: boolean = false;
    str_len: boolean = false;
    atoi: boolean = false;
}


@CodeTemplate(`
{#if headerFlags.strings || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat || headerFlags.str_pos}
    #include <string.h>
{/if}
{#if headerFlags.malloc || headerFlags.atoi || headerFlags.array}
    #include <stdlib.h>
{/if}
{#if headerFlags.malloc || headerFlags.array}
    #include <assert.h>
{/if}
{#if headerFlags.printf}
    #include <stdio.h>
{/if}
{#if headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat}
    #include <limits.h>
{/if}

{#if headerFlags.bool}
    #define TRUE 1
    #define FALSE 0
{/if}
{#if headerFlags.bool || headerFlags.js_var}
    typedef unsigned char uint8_t;
{/if}
{#if headerFlags.int16_t || headerFlags.js_var || headerFlags.array ||
     headerFlags.str_int16_t_cmp || headerFlags.str_pos || headerFlags.str_len}
    typedef int int16_t;
{/if}

{#if headerFlags.js_var}
    enum js_var_type {JS_VAR_BOOL, JS_VAR_INT, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_STRUCT, JS_VAR_DICT};
	struct js_var {
	    enum js_var_type type;
	    uint8_t bool;
	    int16_t number;
	    const char *string;
	    void *obj;
	};
{/if}

{#if headerFlags.array}
    #define ARRAY(T) struct {\\
        int16_t size;\\
        int16_t capacity;\\
        T *data;\\
    } *
    #define ARRAY_CREATE(array, init_capacity, init_size) {\\
        array = malloc(sizeof(*array)); \\
        array->data = malloc(init_capacity * sizeof(*array->data)); \\
        assert(array->data != NULL); \\
        array->capacity = init_capacity; \\
        array->size = init_size; \\
    }
    #define ARRAY_PUSH(array, item) {\\
        if (array->size == array->capacity) {  \\
            array->capacity *= 2;  \\
            array->data = realloc(array->data, array->capacity * sizeof(*array->data)); \\
            assert(array->data != NULL); \\
        }  \\
        array->data[array->size++] = item; \\
    }
{/if}
{#if headerFlags.array_pop}
	#define ARRAY_POP(a) (a->size != 0 ? a->data[--a->size] : 0)
{/if}

{#if headerFlags.dict}
    #define DICT_GET(dict, prop) /* Dictionaries aren't supported yet. */
    #define DICT_SET(dict, prop, value) /* Dictionaries aren't supported yet. */
{/if}

{#if headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat}
    #define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)
{/if}
{#if headerFlags.str_int16_t_cmp}
    int str_int16_t_cmp(const char * str, int16_t num) {
        char numstr[STR_INT16_T_BUFLEN];
        sprintf(numstr, "%d", num);
        return strcmp(str, numstr);
    }
{/if}
{#if headerFlags.str_pos}
    int16_t str_pos(const char * str, const char *search) {
        int16_t i;
        const char * found = strstr(str, search);
        int16_t pos = 0;
        if (found == 0)
            return -1;
        while (*str && str < found) {
            i = 1;
            if ((*str & 0xE0) == 0xC0) i=2;
            else if ((*str & 0xF0) == 0xE0) i=3;
            else if ((*str & 0xF8) == 0xF0) i=4;
            str += i;
            pos += i == 4 ? 2 : 1;
        }
        return pos;
    }
{/if}
{#if headerFlags.str_len}
    int16_t str_len(const char * str) {
        int16_t len = 0;
        int16_t i = 0;
        while (*str) {
            i = 1;
            if ((*str & 0xE0) == 0xC0) i=2;
            else if ((*str & 0xF0) == 0xE0) i=3;
            else if ((*str & 0xF8) == 0xF0) i=4;
            str += i;
            len += i == 4 ? 2 : 1;
        }
        return len;
    }
{/if}
{#if headerFlags.str_int16_t_cat}
    void str_int16_t_cat(char *str, int16_t num) {
        char numstr[STR_INT16_T_BUFLEN];
        sprintf(numstr, "%d", num);
        strcat(str, numstr);
    }
{/if}

{#if headerFlags.gc_iterator}
    int16_t _gc_i;
{/if}

{userStructs => struct {name} {\n    {properties {    }=> {this};\n}};\n}

{variables => {this};\n}

{functions => {this}\n}

int main(void) {
    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}

    {statements {    }=> {this}}

    {destructors}
    return 0;
}`
)
export class CProgram implements IScope {
    public parent: IScope = null;
    public root = this;
    public func = this;
    public variables: CVariable[] = [];
    public statements: any[] = [];
    public functions: CFunction[] = [];
    public gcVarNames: string[];
    public destructors: CVariableDestructors;
    public userStructs: { name: string, properties: CVariable[] }[];
    public headerFlags = new HeaderFlags();
    public typeHelper: TypeHelper;
    public memoryManager: MemoryManager;
    public typeChecker: ts.TypeChecker;
    constructor(tsProgram: ts.Program) {

        this.typeChecker = tsProgram.getTypeChecker();
        this.typeHelper = new TypeHelper(this.typeChecker);
        this.memoryManager = new MemoryManager(this.typeChecker, this.typeHelper);

        let structs = this.typeHelper.figureOutVariablesAndTypes(tsProgram.getSourceFiles());
        this.userStructs = structs.map(s => {
            return {
                name: s.name,
                properties: s.properties.map(p => new CVariable(this, p.name, p.type, { removeStorageSpecifier: true }))
            };
        });
        this.memoryManager.preprocessVariables();
        for (let source of tsProgram.getSourceFiles())
            this.memoryManager.preprocessTemporaryVariables(source);

        this.gcVarNames = this.memoryManager.getGCVariablesForScope(null);
        for (let gcVarName of this.gcVarNames) {
            let pointerType = new ArrayType("void *", 0, true);
            if (gcVarName.indexOf("arrays") == -1)
                this.variables.push(new CVariable(this, gcVarName, pointerType));
            else
                this.variables.push(new CVariable(this, gcVarName, new ArrayType(pointerType, 0, true)));
        }

        for (let source of tsProgram.getSourceFiles()) {
            for (let s of source.statements) {
                if (s.kind == ts.SyntaxKind.FunctionDeclaration)
                    this.functions.push(new CFunction(this, <any>s));
                else
                    this.statements.push(CodeTemplateFactory.createForNode(this, s));
            }
        }

        this.destructors = new CVariableDestructors(this, null);
    }
}
