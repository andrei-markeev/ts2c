import * as ts from 'typescript'
import {MemoryManager} from './memory';
import {TypeHelper, ArrayType} from './types';
import {CodeTemplate} from './template';
import {StatementProcessor} from './nodes/statements';
import {CFunction} from './nodes/function';
import {CVariable, CVariableDestructors} from './nodes/variable';

export interface IScope {
    parent: IScope;
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
}


@CodeTemplate(`
{#if headerFlags.strings}
    #include <string.h>
{/if}
{#if headerFlags.malloc}
    #include <stdlib.h>
    #include <assert.h>
{/if}
{#if headerFlags.printf}
    #include <stdio.h>
{/if}

{#if headerFlags.bool}
    #define TRUE 1
    #define FALSE 0
{/if}
{#if headerFlags.bool || headerFlags.js_var}
    typedef unsigned char uint8_t;
{/if}
{#if headerFlags.int16_t || headerFlags.js_var || headerFlags.array}
    typedef int int16_t;
{/if}

{#if headerFlags.js_var}
    enum js_var_type {JS_VAR_BOOL, JS_VAR_INT, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_STRUCT, JS_VAR_DICT};
	struct js_var {
	    enum js_var_type type;
	    uint8_t bool;
	    int16_t number;
	    char *string;
	    void *obj;
	};
{/if}

{#if headerFlags.array}
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
{/if}
{#if headerFlags.array_pop}
	#define ARRAY_POP(a) (a.size != 0 ? a.data[--a.size] : 0)
{/if}

{#if headerFlags.dict}
    #define DICT_GET(dict, prop) dict_not_supported
    #define DICT_SET(dict, prop, value) dict_not_supported
{/if}

{#if headerFlags.gc_iterator}
    int16_t _gc_i;
{/if}

{userStructs => struct {name} {
    {properties => {this};}
};\n}

{variables => {this};\n}

{functions => {this}\n}

int main() {
    {#if gcVarName}
        ARRAY_CREATE({gcVarName}, 2, 0);
    {/if}

    {statements {    }=> {this}}

    {destructors}
    return 0;
}`
)
export class CProgram implements IScope {
    public parent: IScope = null;
    public root = this;
    public variables: CVariable[] = [];
    public statements: any[] = [];
    public functions: CFunction[] = [];
    public gcVarName: string;
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
                properties: s.properties.map(p => new CVariable(this, p.name, p.type, true))
            };
        });
        this.memoryManager.preprocess();

        this.gcVarName = this.memoryManager.getGCVariableForScope(null);
        if (this.gcVarName)
            this.variables.push(new CVariable(this, this.gcVarName, new ArrayType("ARRAY(void *)", "void *", 0, true)));

        tsProgram.getSourceFiles().forEach(source =>
            source.statements.forEach(s => StatementProcessor.process(s, this))
        );

        this.destructors = new CVariableDestructors(this, null);
    }
}
