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

static int16_t a;
static int16_t b;
static struct js_var x;
static struct js_var y;
static struct js_var z;

int main(void) {
    ARRAY_CREATE(js_var_log_circular, 4, 0);

    a = 10;
    b = 5;
    x = str_to_int16_t("12test");
    y = str_to_int16_t("55");
    z = js_var_compute(js_var_from_int16_t(a), JS_VAR_ASTERISK, x);
    js_var_log("", z, "\n", FALSE, FALSE);
    js_var_log("", js_var_compute(y, JS_VAR_SLASH, js_var_from_int16_t(b)), "\n", FALSE, FALSE);

    return 0;
}
