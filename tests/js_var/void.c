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

struct array_pointer_t {
    int16_t size;
    int16_t capacity;
    void ** data;
};

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

struct js_var js_var_to_undefined(void *value) {
    struct js_var v;
    v.type = JS_VAR_UNDEFINED;
    v.data = NULL;
    return v;
}

static struct array_pointer_t *gc_main;
static int16_t gc_i;

static int16_t a;
static struct js_var tmp_result_2;
static char * tmp_result = NULL;
static const char * tmp_str;
static uint8_t tmp_need_dispose;
static struct js_var tmp_result_3;

struct js_var voidify(const char * x)
{
    return js_var_to_undefined((x));
}
void * log(const char * message)
{
    printf("Logged:");
    printf(" %s\n", message);
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    a = 10;
    tmp_result = malloc(STR_INT16_T_BUFLEN + strlen("test") + 1);
    assert(tmp_result != NULL);
    tmp_result[0] = '\0';
    str_int16_t_cat(tmp_result, a);
    strcat(tmp_result, "test");
    ARRAY_PUSH(gc_main, tmp_result);
    tmp_result_2 = voidify(tmp_result);
    printf("%s\n", tmp_str = js_var_to_str(tmp_result_2, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s\n", tmp_str = js_var_to_str(js_var_to_undefined(0), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    tmp_result_3 = js_var_to_undefined(log("Hello world"));
    printf("%s\n", tmp_str = js_var_to_str(tmp_result_3, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
