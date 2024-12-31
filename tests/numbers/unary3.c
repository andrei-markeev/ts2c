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

struct js_var js_var_inc(struct js_var * v, int16_t by) {
    struct js_var result;

    result = js_var_to_number(*v);
    if (result.type == JS_VAR_INT16) {
        (*v).type = JS_VAR_INT16;
        (*v).number = result.number + by;
        (*v).data = NULL;
    } else
        (*v).type = JS_VAR_NAN;
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

static struct js_var u1;
static struct js_var u2;
static struct array_js_var_t * u3;
static const char * tmp_str;
static uint8_t tmp_need_dispose;

int main(void) {
    u1 = js_var_from_str("123");
    u2 = js_var_from_str("abc");
    ARRAY_CREATE(u3, 2, 1);
    u3->data[0] = js_var_from_int16_t(12);
    ARRAY_PUSH(u3, js_var_from_str("15"));
    printf("%s", tmp_str = js_var_to_str(js_var_compute(js_var_from_int16_t(10), JS_VAR_MINUS, js_var_inc(&u1, 1)), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf(" %s\n", tmp_str = js_var_to_str(u1, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s", tmp_str = js_var_to_str(js_var_compute(js_var_from_int16_t(10), JS_VAR_MINUS, js_var_inc(&u1, -1)), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf(" %s\n", tmp_str = js_var_to_str(u1, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s", tmp_str = js_var_to_str(js_var_compute(js_var_from_int16_t(10), JS_VAR_MINUS, js_var_inc(&u2, 1)), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf(" %s\n", tmp_str = js_var_to_str(u2, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s", tmp_str = js_var_to_str(js_var_compute(js_var_from_int16_t(10), JS_VAR_MINUS, js_var_inc(&u2, -1)), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf(" %s\n", tmp_str = js_var_to_str(u2, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s", tmp_str = js_var_to_str(js_var_compute(js_var_from_int16_t(10), JS_VAR_MINUS, js_var_inc(&u3->data[1], 1)), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf(" %s\n", tmp_str = js_var_to_str(u3->data[1], &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf("%s", tmp_str = js_var_to_str(js_var_compute(js_var_from_int16_t(10), JS_VAR_MINUS, js_var_inc(&u3->data[1], -1)), &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    printf(" %s\n", tmp_str = js_var_to_str(u3->data[1], &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
    free(u3->data);
    free(u3);

    return 0;
}
