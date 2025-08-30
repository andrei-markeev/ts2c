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

#define ARRAY_INSERT(array, pos, item) {\
    ARRAY_PUSH(array, item); \
    if (pos < array->size - 1) {\
        memmove(&(array->data[(pos) + 1]), &(array->data[pos]), (array->size - (pos) - 1) * sizeof(*array->data)); \
        array->data[pos] = item; \
    } \
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

struct js_var js_var_from_uint8_t(uint8_t b) {
    struct js_var v;
    v.type = JS_VAR_BOOL;
    v.number = b;
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

static struct js_var args[4];
static struct js_var args_2[4];
static struct js_var args_3[4];

void testArgs3(struct js_var firstString, struct js_var arguments[4], int16_t arguments_n)
{
    int16_t i;

    js_var_log("", firstString, "\n", FALSE, FALSE);
    i = 1;
    for (;i < arguments_n;i++)
        js_var_log("", arguments[i], "\n", FALSE, FALSE);
}

int main(void) {
    ARRAY_CREATE(js_var_log_circular, 4, 0);

    args[0] = js_var_from_str("123");
    testArgs3(js_var_from_str("123"), args, 1);
    args_2[0] = js_var_from_int16_t(123);
    args_2[1] = js_var_from_str("world");
    testArgs3(js_var_from_int16_t(123), args_2, 2);
    args_3[0] = js_var_from_uint8_t(TRUE);
    args_3[1] = js_var_from_str("here");
    args_3[2] = js_var_from_str("we");
    args_3[3] = js_var_from_str("go");
    testArgs3(js_var_from_uint8_t(TRUE), args_3, 4);

    return 0;
}
