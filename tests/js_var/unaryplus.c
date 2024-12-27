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

static const char * s1;
static const char * s2;
static struct js_var n1;
static const char * tmp_str;
static uint8_t tmp_need_dispose;

int main(void) {
    s1 = "123test";
    s2 = "33";
    n1 = str_to_int16_t("   1");
    printf("%s\n", tmp_str = js_var_to_str(str_to_int16_t(s1), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s\n", tmp_str = js_var_to_str(str_to_int16_t(s2), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s\n", tmp_str = js_var_to_str(n1, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s\n", tmp_str = js_var_to_str(str_to_int16_t("   "), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s\n", tmp_str = js_var_to_str(str_to_int16_t(""), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s\n", tmp_str = js_var_to_str(str_to_int16_t("   -"), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s\n", tmp_str = js_var_to_str(str_to_int16_t("-20"), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);

    return 0;
}
