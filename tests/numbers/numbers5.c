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

struct array_string_t {
    int16_t size;
    int16_t capacity;
    const char ** data;
};

struct array_pointer_t {
    int16_t size;
    int16_t capacity;
    void ** data;
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

struct js_var js_var_from_int16_t(int16_t n) {
    struct js_var v;
    v.type = JS_VAR_INT16;
    v.number = n;
    v.data = NULL;
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

struct array_pointer_t * js_var_log_circular;
void js_var_log(const char *prefix, struct js_var v, const char *postfix, uint8_t is_quoted, uint8_t is_recursive)
{
    int16_t i;
    uint8_t need_dispose = 0;
    const char *tmp;

    if (!is_recursive)
        js_var_log_circular->size = 0;
    if (v.type == JS_VAR_ARRAY || v.type == JS_VAR_DICT) {
        for (i = 0; i < js_var_log_circular->size; i++) {
            if (js_var_log_circular->data[i] == v.data) {
                printf("(circular)");
                return;
            }
        }
        ARRAY_PUSH(js_var_log_circular, v.data);
    }

    if (v.type == JS_VAR_ARRAY) {
        printf("%s[ ", prefix);
        for (i = 0; i < ((struct array_js_var_t *)v.data)->size; i++) {
            if (i != 0)
                printf(", ");
            js_var_log("", ((struct array_js_var_t *)v.data)->data[i], "", TRUE, TRUE);
        }
        printf(" ]%s", postfix);
    } else if (v.type == JS_VAR_DICT) {
        printf("%s{ ", prefix);
        for (i = 0; i < ((struct dict_js_var_t *)v.data)->index->size; i++) {
            if (i != 0)
                printf(", ");
            printf("\"%s\": ", ((struct dict_js_var_t *)v.data)->index->data[i]);
            js_var_log("", ((struct dict_js_var_t *)v.data)->values->data[i], "", TRUE, TRUE);
        }
        printf(" }%s", postfix);
    } else {
        printf(is_quoted && v.type == JS_VAR_STRING ? "%s\"%s\"%s" : "%s%s%s", prefix, tmp = js_var_to_str(v, &need_dispose), postfix);
        if (need_dispose)
            free((void *)tmp);
    }
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

static struct array_pointer_t *gc_main;
static int16_t gc_i;

static struct js_var x;
static int16_t y;
static struct js_var z;

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    ARRAY_CREATE(js_var_log_circular, 4, 0);

    x = str_to_int16_t("10");
    y = 10;
    printf("%s\n", js_var_eq(x, js_var_from_int16_t(y), FALSE) == TRUE ? "true" : "false");
    if (js_var_eq(js_var_from(JS_VAR_NAN), js_var_from(JS_VAR_NAN), FALSE) == FALSE)
        printf("Number.NaN != NaN, that's fine.\n");
    z = js_var_from(JS_VAR_NAN);
    printf("%s\n", js_var_eq(z, js_var_plus(x, js_var_from_int16_t(y), gc_main), FALSE) == TRUE ? "true" : "false");
    js_var_log("", js_var_compute(z, JS_VAR_ASTERISK, js_var_from_int16_t(10)), "\n", FALSE, FALSE);
    z = js_var_compute(x, JS_VAR_ASTERISK, js_var_from_int16_t(y));
    if (js_var_eq(z, js_var_from_int16_t(100), TRUE) == TRUE)
        printf("good!\n");
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
