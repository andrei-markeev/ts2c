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
struct js_var js_var_from_str(const char *s) {
    struct js_var v;
    v.type = JS_VAR_STRING;
    v.data = (void *)s;
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
static struct dict_js_var_t * d;
static struct dict_js_var_t * tmp_obj = NULL;
static int16_t i;
static const char * tmp_str;
static uint8_t tmp_need_dispose;
static struct dict_js_var_t * d2;
static int16_t j;
void Dict(struct dict_js_var_t * this, struct dict_js_var_t * obj)
{
    int16_t i;
    const char * k;
    for (i = 0; i < obj->index->size; i++)
    {
        k = obj->index->data[i];
        DICT_SET(this, k, DICT_GET(obj, k, js_var_from(JS_VAR_UNDEFINED)));
    }

}

int main(void) {
    DICT_CREATE(tmp_obj, 4);
    DICT_SET(tmp_obj, "hello", js_var_from_str("World"));
    DICT_SET(tmp_obj, "test", js_var_from_int16_t(2));
    DICT_CREATE(d, 4);
    Dict(d, tmp_obj);
    printf("{ ");
    for (i = 0; i < d->index->size; i++) {
        if (i != 0)
            printf(", ");
        printf("\"%s\": ", d->index->data[i]);
        printf(d->values->data[i].type == JS_VAR_STRING ? "\"%s\"" : "%s", tmp_str = js_var_to_str(d->values->data[i], &tmp_need_dispose));
        if (tmp_need_dispose)
            free((void *)tmp_str);
    }
    printf(" }\n");
    DICT_CREATE(d2, 4);
    Dict(d2, d);
    printf("{ ");
    for (j = 0; j < d2->index->size; j++) {
        if (j != 0)
            printf(", ");
        printf("\"%s\": ", d2->index->data[j]);
        printf(d2->values->data[j].type == JS_VAR_STRING ? "\"%s\"" : "%s", tmp_str = js_var_to_str(d2->values->data[j], &tmp_need_dispose));
        if (tmp_need_dispose)
            free((void *)tmp_str);
    }
    printf(" }\n");
    free(d->index->data);
    free(d->index);
    free(d->values->data);
    free(d->values);
    free(d);
    free(tmp_obj->index->data);
    free(tmp_obj->index);
    free(tmp_obj->values->data);
    free(tmp_obj->values);
    free(tmp_obj);
    free(d2->index->data);
    free(d2->index);
    free(d2->values->data);
    free(d2->values);
    free(d2);

    return 0;
}
