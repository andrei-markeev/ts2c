#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

#include <ctype.h>

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

enum js_var_type {JS_VAR_NULL, JS_VAR_UNDEFINED, JS_VAR_NAN, JS_VAR_BOOL, JS_VAR_INT16, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_DICT};
struct js_var {
    enum js_var_type type;
    int16_t number;
    void *data;
};

struct array_string_t {
    int16_t size;
    int16_t capacity;
    const char ** data;
};

struct js_var js_var_from(enum js_var_type type) {
    struct js_var v;
    v.type = type;
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

struct y_t {
    uint8_t test;
    uint8_t other;
};

static const char * x;
static struct y_t * y;
static struct array_string_t * arr;
static const char *y_t_props[2] = { "other", "test" };
static struct js_var tmp_key;
static struct js_var tmp_key_2;
static struct js_var tmp_key_3;

int main(void) {
    x = "test";
    y = malloc(sizeof(*y));
    assert(y != NULL);
    y->test = TRUE;
    y->other = FALSE;
    ARRAY_CREATE(arr, 2, 2);
    arr->data[0] = "some";
    arr->data[1] = "thing";
    ARRAY_PUSH(arr, "hello");
    printf("%s\n", dict_find_pos(y_t_props, 2, x) > -1 ? "true" : "false");
    tmp_key = str_to_int16_t("length");
    printf("%s\n", TRUE ? "true" : "false");
    tmp_key_2 = str_to_int16_t("indexOf");
    printf("%s\n", TRUE ? "true" : "false");
    tmp_key_3 = js_var_from(JS_VAR_NAN);
    printf("%s\n", (tmp_key_3.type != JS_VAR_NAN && tmp_key_3.number >= 0 && tmp_key_3.number < arr->size) ? "true" : "false");
    free(y);
    free(arr->data);
    free(arr);

    return 0;
}
