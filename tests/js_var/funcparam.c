#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>

#define TRUE 1
#define FALSE 0
typedef unsigned char uint8_t;
typedef short int16_t;

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

struct js_var js_var_from_str(const char *s) {
    struct js_var v;
    v.type = JS_VAR_STRING;
    v.data = (void *)s;
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

static struct js_var a;
static struct js_var b;

struct js_var id(struct js_var x)
{
    return x;
}

int main(void) {
    ARRAY_CREATE(js_var_log_circular, 4, 0);

    a = id(js_var_from_int16_t(0));
    b = id(js_var_from_str("a"));
    js_var_log("", a, "", FALSE, FALSE);
    js_var_log(" ", b, "\n", FALSE, FALSE);

    return 0;
}
