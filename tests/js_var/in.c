#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>
#include <ctype.h>

typedef unsigned char uint8_t;
typedef short int16_t;

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

struct obj1_t {
    const char * some;
};
struct tmp_obj_t {
    const char * x;
};

static ARRAY(void *) gc_main;
static int16_t gc_i;

static struct obj1_t * obj1;
static DICT(const char *) obj2;
static DICT(void *) obj3;
static const char * arr[3] = { "some", "thing", "1,2,3" };
static const char *obj1_t_props[1] = { "some" };
static struct tmp_obj_t * tmp_obj = NULL;
static int16_t tmp_array[3] = { 1, 2, 3 };
static char * buf;
static int16_t i;
static struct js_var tmp_key;
static struct js_var tmp_key_2;

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    obj1 = malloc(sizeof(*obj1));
    assert(obj1 != NULL);
    obj1->some = "thing";
    DICT_CREATE(obj2, 4);
    DICT_SET(obj2, "[object Object]", "test");
    DICT_SET(obj2, "1,2,3", "test2");
    DICT_SET(obj2, "hello", "here");
    DICT_SET(obj2, "33", "44");
    DICT_CREATE(obj3, 4);
    printf("%s\n", dict_find_pos(obj1_t_props, 1, "some") > -1 ? "true" : "false");
    printf("%s\n", dict_find_pos(obj1_t_props, 1, "hello") > -1 ? "true" : "false");
    printf("%s\n", dict_find_pos(obj1_t_props, 1, "33") > -1 ? "true" : "false");
    printf("%s\n", dict_find_pos(obj3->index->data, obj3->index->size, "") > -1 ? "true" : "false");
    printf("%s\n", dict_find_pos(obj3->index->data, obj3->index->size, "test") > -1 ? "true" : "false");
    printf("%s\n", dict_find_pos(obj2->index->data, obj2->index->size, "some") > -1 ? "true" : "false");
    printf("%s\n", dict_find_pos(obj2->index->data, obj2->index->size, "hello") > -1 ? "true" : "false");
    printf("%s\n", dict_find_pos(obj2->index->data, obj2->index->size, "33") > -1 ? "true" : "false");
    tmp_obj = malloc(sizeof(*tmp_obj));
    assert(tmp_obj != NULL);
    tmp_obj->x = "something ";
    printf("%s\n", dict_find_pos(obj2->index->data, obj2->index->size, "[object Object]") > -1 ? "true" : "false");
    buf = malloc((STR_INT16_T_BUFLEN + 1) * 3);
    assert(buf != NULL);
    buf[0] = '\0';
    for (i = 0; i < 3; i++) {
        if (i != 0)
            strcat(buf, ",");
        str_int16_t_cat(buf, tmp_array[i]);
    }
    ARRAY_PUSH(gc_main, (void *)buf);
    printf("%s\n", dict_find_pos(obj2->index->data, obj2->index->size, buf) > -1 ? "true" : "false");
    tmp_key = str_to_int16_t("1");
    printf("%s\n", (tmp_key.type != JS_VAR_NAN && tmp_key.number >= 0 && tmp_key.number < 3) ? "true" : "false");
    tmp_key_2 = str_to_int16_t("some");
    printf("%s\n", (tmp_key_2.type != JS_VAR_NAN && tmp_key_2.number >= 0 && tmp_key_2.number < 3) ? "true" : "false");
    printf("%s\n", (2 >= 0 && 2 < 3) ? "true" : "false");
    printf("%s\n", (-1 >= 0 && -1 < 3) ? "true" : "false");
    printf("%s\n", (33 >= 0 && 33 < 3) ? "true" : "false");
    free(obj1);
    free(obj2->index->data);
    free(obj2->index);
    free(obj2->values->data);
    free(obj2->values);
    free(obj2);
    free(obj3->index->data);
    free(obj3->index);
    free(obj3->values->data);
    free(obj3->values);
    free(obj3);
    free(tmp_obj);
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
