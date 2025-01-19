import * as kataw from '@andrei-markeev/kataw';
import { CFunctionPrototype, CFunction } from './nodes/function';
import { CRegexSearchFunction } from './nodes/regexfunc';
import { TypeHelper } from './types/typehelper';
import { SymbolsHelper } from './symbols';
import { MemoryManager } from './memory';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from './template';
import { CVariable, CVariableDestructors } from './nodes/variable';
import { StandardCallHelper } from './standard';

// these imports are here only because it is necessary to run decorators
import './nodes/statements';
import './nodes/expressions';
import './nodes/call';
import './nodes/literals';
import './nodes/function';

import './standard/global/parseInt';
import './standard/global/isNaN';

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

import './standard/number/number';

import './standard/console/log';
import { collectSymbolsAndTransformAst } from './ast';

export interface IScope {
    parent: IScope;
    func: IScope;
    root: CProgram;
    variables: CVariable[];
    statements: ( CTemplateBase | string )[];
}

class HeaderFlags {
    strings: boolean = false;
    printf: boolean = false;
    malloc: boolean = false;
    bool: boolean = false;
    int16_t: boolean = false;
    uint16_t: boolean = false;
    js_var: boolean = false;
    js_var_array: boolean = false;
    js_var_dict: boolean = false;
    js_var_from: boolean = false;
    js_var_from_str: boolean = false;
    js_var_from_int16_t: boolean = false;
    js_var_from_uint8_t: boolean = false;
    js_var_to_str: boolean = false;
    js_var_to_number: boolean = false;
    js_var_to_undefined: boolean = false;
    js_var_to_bool: boolean = false;
    js_var_typeof: boolean = false;
    js_var_eq: boolean = false;
    js_var_lessthan: boolean = false;
    js_var_plus: boolean = false;
    js_var_compute: boolean = false;
    js_var_get: boolean = false;
    js_var_isnan: boolean = false;
    js_var_dict_inc: boolean = false;
    js_var_inc: boolean = false;
    array: boolean = false;
    array_pop: boolean = false;
    array_insert: boolean = false;
    array_remove: boolean = false;
    array_string_t: boolean = false;
    array_int16_t_cmp: boolean = false;
    array_str_cmp: boolean = false;
    array_pointer_t: boolean = false;
    gc_main: boolean = false;
    gc_iterator: boolean = false;
    gc_iterator2: boolean = false;
    gc_array: boolean = false;
    dict: boolean = false;
    dict_find_pos: boolean = false;
    str_int16_t_buflen: boolean = false;
    str_int16_t_cmp: boolean = false;
    str_int16_t_cat: boolean = false;
    str_pos: boolean = false;
    str_rpos: boolean = false;
    str_len: boolean = false;
    str_char_code_at: boolean = false;
    str_substring: boolean = false;
    str_slice: boolean = false;
    str_to_int16_t: boolean = false;
    parse_int16_t: boolean = false;
    regex: boolean = false;
    regex_match: boolean = false;
    try_catch: boolean = false;
}

export const reservedCSymbolNames = [
    "main",
    "TRUE", "FALSE", "uint8_t", "int16_t",
    "typedef", "struct", "unsigned", "signed", "int", "double", "long", "short", "char", "float",
    "sizeof", "goto", "volatile", "static", "extern", "auto", "register", "union",
    "printf", "assert", "malloc", "realloc", "memmove", "sprintf", "strcmp", "strstr",
    "isdigit", "isspace", 'CHAR_BIT',
    "regex_indices_struct_t", "regex_match_struct_t", "regex_func_t",
    "ARRAY", "ARRAY_CREATE", "ARRAY_PUSH", "ARRAY_INSERT", "ARRAY_REMOVE", "ARRAY_POP",
    "DICT", "DICT_CREATE", "DICT_SET", "DICT_GET", "dict_find_pos", "tmp_dict_pos", "tmp_dict_pos2",
    "STR_INT16_T_BUFLEN", "str_int16_t_cmp", "str_pos", "str_rpos", "str_len",
    "str_char_code_at", "str_substring", "str_slice", "str_int16_t_cat",
    "array_int16_t_cmp", "array_str_cmp", "parse_int16_t",
    "js_var_type", "js_var", "array_js_var_t", "dict_js_var_t",
    "js_var_from", "js_var_from_int16_t", "js_var_from_uint8_t", "js_var_from_str", "js_var_from_dict",
    "str_to_int16_t", "js_var_to_str", "js_var_to_number", "js_var_to_bool", "js_var_to_undefined",
    "js_var_typeof", "js_var_dict_inc", "js_var_get", "js_var_eq", "js_var_op", "js_var_compute",
    "regex_clear_matches", "regex_match",
    "gc_main", "gc_i", "gc_j"
];

@CodeTemplate(`
{#if headerFlags.strings || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat
    || headerFlags.str_pos || headerFlags.str_rpos || headerFlags.array_str_cmp
    || headerFlags.str_substring || headerFlags.dict_find_pos
    || headerFlags.array_insert || headerFlags.array_remove || headerFlags.dict || headerFlags.js_var_dict
    || headerFlags.js_var_from_str || headerFlags.js_var_to_str || headerFlags.js_var_eq || headerFlags.js_var_plus
    || headerFlags.js_var_lessthan || headerFlags.dict_find_pos}
    #include <string.h>
{/if}
{#if headerFlags.malloc || headerFlags.array || headerFlags.dict || headerFlags.str_substring || headerFlags.str_slice
    || headerFlags.str_to_int16_t || headerFlags.js_var_to_number || headerFlags.js_var_plus
    || headerFlags.js_var_from_str || headerFlags.js_var_get || headerFlags.try_catch
    || headerFlags.js_var_dict_inc}
    #include <stdlib.h>
{/if}
{#if headerFlags.malloc || headerFlags.array || headerFlags.dict || headerFlags.str_substring || headerFlags.str_slice
    || headerFlags.str_to_int16_t || headerFlags.js_var_to_number || headerFlags.js_var_plus 
    || headerFlags.js_var_from_str || headerFlags.js_var_get || headerFlags.try_catch
    || headerFlags.js_var_dict_inc}
    #include <assert.h>
{/if}
{#if headerFlags.printf || headerFlags.parse_int16_t || headerFlags.str_int16_t_cat}
    #include <stdio.h>
{/if}
{#if headerFlags.str_int16_t_buflen || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat || headerFlags.js_var_to_str || headerFlags.js_var_plus || headerFlags.js_var_lessthan}
    #include <limits.h>
{/if}
{#if headerFlags.str_to_int16_t || headerFlags.js_var_get || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_lessthan || headerFlags.js_var_to_number}
    #include <ctype.h>
{/if}
{#if headerFlags.try_catch || headerFlags.js_var_get}
    #include <setjmp.h>
{/if}

{#if includes.length}
    {includes => #include <{this}>\n}
{/if}

{#if headerFlags.bool || headerFlags.js_var_to_bool || headerFlags.js_var_eq || headerFlags.dict_remove || headerFlags.js_var_dict_inc }
    #define TRUE 1
    #define FALSE 0
{/if}
{#if headerFlags.bool || headerFlags.js_var || headerFlags.str_to_int16_t || headerFlags.js_var_isnan || headerFlags.js_var_dict_inc}
    typedef unsigned char uint8_t;
{/if}
{#if headerFlags.int16_t || headerFlags.js_var || headerFlags.array ||
     headerFlags.str_int16_t_cmp || headerFlags.str_pos || headerFlags.str_len ||
     headerFlags.str_char_code_at || headerFlags.str_substring || headerFlags.str_slice ||
     headerFlags.regex || headerFlags.str_to_int16_t || headerFlags.array_string_t ||
     headerFlags.try_catch || headerFlags.parse_int16_t || headerFlags.js_var_from  ||
     headerFlags.str_int16_t_cat || headerFlags.js_var_isnan}
    typedef short int16_t;
{/if}
{#if headerFlags.uint16_t || headerFlags.js_var_compute}
    typedef unsigned short uint16_t;
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

{#if headerFlags.gc_array || headerFlags.dict || headerFlags.js_var_get}
    #define ARRAY(T) struct {\\
        int16_t size;\\
        int16_t capacity;\\
        T *data;\\
    } *
{/if}
{#if headerFlags.array || headerFlags.dict || headerFlags.js_var_dict || headerFlags.js_var_plus || headerFlags.try_catch || headerFlags.js_var_get}
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
{#if headerFlags.array_insert || headerFlags.dict || headerFlags.js_var_dict}
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
{/if}

{#if headerFlags.dict || headerFlags.js_var_dict || headerFlags.dict_find_pos}
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
{/if}

{#if headerFlags.dict || headerFlags.js_var_dict}
    #define DICT_CREATE(dict, init_capacity) { \\
        dict = malloc(sizeof(*dict)); \\
        ARRAY_CREATE(dict->index, init_capacity, 0); \\
        ARRAY_CREATE(dict->values, init_capacity, 0); \\
    }
    
    int16_t tmp_dict_pos;
    #define DICT_GET(dict, prop, default) ((tmp_dict_pos = dict_find_pos(dict->index->data, dict->index->size, prop)) < 0 ? default : dict->values->data[tmp_dict_pos])

    int16_t tmp_dict_pos2;
    #define DICT_SET(dict, prop, value) { \\
        tmp_dict_pos2 = dict_find_pos(dict->index->data, dict->index->size, prop); \\
        if (tmp_dict_pos2 < 0) { \\
            tmp_dict_pos2 = -tmp_dict_pos2 - 1; \\
            ARRAY_INSERT(dict->index, tmp_dict_pos2, prop); \\
            ARRAY_INSERT(dict->values, tmp_dict_pos2, value); \\
        } else \\
            dict->values->data[tmp_dict_pos2] = value; \\
    }
{/if}

{#if headerFlags.str_int16_t_buflen || headerFlags.str_int16_t_cmp || headerFlags.str_int16_t_cat || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_to_str || headerFlags.js_var_lessthan}
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

{#if headerFlags.parse_int16_t}
    int16_t parse_int16_t(const char * str) {
        int r;
        sscanf(str, "%d", &r);
        return (int16_t) r;
    }
{/if}

{#if headerFlags.js_var || headerFlags.str_to_int16_t || headerFlags.js_var_from || headerFlags.js_var_isnan || headerFlags.js_var_dict_inc}
    enum js_var_type {JS_VAR_NULL, JS_VAR_UNDEFINED, JS_VAR_NAN, JS_VAR_BOOL, JS_VAR_INT16, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_DICT};
    struct js_var {
        enum js_var_type type;
        int16_t number;
        void *data;
    };
{/if}

{#if headerFlags.js_var_array || headerFlags.js_var_dict || headerFlags.js_var_dict_inc || headerFlags.js_var_to_str || headerFlags.js_var_plus || headerFlags.js_var_lessthan || headerFlags.js_var_to_number}
    struct array_js_var_t {
        int16_t size;
        int16_t capacity;
        struct js_var *data;
    };
{/if}

{#if headerFlags.array_string_t || headerFlags.js_var_dict || headerFlags.js_var_dict_inc || headerFlags.js_var_get || headerFlags.try_catch}
    struct array_string_t {
        int16_t size;
        int16_t capacity;
        const char ** data;
    };
{/if}

{#if headerFlags.array_pointer_t || headerFlags.gc_main || headerFlags.js_var_plus}
    struct array_pointer_t {
        int16_t size;
        int16_t capacity;
        void ** data;
    };
{/if}

{#if headerFlags.js_var_dict || headerFlags.js_var_dict_inc}
    struct dict_js_var_t {
        struct array_string_t *index;
        struct array_js_var_t *values;
    };
{/if}

{#if headerFlags.js_var_from || headerFlags.js_var_get || headerFlags.js_var_dict_inc}
    struct js_var js_var_from(enum js_var_type type) {
        struct js_var v;
        v.type = type;
        v.data = NULL;
        return v;
    }
{/if}

{#if headerFlags.js_var_from_uint8_t}
    struct js_var js_var_from_uint8_t(uint8_t b) {
        struct js_var v;
        v.type = JS_VAR_BOOL;
        v.number = b;
        v.data = NULL;
        return v;
    }
{/if}

{#if headerFlags.js_var_from_int16_t || headerFlags.js_var_dict_inc}
    struct js_var js_var_from_int16_t(int16_t n) {
        struct js_var v;
        v.type = JS_VAR_INT16;
        v.number = n;
        v.data = NULL;
        return v;
    }
{/if}

{#if headerFlags.js_var_from_str}
    struct js_var js_var_from_str(const char *s) {
        struct js_var v;
        v.type = JS_VAR_STRING;
        v.data = (void *)s;
        return v;
    }
{/if}

{#if headerFlags.js_var_array}
    struct js_var js_var_from_array(struct array_js_var_t *arr) {
        struct js_var v;
        v.type = JS_VAR_ARRAY;
        v.data = (void *)arr;
        return v;
    }
{/if}

{#if headerFlags.js_var_dict}
    struct js_var js_var_from_dict(struct dict_js_var_t *dict) {
        struct js_var v;
        v.type = JS_VAR_DICT;
        v.data = (void *)dict;
        return v;
    }
{/if}

{#if headerFlags.str_to_int16_t || headerFlags.js_var_to_number || headerFlags.js_var_get || headerFlags.js_var_eq || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_lessthan || headerFlags.js_var_dict_inc}
    struct js_var str_to_int16_t(const char * str) {
        struct js_var v;
        const char *p = str;
        int r;

        v.data = NULL;

        while (*p && isspace(*p))
            p++;

        if (*p == 0)
            str = "0";

        if (*p == '-' && *(p+1))
            p++;

        while (*p) {
            if (!isdigit(*p)) {
                v.type = JS_VAR_NAN;
                return v;
            }
            p++;
        }

        sscanf(str, "%d", &r);
        v.type = JS_VAR_INT16;
        v.number = (int16_t)r;
        return v;
    }
{/if}

{#if headerFlags.js_var_to_str || headerFlags.js_var_plus || headerFlags.js_var_lessthan}
    const char * js_var_to_str(struct js_var v, uint8_t *need_dispose)
    {
        char *buf;
        int16_t i;
        *need_dispose = 0;

        if (v.type == JS_VAR_INT16) {
            buf = malloc(STR_INT16_T_BUFLEN);
            assert(buf != NULL);
            *need_dispose = 1;
            sprintf(buf, "%d", v.number);
            return buf;
        } else if (v.type == JS_VAR_BOOL)
            return v.number ? "true" : "false";
        else if (v.type == JS_VAR_STRING)
            return (const char *)v.data;
        else if (v.type == JS_VAR_ARRAY) {
            struct array_js_var_t * arr = (struct array_js_var_t *)v.data;
            uint8_t dispose_elem = 0;
            buf = malloc(1);
            assert(buf != NULL);
            *need_dispose = 1;
            buf[0] = 0;
            for (i = 0; i < arr->size; i++) {
                const char * elem = js_var_to_str(arr->data[i], &dispose_elem);
                buf = realloc(buf, strlen(buf) + strlen(elem) + 1 + (i != 0 ? 1 : 0));
                assert(buf != NULL);
                if (i != 0)
                    strcat(buf, ",");
                strcat(buf, elem);
                if (dispose_elem)
                    free((void *)elem);
            }
            return buf;
        }
        else if (v.type == JS_VAR_DICT)
            return "[object Object]";
        else if (v.type == JS_VAR_NAN)
            return "NaN";
        else if (v.type == JS_VAR_NULL)
            return "null";
        else if (v.type == JS_VAR_UNDEFINED)
            return "undefined";

        return NULL;
    }
{/if}

{#if headerFlags.js_var_to_number || headerFlags.js_var_get || headerFlags.js_var_eq || headerFlags.js_var_plus || headerFlags.js_var_compute || headerFlags.js_var_lessthan || headerFlags.js_var_dict_inc}

    struct js_var js_var_to_number(struct js_var v)
    {
        struct js_var result;
        result.type = JS_VAR_INT16;
        result.number = 0;

        if (v.type == JS_VAR_INT16)
            result.number = v.number;
        else if (v.type == JS_VAR_BOOL)
            result.number = v.number;
        else if (v.type == JS_VAR_STRING)
            return str_to_int16_t((const char *)v.data);
        else if (v.type == JS_VAR_ARRAY) {
            struct array_js_var_t * arr = (struct array_js_var_t *)v.data;
            if (arr->size == 0)
                result.number = 0;
            else if (arr->size > 1)
                result.type = JS_VAR_NAN;
            else
                result = js_var_to_number(arr->data[0]);
        } else if (v.type != JS_VAR_NULL)
            result.type = JS_VAR_NAN;

        return result;
    }

{/if}

{#if headerFlags.js_var_to_bool}

    uint8_t js_var_to_bool(struct js_var v)
    {
        if (v.type == JS_VAR_INT16)
            return v.number != 0;
        else if (v.type == JS_VAR_BOOL)
            return v.number;
        else if (v.type == JS_VAR_STRING)
            return *((const char *)v.data) != 0;
        else if (v.type == JS_VAR_NULL || v.type == JS_VAR_UNDEFINED || v.type == JS_VAR_NAN)
            return FALSE;
        else
            return TRUE;
    }

{/if}

{#if headerFlags.js_var_to_undefined}
    struct js_var js_var_to_undefined(void *value) {
        struct js_var v;
        v.type = JS_VAR_UNDEFINED;
        v.data = NULL;
        return v;
    }
{/if}

{#if headerFlags.js_var_typeof}

    const char * js_var_typeof(struct js_var v)
    {
        if (v.type == JS_VAR_INT16 || v.type == JS_VAR_NAN)
            return "number";
        else if (v.type == JS_VAR_BOOL)
            return "boolean";
        else if (v.type == JS_VAR_STRING)
            return "string";
        else if (v.type == JS_VAR_UNDEFINED)
            return "undefined";
        else
            return "object";
    }

{/if}

{#if headerFlags.try_catch || headerFlags.js_var_get}
    int err_i = 0;
    jmp_buf err_jmp[10];
    #define TRY { int err_val = setjmp(err_jmp[err_i++]); if (!err_val) {
    #define CATCH } else {
    #define THROW(x) longjmp(err_jmp[--err_i], x)
    struct array_string_t * err_defs;
    #define END_TRY err_defs->size--; } }
{/if}

{#if headerFlags.js_var_dict_inc}
    struct js_var js_var_dict_inc(struct dict_js_var_t * dict, const char * key, int16_t by, uint8_t is_postfix) {
        struct js_var value;
        int16_t pos;

        pos = dict_find_pos(dict->index->data, dict->index->size, key);
        if (pos < 0) {
            pos = -pos - 1;
            ARRAY_INSERT(dict->index, pos, key);
            ARRAY_INSERT(dict->values, pos, js_var_from(JS_VAR_NAN));
            return js_var_from(JS_VAR_NAN);
        } else {
            value = js_var_to_number(dict->values->data[pos]);
            if (value.type == JS_VAR_NAN) {
                dict->values->data[pos] = value;
                return value;
            } else {
                value.number += by;
                dict->values->data[pos] = value;
                if (is_postfix)
                    value.number -= by;
                return value;
            }
        }
    }
{/if}

{#if headerFlags.js_var_inc}
    struct js_var js_var_inc(struct js_var * v, int16_t by) {
        struct js_var result;

        result = js_var_to_number(*v);
        if (result.type == JS_VAR_INT16) {
            (*v).type = JS_VAR_INT16;
            (*v).number = result.number + by;
            (*v).data = NULL;
        } else
            (*v).type = JS_VAR_NAN;
        return result;
    }
{/if}

{#if headerFlags.js_var_get}
    struct js_var js_var_get(struct js_var v, struct js_var arg) {
        struct js_var tmp;
        const char *key;
        uint8_t need_dispose = 0;

        if (v.type == JS_VAR_ARRAY) {
            tmp = js_var_to_number(arg);
            if (tmp.type == JS_VAR_NAN)
                return js_var_from(JS_VAR_UNDEFINED);
            else
                return ((struct array_js_var_t *)v.data)->data[tmp.number];
        } else if (v.type == JS_VAR_DICT) {
            key = js_var_to_str(arg, &need_dispose);
            tmp = DICT_GET(((struct dict_js_var_t *)v.data), key, js_var_from(JS_VAR_UNDEFINED));
            if (need_dispose)
                free((void *)key);
            return tmp;
        } else if (v.type == JS_VAR_NULL || v.type == JS_VAR_UNDEFINED) {
            ARRAY_PUSH(err_defs, "TypeError: Cannot read property of null or undefined.");
            THROW(err_defs->size);
        } else
            return js_var_from(JS_VAR_UNDEFINED);
    }
{/if}

{#if headerFlags.js_var_eq}
    uint8_t js_var_eq(struct js_var left, struct js_var right, uint8_t strict)
    {
        if (left.type == right.type) {
            if (left.type == JS_VAR_NULL || left.type == JS_VAR_UNDEFINED)
                return TRUE;
            else if (left.type == JS_VAR_NAN)
                return FALSE;
            else if (left.type == JS_VAR_INT16 || left.type == JS_VAR_BOOL)
                return left.number == right.number ? TRUE : FALSE;
            else if (left.type == JS_VAR_STRING)
                return !strcmp((const char *)left.data, (const char *)right.data) ? TRUE : FALSE;
            else
                return left.data == right.data;
        } else if (!strict) {
            if ((left.type == JS_VAR_NULL && right.type == JS_VAR_UNDEFINED) || (left.type == JS_VAR_UNDEFINED && right.type == JS_VAR_NULL))
                return TRUE;
            else if ((left.type == JS_VAR_INT16 && right.type == JS_VAR_STRING) || (left.type == JS_VAR_STRING && right.type == JS_VAR_INT16))
                return js_var_eq(js_var_to_number(left), js_var_to_number(right), strict);
            else if (left.type == JS_VAR_BOOL)
                return js_var_eq(js_var_to_number(left), right, strict);
            else if (right.type == JS_VAR_BOOL)
                return js_var_eq(left, js_var_to_number(right), strict);
            else
                return FALSE;
        } else
            return FALSE;
    }
{/if}

{#if headerFlags.js_var_lessthan}
    int16_t js_var_lessthan(struct js_var left, struct js_var right)
    {
        struct js_var left_to_number, right_to_number;
        const char *left_as_string, *right_as_string;
        uint8_t need_dispose_left, need_dispose_right;
        int16_t result;

        if ((left.type == JS_VAR_STRING || left.type == JS_VAR_ARRAY || left.type == JS_VAR_DICT)
            && (right.type == JS_VAR_STRING || right.type == JS_VAR_ARRAY || right.type == JS_VAR_DICT))
        {
            left_as_string = js_var_to_str(left, &need_dispose_left);
            right_as_string = js_var_to_str(right, &need_dispose_right);
            
            result = strcmp(left_as_string, right_as_string) < 0 ? 1 : -1;

            if (need_dispose_left)
                free((void *)left_as_string);
            if (need_dispose_right)
                free((void *)right_as_string);
            return result;
        } else {
            left_to_number = js_var_to_number(left);
            right_to_number = js_var_to_number(right);

            if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN)
                return 0;
            if (left_to_number.number == 0 && right_to_number.number == 0)
                return -1;
            return left_to_number.number < right_to_number.number ? 1 : -1;
        }
    }
{/if}

{#if headerFlags.js_var_plus}

    struct js_var js_var_plus(struct js_var left, struct js_var right, struct array_pointer_t *gc_main)
    {
        struct js_var result, left_to_number, right_to_number;
        const char *left_as_string, *right_as_string;
        uint8_t need_dispose_left, need_dispose_right;
        result.data = NULL;

        if (left.type == JS_VAR_STRING || right.type == JS_VAR_STRING 
            || left.type == JS_VAR_ARRAY || right.type == JS_VAR_ARRAY
            || left.type == JS_VAR_DICT || right.type == JS_VAR_DICT)
        {
            left_as_string = js_var_to_str(left, &need_dispose_left);
            right_as_string = js_var_to_str(right, &need_dispose_right);
            
            result.type = JS_VAR_STRING;
            result.data = malloc(strlen(left_as_string) + strlen(right_as_string) + 1);
            assert(result.data != NULL);
            ARRAY_PUSH(gc_main, result.data);

            strcpy(result.data, left_as_string);
            strcat(result.data, right_as_string);

            if (need_dispose_left)
                free((void *)left_as_string);
            if (need_dispose_right)
                free((void *)right_as_string);
            return result;
        }

        left_to_number = js_var_to_number(left);
        right_to_number = js_var_to_number(right);

        if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN) {
            result.type = JS_VAR_NAN;
            return result;
        }

        result.type = JS_VAR_INT16;
        result.number = left_to_number.number + right_to_number.number;
        return result;
    }

{/if}

{#if headerFlags.js_var_compute}

    enum js_var_op {JS_VAR_MINUS, JS_VAR_ASTERISK, JS_VAR_SLASH, JS_VAR_PERCENT, JS_VAR_SHL, JS_VAR_SHR, JS_VAR_USHR, JS_VAR_OR, JS_VAR_AND};
    struct js_var js_var_compute(struct js_var left, enum js_var_op op, struct js_var right)
    {
        struct js_var result, left_to_number, right_to_number;
        result.data = NULL;

        left_to_number = js_var_to_number(left);
        right_to_number = js_var_to_number(right);

        if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN) {
            if (op == JS_VAR_MINUS || op == JS_VAR_ASTERISK || op == JS_VAR_SLASH || op == JS_VAR_PERCENT) {
                result.type = JS_VAR_NAN;
                return result;
            }
        }
        
        result.type = JS_VAR_INT16;
        switch (op) {
            case JS_VAR_MINUS:
                result.number = left_to_number.number - right_to_number.number;
                break;
            case JS_VAR_ASTERISK:
                result.number = left_to_number.number * right_to_number.number;
                break;
            case JS_VAR_SLASH:
                result.number = left_to_number.number / right_to_number.number;
                break;
            case JS_VAR_PERCENT:
                result.number = left_to_number.number % right_to_number.number;
                break;
            case JS_VAR_SHL:
                result.number = left_to_number.number << right_to_number.number;
                break;
            case JS_VAR_SHR:
                result.number = left_to_number.number >> right_to_number.number;
                break;
            case JS_VAR_USHR:
                result.number = ((uint16_t)left_to_number.number) >> right_to_number.number;
                break;
            case JS_VAR_AND:
                result.number = left_to_number.number & right_to_number.number;
                break;
            case JS_VAR_OR:
                result.number = left_to_number.number | right_to_number.number;
                break;
        }
        return result;
    }

{/if}

{#if headerFlags.js_var_isnan}
    uint8_t js_var_isnan(struct js_var v) {
        return js_var_to_number(v).type == JS_VAR_NAN;
    }
{/if}

{userStructs => struct {name} {\n    {properties {    }=> {this};\n}\n};\n}

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

{#if headerFlags.gc_main || headerFlags.js_var_plus}
    static struct array_pointer_t *gc_main;
{/if}
{#if headerFlags.gc_iterator || headerFlags.js_var_plus}
    static int16_t gc_i;
{/if}
{#if headerFlags.gc_iterator2}
    static int16_t gc_j;
{/if}

{variables => {this};\n}

{functionPrototypes => {this}\n}

{functions => {this}\n}

int main(void) {
    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}
    {#if headerFlags.try_catch || headerFlags.js_var_get}
        ARRAY_CREATE(err_defs, 2, 0);
    {/if}

    {statements {    }=> {this}}
    {destructors}

    return 0;
}
`)
export class CProgram implements IScope {
    public parent: IScope = null;
    public root = this;
    public func = this;
    public includes: string[] = [];
    public variables: CVariable[] = [];
    public statements: (CTemplateBase | string)[] = [];
    public functions: (CFunction | CRegexSearchFunction)[] = [];
    public functionPrototypes: CFunctionPrototype[] = [];
    public gcVarNames: string[];
    public destructors: CVariableDestructors;
    public userStructs: { name: string, properties: CVariable[] }[];
    public headerFlags = new HeaderFlags();
    constructor(rootNode: kataw.RootNode, public symbolsHelper: SymbolsHelper, public typeHelper: TypeHelper, public standardCallHelper: StandardCallHelper, public memoryManager: MemoryManager) {
        this.gcVarNames = this.memoryManager.getGCVariablesForScope(null);
        for (let gcVarName of this.gcVarNames) {
            this.headerFlags.array = true;
            this.headerFlags.array_pointer_t = true;
            if (gcVarName == "gc_main") {
                this.headerFlags.gc_main = true;
                continue;
            }
            const simplePointerArray = "struct array_pointer_t *"
            let gcType = simplePointerArray;
            if (gcVarName.indexOf("_arrays") > -1) gcType = "ARRAY(struct array_pointer_t *)";
            if (gcVarName.indexOf("_arrays_c") > -1) gcType = "ARRAY(ARRAY(struct array_pointer_t *))";
            if (gcVarName.indexOf("_dicts") > -1) gcType = "ARRAY(DICT(void *))";
            if (gcType !== simplePointerArray)
                this.headerFlags.gc_array = true;
            this.variables.push(new CVariable(this, gcVarName, gcType));
        }

        for (let s of rootNode.statements)
            this.statements.push(CodeTemplateFactory.createForNode(this, s));

        let [structs] = this.symbolsHelper.getStructsAndFunctionPrototypes(this.typeHelper);
        this.headerFlags.array_pointer_t = this.headerFlags.array_pointer_t || structs.filter(s => s.name == "array_pointer_t").length > 0;
        this.headerFlags.array_string_t = this.headerFlags.array_string_t || structs.filter(s => s.name == "array_string_t").length > 0;
        this.headerFlags.js_var_array = this.headerFlags.js_var_array || structs.filter(s => s.name == "array_js_var_t").length > 0;
        this.headerFlags.js_var_dict = this.headerFlags.js_var_dict || structs.filter(s => s.name == "dict_js_var_t").length > 0;
        this.userStructs = structs.filter(s => ["array_string_t", "array_pointer_t", "array_js_var_t", "dict_js_var_t"].indexOf(s.name) == -1).map(s => ({
            name: s.name,
            properties: s.properties.map(p => new CVariable(this, p.name, p.type, { removeStorageSpecifier: true }))
        }));

        this.destructors = new CVariableDestructors(this, null);
    }
}
