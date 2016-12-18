import * as ts from 'typescript'
import {MemoryManager} from './memory';
import {TypeHelper, ArrayType} from './types';
import {CodeTemplate, CodeTemplateFactory} from './template';
import {CFunction, CFunctionPrototype} from './nodes/function';
import {CVariable, CVariableDestructors} from './nodes/variable';

// these imports are here only because it is necessary to run decorators
import './nodes/statements';
import './nodes/expressions';
import './nodes/call';
import './nodes/literals';

import './standard/array/push';
import './standard/array/pop';
import './standard/array/unshift';
import './standard/array/shift';
import './standard/array/splice';
import './standard/array/slice';
import './standard/array/indexOf';
import './standard/array/lastIndexOf';


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
    array_insert: boolean = false;
    array_remove: boolean = false;
    gc_iterator: boolean = false;
    dict: boolean = false;
    str_int16_t_cmp: boolean = false;
    str_int16_t_cat: boolean = false;
    str_pos: boolean = false;
    str_rpos: boolean = false;
    str_len: boolean = false;
    atoi: boolean = false;
}


@CodeTemplate(`
{#if headerFlags.strings || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat
    || headerFlags.str_pos || headerFlags.str_rpos
    || headerFlags.array_insert || headerFlags.array_remove || headerFlags.dict}
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

{#if headerFlags.gc_iterator || headerFlags.dict}
    #define ARRAY(T) struct {\\
        int16_t size;\\
        int16_t capacity;\\
        T *data;\\
    } *
{/if}

{#if headerFlags.array || headerFlags.dict}
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
{#if headerFlags.array_insert || headerFlags.dict}
    #define ARRAY_INSERT(array, pos, item) {\\
        ARRAY_PUSH(array, item); \\
        if (pos < array->size - 1) {\\
            memmove(&(array->data[(pos) + 1]), &(array->data[pos]), (array->size - (pos) - 1) * sizeof(*array->data)); \\
            array->data[pos] = item; \\
        } \\
    }
{/if}
{#if headerFlags.array_remove}
    #define ARRAY_REMOVE(array, pos, num) {\\
        memmove(&(array->data[pos]), &(array->data[(pos) + num]), (array->size - (pos) - num) * sizeof(*array->data)); \\
        array->size -= num; \\
    }
{/if}

{#if headerFlags.dict}
    #define DICT(T) struct { \\
        ARRAY(const char *) index; \\
        ARRAY(T) values; \\
    } *
    #define DICT_CREATE(dict, init_capacity) { \\
        dict = malloc(sizeof(*dict)); \\
        ARRAY_CREATE(dict->index, init_capacity, 0); \\
        ARRAY_CREATE(dict->values, init_capacity, 0); \\
    }

    int16_t dict_find_pos(const char ** keys, int16_t keys_size, const char * key) {
        int16_t low = 0;
        int16_t high = keys_size - 1;

        if (keys_size == 0 || key == NULL)
            return -1;

        while (low <= high)
        {
            int mid = (low + high) / 2;
            int res = strcmp(keys[mid], key);

            if (res == 0)
                return mid;
            else if (res < 0)
                low = mid + 1;
            else
                high = mid - 1;
        }

        return -1 - low;
    }

    int16_t tmp_dict_pos;
    #define DICT_GET(dict, prop) ((tmp_dict_pos = dict_find_pos(dict->index->data, dict->index->size, prop)) < 0 ? 0 : dict->values->data[tmp_dict_pos])
    #define DICT_SET(dict, prop, value) { \\
        tmp_dict_pos = dict_find_pos(dict->index->data, dict->index->size, prop); \\
        if (tmp_dict_pos < 0) { \\
            tmp_dict_pos = -tmp_dict_pos - 1; \\
            ARRAY_INSERT(dict->index, tmp_dict_pos, prop); \\
            ARRAY_INSERT(dict->values, tmp_dict_pos, value); \\
        } else \\
            dict->values->data[tmp_dict_pos] = value; \\
    }

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
{#if headerFlags.str_rpos}
    int16_t str_rpos(const char * str, const char *search) {
        int16_t i;
        const char * found = strstr(str, search);
        int16_t pos = 0;
        const char * end = str + (strlen(str) - strlen(search));
        if (found == 0)
            return -1;
        found = 0;
        while (end > str && found == 0)
            found = strstr(end--, search);
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
    int16_t gc_i;
{/if}

{userStructs => struct {name} {\n    {properties {    }=> {this};\n}};\n}

{variables => {this};\n}

{functionPrototypes => {this}\n}

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
    public functionPrototypes: CFunctionPrototype[] = [];
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

        let [structs, functionPrototypes] = this.typeHelper.figureOutVariablesAndTypes(tsProgram.getSourceFiles());

        this.userStructs = structs.map(s => {
            return {
                name: s.name,
                properties: s.properties.map(p => new CVariable(this, p.name, p.type, { removeStorageSpecifier: true }))
            };
        });
        this.functionPrototypes = functionPrototypes.map(fp => new CFunctionPrototype(this, fp));

        this.memoryManager.preprocessVariables();
        for (let source of tsProgram.getSourceFiles())
            this.memoryManager.preprocessTemporaryVariables(source);

        this.gcVarNames = this.memoryManager.getGCVariablesForScope(null);
        for (let gcVarName of this.gcVarNames) {
            let gcType = gcVarName.indexOf("arrays") == -1 ? "ARRAY(void *)" : "ARRAY(ARRAY(void *))";
            this.variables.push(new CVariable(this, gcVarName, gcType));
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
