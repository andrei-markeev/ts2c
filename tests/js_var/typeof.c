#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

#define TRUE 1
#define FALSE 0
typedef unsigned char uint8_t;
typedef short int16_t;

enum js_var_type {JS_VAR_NULL, JS_VAR_UNDEFINED, JS_VAR_NAN, JS_VAR_BOOL, JS_VAR_INT16, JS_VAR_STRING, JS_VAR_ARRAY, JS_VAR_DICT};
struct js_var {
    enum js_var_type type;
    int16_t number;
    void *data;
};

struct js_var js_var_from(enum js_var_type type) {
    struct js_var v;
    v.type = type;
    v.data = NULL;
    return v;
}

const char * js_var_typeof(struct js_var v)
{
    if (v.type == JS_VAR_INT16 || v.type == JS_VAR_NAN)
        return "number";
    else if (v.type == JS_VAR_BOOL)
        return "boolean";
    else if (v.type == JS_VAR_STRING)
        return "string";
    else if (v.type == JS_VAR_UNDEFINED)
        return "undefined";
    else
        return "object";
}

struct z_t {
    const char * prop1;
};
struct tmp_obj_t {
    int16_t some;
};

static const char * x;
static int16_t y[3] = { 1, 2, 3 };
static struct z_t * z;
static struct tmp_obj_t * tmp_obj = NULL;

int main(void) {
    x = "number";
    z = malloc(sizeof(*z));
    assert(z != NULL);
    z->prop1 = "test";
    if (strcmp(x, "number") == 0)
        printf("typeof true === typeof false\n");
    if (strcmp("string", "string") != 0)
        printf("typeof test !== \"string\"\n");
    if (strcmp(js_var_typeof(js_var_from(JS_VAR_NULL)), "object") == 0)
        printf("typeof null === \"object\"\n");
    printf("%s\n", js_var_typeof(js_var_from(JS_VAR_UNDEFINED)));
    tmp_obj = malloc(sizeof(*tmp_obj));
    assert(tmp_obj != NULL);
    tmp_obj->some = 123;
    printf("%s something\n", "object");
    printf("typeof y:");
    printf(" %s\n", "object");
    printf("typeof z:");
    printf(" %s\n", "object");
    printf("typeof z.prop1:");
    printf(" %s\n", "string");
    free(z);
    free(tmp_obj);

    return 0;
}
