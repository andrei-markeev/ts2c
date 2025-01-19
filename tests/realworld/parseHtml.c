#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>
#include <ctype.h>
#include <setjmp.h>

#define TRUE 1
#define FALSE 0
typedef unsigned char uint8_t;
typedef short int16_t;

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

#define ARRAY(T) struct {\
    int16_t size;\
    int16_t capacity;\
    T *data;\
} *
#define ARRAY_CREATE(array, init_capacity, init_size) {\
    array = malloc(sizeof(*array)); \
    array->data = malloc((init_capacity) * sizeof(*array->data)); \
    assert(array->data != NULL); \
    array->capacity = init_capacity; \
    array->size = init_size; \
}
#define ARRAY_PUSH(array, item) {\
    if (array->size == array->capacity) {  \
        array->capacity *= 2;  \
        array->data = realloc(array->data, array->capacity * sizeof(*array->data)); \
        assert(array->data != NULL); \
    }  \
    array->data[array->size++] = item; \
}

#define ARRAY_INSERT(array, pos, item) {\
    ARRAY_PUSH(array, item); \
    if (pos < array->size - 1) {\
        memmove(&(array->data[(pos) + 1]), &(array->data[pos]), (array->size - (pos) - 1) * sizeof(*array->data)); \
        array->data[pos] = item; \
    } \
}

#define DICT(T) struct { \
    ARRAY(const char *) index; \
    ARRAY(T) values; \
} *

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

#define DICT_CREATE(dict, init_capacity) { \
    dict = malloc(sizeof(*dict)); \
    ARRAY_CREATE(dict->index, init_capacity, 0); \
    ARRAY_CREATE(dict->values, init_capacity, 0); \
}

int16_t tmp_dict_pos;
#define DICT_GET(dict, prop, default) ((tmp_dict_pos = dict_find_pos(dict->index->data, dict->index->size, prop)) < 0 ? default : dict->values->data[tmp_dict_pos])

int16_t tmp_dict_pos2;
#define DICT_SET(dict, prop, value) { \
    tmp_dict_pos2 = dict_find_pos(dict->index->data, dict->index->size, prop); \
    if (tmp_dict_pos2 < 0) { \
        tmp_dict_pos2 = -tmp_dict_pos2 - 1; \
        ARRAY_INSERT(dict->index, tmp_dict_pos2, prop); \
        ARRAY_INSERT(dict->values, tmp_dict_pos2, value); \
    } else \
        dict->values->data[tmp_dict_pos2] = value; \
}

#define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)

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
    buf[len] = '\0';
    return buf;
}

void str_int16_t_cat(char *str, int16_t num) {
    char numstr[STR_INT16_T_BUFLEN];
    sprintf(numstr, "%d", num);
    strcat(str, numstr);
}

enum js_var_type {JS_VAR_NULL, JS_VAR_UNDEFINED, JS_VAR_NAN, JS_VAR_BOOL, JS_VAR_INT16, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_DICT};
struct js_var {
    enum js_var_type type;
    int16_t number;
    void *data;
};

struct array_js_var_t {
    int16_t size;
    int16_t capacity;
    struct js_var *data;
};

struct array_string_t {
    int16_t size;
    int16_t capacity;
    const char ** data;
};

struct dict_js_var_t {
    struct array_string_t *index;
    struct array_js_var_t *values;
};

struct js_var js_var_from(enum js_var_type type) {
    struct js_var v;
    v.type = type;
    v.data = NULL;
    return v;
}

struct js_var js_var_from_str(const char *s) {
    struct js_var v;
    v.type = JS_VAR_STRING;
    v.data = (void *)s;
    return v;
}

struct js_var js_var_from_array(struct array_js_var_t *arr) {
    struct js_var v;
    v.type = JS_VAR_ARRAY;
    v.data = (void *)arr;
    return v;
}

struct js_var js_var_from_dict(struct dict_js_var_t *dict) {
    struct js_var v;
    v.type = JS_VAR_DICT;
    v.data = (void *)dict;
    return v;
}

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

int err_i = 0;
jmp_buf err_jmp[10];
#define TRY { int err_val = setjmp(err_jmp[err_i++]); if (!err_val) {
#define CATCH } else {
#define THROW(x) longjmp(err_jmp[--err_i], x)
struct array_string_t * err_defs;
#define END_TRY err_defs->size--; } }

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

struct js_var js_var_plus(struct js_var left, struct js_var right, ARRAY(void *) gc_main)
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

struct array_pointer_t {
    int16_t size;
    int16_t capacity;
    void ** data;
};

void regex_clear_matches(struct regex_match_struct_t *match_info, int16_t groupN) {
    int16_t i;
    for (i = 0; i < groupN; i++) {
        match_info->matches[i].index = -1;
        match_info->matches[i].end = -1;
    }
}

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

static ARRAY(void *) gc_main;
static int16_t gc_i;

static ARRAY(ARRAY(void *)) gc_main_arrays;
static ARRAY(DICT(void *)) gc_main_dicts;
static ARRAY(void *) gc_456;
static ARRAY(ARRAY(ARRAY(void *))) gc_456_arrays_c;
static struct js_var result;
static const char * tmp_str;
static uint8_t tmp_need_dispose;

struct js_var newNode(const char * tagName, const char * attrs, struct js_var parent)
{
    struct dict_js_var_t * tmp_obj = NULL;
    struct array_pointer_t * tmp_array = NULL;

    ARRAY_CREATE(tmp_array, 2, 0);
    ARRAY_PUSH(gc_main_arrays, (void *)tmp_array);
    DICT_CREATE(tmp_obj, 4);
    ARRAY_PUSH(gc_main_dicts, (void *)tmp_obj);
    DICT_SET(tmp_obj, "tagName", js_var_from_str(tagName));
    DICT_SET(tmp_obj, "attrs", js_var_from_str(attrs));
    DICT_SET(tmp_obj, "childNodes", js_var_from_array(tmp_array));
    DICT_SET(tmp_obj, "parentNode", parent);
    DICT_SET(tmp_obj, "innerHTML", js_var_from_str(""));
    return js_var_from_dict(tmp_obj);
}
struct regex_match_struct_t regex_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;

    int16_t started[3];
    if (capture) {
        result.matches = malloc(3 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 3);
        memset(started, 0, sizeof started);
    }

    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == '<' && iterator == 0) next = 1;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 1) {
            if (ch == '!') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == '-') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'A' && ch <= 'Z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 2) {
            if (ch == '-') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'A' && ch <= 'Z') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 3) {
            if (ch == '	') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '!') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == '-') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'Z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 4) {
            if (ch == '	') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '-') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'Z') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 5) {
            if (ch == '	') { next = 8; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 8; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '-') next = 9;
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= ':') next = 9;
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'X') next = 9;
            if (ch == 'Z') next = 9;
            if (ch == '_') next = 9;
            if (ch >= 'a' && ch <= 'x') next = 9;
            if (ch == 'z') next = 9;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 6) {
            if (ch == '>') next = 7;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 8) {
            if (ch == '	') { next = 8; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 8; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '-') next = 9;
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= ':') next = 9;
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'X') next = 9;
            if (ch == 'Z') next = 9;
            if (ch == '_') next = 9;
            if (ch >= 'a' && ch <= 'x') next = 9;
            if (ch == 'z') next = 9;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 9) {
            if (ch == '	') { next = 11; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 11; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '-') next = 9;
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= ':') next = 9;
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'X') next = 9;
            if (ch == 'Z') next = 9;
            if (ch == '_') next = 9;
            if (ch >= 'a' && ch <= 'x') next = 9;
            if (ch == 'z') next = 9;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 10) {
            if (ch == '	') next = 12;
            if (ch == ' ') next = 12;
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 11) {
            if (ch == '	') { next = 11; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 11; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 12) {
            if (ch == '	') next = 12;
            if (ch == ' ') next = 12;
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 13) {
            if (ch == '	') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '"') next = 17;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 14) {
            if (ch == '	') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '\'') next = 18;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 15) {
            if (ch == '	') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 16) {
            if (ch == '	') { next = 19; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 19; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '-') next = 9;
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= ':') next = 9;
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'X') next = 9;
            if (ch == 'Z') next = 9;
            if (ch == '_') next = 9;
            if (ch >= 'a' && ch <= 'x') next = 9;
            if (ch == 'z') next = 9;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 17) {
            if (next == -1 && ch != '"') next = 17;
            if (ch == '"') { next = 20; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 18) {
            if (next == -1 && ch != '\'') next = 18;
            if (ch == '\'') { next = 20; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 19) {
            if (ch == '	') { next = 19; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 19; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '-') next = 9;
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= ':') next = 9;
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'X') next = 9;
            if (ch == 'Z') next = 9;
            if (ch == '_') next = 9;
            if (ch >= 'a' && ch <= 'x') next = 9;
            if (ch == 'z') next = 9;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 20) {
            if (ch == '	') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 21; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 22; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 20; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 21) {
            if (ch == '	') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 21; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 22; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '"') next = 17;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 20; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 22) {
            if (ch == '	') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 21; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 22; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '\'') next = 18;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 20; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 7)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 3);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 7) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 3);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 7)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 3;
    return result;
}
struct regex_struct_t regex = { "/^<(!?[-A-Za-z0-9_]+)((?:\\s+[\\w\\-\\:]+(?:\\s*=\\s*(?:(?:\"[^\"]*\")|(?:'[^']*')|[^>\\s]+))?)*)\\s*(\\/?)>/", regex_search };

struct regex_match_struct_t regex_2_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;

    int16_t started[1];
    if (capture) {
        result.matches = malloc(1 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 1);
        memset(started, 0, sizeof started);
    }

    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == '<' && iterator == 0) next = 1;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 1) {
            if (ch == '/') next = 2;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 2) {
            if (ch == '-') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'A' && ch <= 'Z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 3) {
            if (ch == '-') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '>') next = 5;
            if (ch >= 'A' && ch <= 'Z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (next == -1 && ch != '>') next = 4;
        }
        if (state == 4) {
            if (next == -1 && ch != '>') next = 4;
            if (ch == '>') next = 5;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 5)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 1);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 5) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 1);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 5)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_2 = { "/^<\\/([-A-Za-z0-9_]+)[^>]*>/", regex_2_search };

struct js_var appendChild(struct js_var node, const char * tagName, const char * attrs)
{
    struct js_var n;

    n = newNode(tagName, attrs, node);
    /* Unsupported function call: 
         node.childNodes.push(n) */;
    return n;
}
void appendInnerHTML(struct js_var node, const char * html)
{
    struct js_var n;

    n = node;
    while (js_var_to_bool(n))
    {
        (js_var_get(n, js_var_from_str("innerHTML")) = js_var_plus(js_var_get(n, js_var_from_str("innerHTML")), js_var_from_str(html), gc_main));
        n = js_var_get(n, js_var_from_str("parentNode"));
    }
}
struct js_var parseHtml(const char * html)
{
    struct regex_struct_t startTagRegex;
    struct regex_struct_t endTagRegex;
    DICT(int16_t) special;
    int16_t index;
    uint8_t chars;
    struct array_string_t * match;
    const char * last;
    struct js_var currentNode;
    struct js_var rootNode;
    char * tmp_result = NULL;

    ARRAY_CREATE(gc_456, 2, 0);
    ARRAY_CREATE(gc_456_arrays_c, 2, 0);

    startTagRegex = regex;
    endTagRegex = regex_2;
    DICT_CREATE(special, 4);
    DICT_SET(special, "script", 1);
    DICT_SET(special, "style", 1);
    last = html;
    currentNode = newNode("", "{}", js_var_from(JS_VAR_NULL));
    rootNode = currentNode;
    while (str_len(html))
    {
        char * null;
        chars = TRUE;
        printf("1\n");
        null = js_var_to_str(js_var_get(currentNode, js_var_from_str("tagName")), &{needDisposeVarName});
        if ({needDisposeVarName})
            ARRAY_PUSH(gc_main, (void *)null);
        if (!DICT_GET(special, null, 0))
        {
            if (str_pos(html, "<!--") == 0)
            {
                printf("comment\n");
                index = str_pos(html, "-->");
                if (index >= 0)
                {
                    html = str_substring(html, index + 3, str_len(html));
                    chars = FALSE;
                }
            }
            else
                if (str_pos(html, "</") == 0)
            {
                printf("end_tag\n");
                match = regex_match(endTagRegex, html);
                ARRAY_PUSH(gc_456_arrays_c, (void *)match);
                if (match)
                {
                    html = str_substring(html, str_len(match->data[0]), str_len(html));
                    currentNode = js_var_get(currentNode, js_var_from_str("parentNode"));
                    appendInnerHTML(currentNode, match->data[0]);
                    chars = FALSE;
                }
            }
            else
                if (str_pos(html, "<") == 0)
            {
                printf("start_tag\n");
                match = regex_match(startTagRegex, html);
                ARRAY_PUSH(gc_456_arrays_c, (void *)match);
                if (match)
                {
                    printf("matched\n");
                    html = str_substring(html, str_len(match->data[0]), str_len(html));
                    appendInnerHTML(currentNode, match->data[0]);
                    currentNode = appendChild(currentNode, match->data[1], "attrs");
                    if (strcmp(match->data[match->size - 1], "/") == 0)
                        currentNode = js_var_get(currentNode, js_var_from_str("parentNode"));
                    chars = FALSE;
                }
            }
            if (chars)
            {
                const char * text;
                const char * substr;
                const char * substr_2;
                printf("chars\n");
                index = str_pos(html, "<");
                substr = str_substring(html, 0, index);
                text = index < 0 ? html : substr;
                substr_2 = str_substring(html, index, str_len(html));
                html = index < 0 ? "" : substr_2;
                appendChild(currentNode, "#text", "{}");
                appendInnerHTML(currentNode, text);
            }
        }
        else
        {
            html = str_substring(html, str_pos(html, js_var_plus(js_var_plus(js_var_from_str("</"), js_var_get(currentNode, js_var_from_str("tagName")), gc_main), js_var_from_str(">"), gc_main)), str_len(html));
        }
        printf("html==last...\n");
        if (strcmp(html, last) == 0)
        {
            printf("Parse Error: %s\n", html);
            free(special->index->data);
            free(special->index);
            free(special->values->data);
            free(special->values);
            free(special);
            for (gc_i = 0; gc_i < gc_456_arrays_c->size; gc_i++) {
                for (gc_j = 0; gc_j < (gc_456_arrays_c->data[gc_i] ? gc_456_arrays_c->data[gc_i]->size : 0); gc_j++)
                    free((void*)gc_456_arrays_c->data[gc_i]->data[gc_j]);
                free(gc_456_arrays_c->data[gc_i] ? gc_456_arrays_c->data[gc_i]->data : NULL);
                free(gc_456_arrays_c->data[gc_i]);
            }
            free(gc_456_arrays_c->data);
            free(gc_456_arrays_c);
            for (gc_i = 0; gc_i < gc_456->size; gc_i++)
                free(gc_456->data[gc_i]);
            free(gc_456->data);
            free(gc_456);
            return rootNode;
        }
        printf("last=html\n");
        tmp_result = malloc(strlen(html) + strlen("") + 1);
        assert(tmp_result != NULL);
        tmp_result[0] = '\0';
        strcat(tmp_result, html);
        strcat(tmp_result, "");
        ARRAY_PUSH(gc_456, tmp_result);
        last = tmp_result;
    }
    free(special->index->data);
    free(special->index);
    free(special->values->data);
    free(special->values);
    free(special);
    for (gc_i = 0; gc_i < gc_456_arrays_c->size; gc_i++) {
        for (gc_j = 0; gc_j < (gc_456_arrays_c->data[gc_i] ? gc_456_arrays_c->data[gc_i]->size : 0); gc_j++)
            free((void*)gc_456_arrays_c->data[gc_i]->data[gc_j]);
        free(gc_456_arrays_c->data[gc_i] ? gc_456_arrays_c->data[gc_i]->data : NULL);
        free(gc_456_arrays_c->data[gc_i]);
    }
    free(gc_456_arrays_c->data);
    free(gc_456_arrays_c);
    for (gc_i = 0; gc_i < gc_456->size; gc_i++)
        free(gc_456->data[gc_i]);
    free(gc_456->data);
    free(gc_456);
    return rootNode;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);
    ARRAY_CREATE(gc_main_arrays, 2, 0);
    ARRAY_CREATE(gc_main_dicts, 2, 0);
    ARRAY_CREATE(err_defs, 2, 0);

    result = parseHtml("<html><body></body></html>");
    printf("%s\n", tmp_str = js_var_to_str(result, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    for (gc_i = 0; gc_i < gc_main_arrays->size; gc_i++) {
        free(gc_main_arrays->data[gc_i]->data);
        free(gc_main_arrays->data[gc_i]);
    }
    free(gc_main_arrays->data);
    free(gc_main_arrays);
    for (gc_i = 0; gc_i < gc_main_dicts->size; gc_i++) {
        free(gc_main_dicts->data[gc_i]->index->data);
        free(gc_main_dicts->data[gc_i]->index);
        free(gc_main_dicts->data[gc_i]->values->data);
        free(gc_main_dicts->data[gc_i]->values);
        free(gc_main_dicts->data[gc_i]);
    }
    free(gc_main_dicts->data);
    free(gc_main_dicts);
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
