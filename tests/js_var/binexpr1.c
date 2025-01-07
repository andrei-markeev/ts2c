#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>
#include <ctype.h>

#define TRUE 1
#define FALSE 0
typedef unsigned char uint8_t;
typedef short int16_t;
typedef unsigned short uint16_t;

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

#define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)

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

struct js_var js_var_from_int16_t(int16_t n) {
    struct js_var v;
    v.type = JS_VAR_INT16;
    v.number = n;
    v.data = NULL;
    return v;
}

struct js_var js_var_from_str(const char *s) {
    struct js_var v;
    v.type = JS_VAR_STRING;
    v.data = (void *)s;
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

static ARRAY(void *) gc_main;
static int16_t gc_i;

static int16_t a;
static struct js_var r1;
static struct js_var r2;
static const char * tmp_str;
static uint8_t tmp_need_dispose;
static struct js_var tmp_result;

struct js_var add_and_substract(struct js_var x, struct js_var y, struct js_var z)
{
    struct js_var res;

    res = js_var_compute(js_var_plus(x, y, gc_main), JS_VAR_MINUS, z);
    return res;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    a = 10;
    r1 = add_and_substract(js_var_from_str("10"), js_var_from_int16_t(11), js_var_from_str("Hello"));
    r2 = add_and_substract(js_var_from_int16_t(a), js_var_from_str("11"), js_var_from_int16_t(100));
    printf("%s\n", tmp_str = js_var_to_str(r1, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s\n", tmp_str = js_var_to_str(r2, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s\n", tmp_str = js_var_to_str(js_var_plus(r1, r2, gc_main), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    tmp_result = add_and_substract(js_var_from_int16_t(a), js_var_from_int16_t(20), js_var_from_int16_t(5));
    printf("%s\n", tmp_str = js_var_to_str(tmp_result, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
