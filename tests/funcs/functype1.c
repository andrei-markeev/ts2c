#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>
#define TRUE 1
#define FALSE 0
typedef unsigned char uint8_t;
typedef short int16_t;
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

struct obj_t {
    struct js_var (*echo)(struct js_var);
    int16_t k;
};

static struct obj_t * obj;
static struct js_var tmp_result;
static const char * tmp_str;
static uint8_t tmp_need_dispose;
static struct js_var tmp_result_2;
static struct js_var tmp_result_3;
struct js_var echo(struct js_var x)
{
    return x;

}

int main(void) {
    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    obj->echo = echo;
    obj->k = 0;
    tmp_result = echo(js_var_from_int16_t(obj->k));
    printf("%s\n", tmp_str = js_var_to_str(tmp_result, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    tmp_result_2 = obj->echo(js_var_from_str("k"));
    printf("%s\n", tmp_str = js_var_to_str(tmp_result_2, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    tmp_result_3 = obj->echo(js_var_from_int16_t(-1));
    printf("%s\n", tmp_str = js_var_to_str(tmp_result_3, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    free(obj);

    return 0;
}
