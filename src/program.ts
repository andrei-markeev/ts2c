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

import './standard/array/forEach';
import './standard/array/push';
import './standard/array/pop';
import './standard/array/unshift';
import './standard/array/shift';
import './standard/array/splice';
import './standard/array/slice';
import './standard/array/concat';
import './standard/array/join';
import './standard/array/indexOf';
import './standard/array/lastIndexOf';
import './standard/array/sort';
import './standard/array/reverse';

import './standard/string/search';
import './standard/string/charCodeAt';
import './standard/string/charAt';
import './standard/string/concat';
import './standard/string/substring';
import './standard/string/slice';
import './standard/string/toString';
import './standard/string/indexOf';
import './standard/string/lastIndexOf';
import './standard/string/match';


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
    array_int16_t_cmp: boolean = false;
    array_str_cmp: boolean = false;
    gc_iterator: boolean = false;
    gc_iterator2: boolean = false;
    dict: boolean = false;
    str_int16_t_cmp: boolean = false;
    str_int16_t_cat: boolean = false;
    str_pos: boolean = false;
    str_rpos: boolean = false;
    str_len: boolean = false;
    str_char_code_at: boolean = false;
    str_substring: boolean = false;
    str_slice: boolean = false;
    atoi: boolean = false;
    parseInt: boolean = false;
    regex: boolean = false;
    regex_match: boolean = false;
}


@CodeTemplate(`
{#if headerFlags.strings || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat
    || headerFlags.str_pos || headerFlags.str_rpos || headerFlags.array_str_cmp
    || headerFlags.str_substring
    || headerFlags.array_insert || headerFlags.array_remove || headerFlags.dict}
    #include <string.h>
{/if}
{#if headerFlags.malloc || headerFlags.atoi || headerFlags.array || headerFlags.str_substring 
    || headerFlags.str_slice}
    #include <stdlib.h>
{/if}
{#if headerFlags.malloc || headerFlags.array || headerFlags.str_substring || headerFlags.str_slice}
    #include <assert.h>
{/if}
{#if headerFlags.printf || headerFlags.parseInt}
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
     headerFlags.str_int16_t_cmp || headerFlags.str_pos || headerFlags.str_len ||
     headerFlags.str_char_code_at || headerFlags.str_substring || headerFlags.str_slice ||
     headerFlags.regex }
    typedef int int16_t;
{/if}
{#if headerFlags.regex}
    struct regex_indices_struct_t {
        int16_t index;
        int16_t end;
    };
    struct regex_match_struct_t {
        int16_t index;
        int16_t end;
        struct regex_indices_struct_t *matches;
        int16_t matches_count;
    };
    typedef struct regex_match_struct_t regex_func_t(const char*, int16_t);
    struct regex_struct_t {
        const char * str;
        regex_func_t * func;
    };
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
        array->data = malloc((init_capacity) * sizeof(*array->data)); \\
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
{#if headerFlags.str_len || headerFlags.str_substring || headerFlags.str_slice}
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
{#if headerFlags.str_char_code_at}
    int16_t str_char_code_at(const char * str, int16_t pos) {
        int16_t i, res = 0;
        while (*str) {
            i = 1;
            if ((*str & 0xE0) == 0xC0) i=2;
            else if ((*str & 0xF0) == 0xE0) i=3;
            else if ((*str & 0xF8) == 0xF0) i=4;
            if (pos == 0) {
                res += (unsigned char)*str++;
                if (i > 1) {
                    res <<= 6; res -= 0x3080;
                    res += (unsigned char)*str++;
                }
                return res;
            }
            str += i;
            pos -= i == 4 ? 2 : 1;
        }
        return -1;
    }
{/if}
{#if headerFlags.str_substring || headerFlags.str_slice}
    const char * str_substring(const char * str, int16_t start, int16_t end) {
        int16_t i, tmp, pos, len = str_len(str), byte_start = -1;
        char *p, *buf;
        start = start < 0 ? 0 : (start > len ? len : start);
        end = end < 0 ? 0 : (end > len ? len : end);
        if (end < start) {
            tmp = start;
            start = end;
            end = tmp;
        }
        i = 0;
        pos = 0;
        p = (char *)str;
        while (*p) {
            if (start == pos)
                byte_start = p - str;
            if (end == pos)
                break;
            i = 1;
            if ((*p & 0xE0) == 0xC0) i=2;
            else if ((*p & 0xF0) == 0xE0) i=3;
            else if ((*p & 0xF8) == 0xF0) i=4;
            p += i;
            pos += i == 4 ? 2 : 1;
        }
        len = byte_start == -1 ? 0 : p - str - byte_start;
        buf = malloc(len + 1);
        assert(buf != NULL);
        memcpy(buf, str + byte_start, len);
        buf[len] = '\\0';
        return buf;
    }
{/if}
{#if headerFlags.str_slice}
    const char * str_slice(const char * str, int16_t start, int16_t end) {
        int16_t len = str_len(str);
        start = start < 0 ? len + start : start;
        end = end < 0 ? len + end : end;
        if (end - start < 0)
            end = start;
        return str_substring(str, start, end);
    }
{/if}
{#if headerFlags.str_int16_t_cat}
    void str_int16_t_cat(char *str, int16_t num) {
        char numstr[STR_INT16_T_BUFLEN];
        sprintf(numstr, "%d", num);
        strcat(str, numstr);
    }
{/if}

{#if headerFlags.array_int16_t_cmp}
    int array_int16_t_cmp(const void* a, const void* b) {
        return ( *(int16_t*)a - *(int16_t*)b );
    }
{/if}
{#if headerFlags.array_str_cmp}
    int array_str_cmp(const void* a, const void* b) { 
        return strcmp(*(const char **)a, *(const char **)b);
    }
{/if}

{#if headerFlags.parseInt}
    int16_t parseInt(const char * str) {
        int r;
        sscanf(str, "%d", &r);
        return (int16_t) r;
    }
{/if}

{userStructs => struct {name} {\n    {properties {    }=> {this};\n}};\n}

{#if headerFlags.regex}
    void regex_clear_matches(struct regex_match_struct_t *match_info, int16_t groupN) {
        int16_t i;
        for (i = 0; i < groupN; i++) {
            match_info->matches[i].index = -1;
            match_info->matches[i].end = -1;
        }
    }
{/if}

{#if headerFlags.regex_match}
    struct array_string_t *regex_match(struct regex_struct_t regex, const char * s) {
        struct regex_match_struct_t match_info;
        struct array_string_t *match_array = NULL;
        int16_t i;

        match_info = regex.func(s, TRUE);
        if (match_info.index != -1) {
            ARRAY_CREATE(match_array, match_info.matches_count + 1, match_info.matches_count + 1);
            match_array->data[0] = str_substring(s, match_info.index, match_info.end);
            for (i = 0;i < match_info.matches_count; i++) {
                if (match_info.matches[i].index != -1 && match_info.matches[i].end != -1)
                    match_array->data[i + 1] = str_substring(s, match_info.matches[i].index, match_info.matches[i].end);
                else
                    match_array->data[i + 1] = str_substring(s, 0, 0);
            }
        }
        if (match_info.matches_count)
            free(match_info.matches);

        return match_array;
    }
{/if}

{#if headerFlags.gc_iterator}
    int16_t gc_i;
{/if}
{#if headerFlags.gc_iterator2}
    int16_t gc_j;
{/if}

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
    public functions: any[] = [];
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

        this.typeHelper.figureOutVariablesAndTypes(tsProgram.getSourceFiles());

        this.memoryManager.preprocessVariables();
        for (let source of tsProgram.getSourceFiles())
            this.memoryManager.preprocessTemporaryVariables(source);

        this.gcVarNames = this.memoryManager.getGCVariablesForScope(null);
        for (let gcVarName of this.gcVarNames) {
            let gcType = "ARRAY(void *)";
            if (gcVarName.indexOf("_arrays") > -1) gcType = "ARRAY(ARRAY(void *))";
            if (gcVarName.indexOf("_arrays_c") > -1) gcType = "ARRAY(ARRAY(ARRAY(void *)))";
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

        let [structs, functionPrototypes] = this.typeHelper.getStructsAndFunctionPrototypes();

        this.userStructs = structs.map(s => {
            return {
                name: s.name,
                properties: s.properties.map(p => new CVariable(this, p.name, p.type, { removeStorageSpecifier: true }))
            };
        });
        this.functionPrototypes = functionPrototypes.map(fp => new CFunctionPrototype(this, fp));

        this.destructors = new CVariableDestructors(this, null);
    }
}
