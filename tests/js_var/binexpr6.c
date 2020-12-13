#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>
#include <ctype.h>
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
int16_t js_var_lessthan(struct js_var left, struct js_var right)
{
    struct js_var left_to_number, right_to_number;
    const char *left_as_string, *right_as_string;
    uint8_t need_dispose_left, need_dispose_right;
    int16_t result;

    if ((left.type == JS_VAR_STRING || left.type == JS_VAR_ARRAY || left.type == JS_VAR_DICT)
        && (right.type == JS_VAR_STRING || right.type == JS_VAR_ARRAY || right.type == JS_VAR_DICT))
    {
        left_as_string = js_var_to_str(left, &need_dispose_left);
        right_as_string = js_var_to_str(right, &need_dispose_right);
        
        result = strcmp(left_as_string, right_as_string) < 0 ? 1 : -1;

        if (need_dispose_left)
            free((void *)left_as_string);
        if (need_dispose_right)
            free((void *)right_as_string);
        return result;
    } else {
        left_to_number = js_var_to_number(left);
        right_to_number = js_var_to_number(right);

        if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN)
            return 0;
        if (left_to_number.number == 0 && right_to_number.number == 0)
            return -1;
        return left_to_number.number < right_to_number.number ? 1 : -1;
    }
}
static struct js_var arr;
static struct array_js_var_t * tmp_array = NULL;
static struct js_var obj;
static struct dict_js_var_t * tmp_obj = NULL;
int main(void) {
    printf("Empty");
    printf(" %s\n", strcmp("", "") < 0 ? "true" : "false");
    printf("EmptyLeft");
    printf(" %s\n", strcmp("", "1") < 0 ? "true" : "false");
    printf("EmptyRight");
    printf(" %s\n", strcmp("1", "") < 0 ? "true" : "false");
    printf("Same");
    printf(" %s\n", strcmp("year 2019", "year 2019") < 0 ? "true" : "false");
    printf("LeftIsPrefix");
    printf(" %s\n", strcmp("12", "123") < 0 ? "true" : "false");
    printf("RightIsPrefix");
    printf(" %s\n", strcmp("123", "12") < 0 ? "true" : "false");
    printf("Different");
    printf(" %s\n", strcmp("abcd", "abdd") < 0 ? "true" : "false");
    ARRAY_CREATE(tmp_array, 3, 3);
    tmp_array->data[0] = js_var_from_int16_t(1);
    tmp_array->data[1] = js_var_from_int16_t(2);
    tmp_array->data[2] = js_var_from_int16_t(3);
    arr = js_var_from_array(tmp_array);
    printf("ArrayVsString1");
    printf(" %s\n", js_var_lessthan(js_var_from_str("1,3,2"), arr) > 0 ? "true" : "false");
    printf("ArrayVsString2");
    printf(" %s\n", js_var_lessthan(arr, js_var_from_str("1,3,2")) > 0 ? "true" : "false");
    printf("ArrayVsString3");
    printf(" %s\n", js_var_lessthan(arr, js_var_from_str("1,3,2")) < 0 ? "true" : "false");
    printf("ArrayVsString3");
    printf(" %s\n", js_var_lessthan(js_var_from_str("1,3,2"), arr) < 0 ? "true" : "false");
    printf("ArrayVsNumber1");
    printf(" %s\n", js_var_lessthan(js_var_from_int16_t(123), arr) > 0 ? "true" : "false");
    printf("ArrayVsNumber2");
    printf(" %s\n", js_var_lessthan(arr, js_var_from_int16_t(123)) > 0 ? "true" : "false");
    printf("ArrayVsNumber3");
    printf(" %s\n", js_var_lessthan(arr, js_var_from_int16_t(123)) < 0 ? "true" : "false");
    printf("ArrayVsNumber4");
    printf(" %s\n", js_var_lessthan(js_var_from_int16_t(123), arr) < 0 ? "true" : "false");
    printf("StringVsNumber1");
    printf(" %s\n", js_var_lessthan(js_var_from_int16_t(65), js_var_from_str("abc")) > 0 ? "true" : "false");
    printf("StringVsNumber2");
    printf(" %s\n", js_var_lessthan(js_var_from_str("abc"), js_var_from_int16_t(65)) > 0 ? "true" : "false");
    printf("StringVsNumber3");
    printf(" %s\n", js_var_lessthan(js_var_from_str("abc"), js_var_from_int16_t(65)) < 0 ? "true" : "false");
    printf("StringVsNumber4");
    printf(" %s\n", js_var_lessthan(js_var_from_int16_t(65), js_var_from_str("abc")) < 0 ? "true" : "false");
    printf("StringVsNumber5");
    printf(" %s\n", js_var_lessthan(js_var_from_int16_t(65), js_var_from_str("655")) > 0 ? "true" : "false");
    printf("StringVsNumber6");
    printf(" %s\n", js_var_lessthan(js_var_from_str("655"), js_var_from_int16_t(65)) > 0 ? "true" : "false");
    printf("StringVsNumber7");
    printf(" %s\n", js_var_lessthan(js_var_from_str("655"), js_var_from_int16_t(65)) < 0 ? "true" : "false");
    printf("StringVsNumber8");
    printf(" %s\n", js_var_lessthan(js_var_from_int16_t(65), js_var_from_str("655")) < 0 ? "true" : "false");
    DICT_CREATE(tmp_obj, 4);
    DICT_SET(tmp_obj, "test", js_var_from_str("hello"));
    obj = js_var_from_dict(tmp_obj);
    printf("StringVsObject1");
    printf(" %s\n", js_var_lessthan(obj, js_var_from_str("[obj")) > 0 ? "true" : "false");
    printf("StringVsObject2");
    printf(" %s\n", js_var_lessthan(js_var_from_str("[obj"), obj) > 0 ? "true" : "false");
    printf("StringVsObject3");
    printf(" %s\n", js_var_lessthan(js_var_from_str("[obj"), obj) < 0 ? "true" : "false");
    printf("StringVsObject4");
    printf(" %s\n", js_var_lessthan(obj, js_var_from_str("[obj")) < 0 ? "true" : "false");
    printf("Null1");
    printf(" %s\n", js_var_lessthan(js_var_from_int16_t(100), js_var_from(JS_VAR_NULL)) > 0 ? "true" : "false");
    printf("Null2");
    printf(" %s\n", js_var_lessthan(js_var_from(JS_VAR_NULL), js_var_from_int16_t(100)) > 0 ? "true" : "false");
    printf("Null3");
    printf(" %s\n", js_var_lessthan(js_var_from(JS_VAR_NULL), js_var_from_int16_t(100)) < 0 ? "true" : "false");
    printf("Null4");
    printf(" %s\n", js_var_lessthan(js_var_from_int16_t(100), js_var_from(JS_VAR_NULL)) < 0 ? "true" : "false");
    printf("Undefined1");
    printf(" %s\n", js_var_lessthan(js_var_from(JS_VAR_UNDEFINED), js_var_from_str("undefined")) > 0 ? "true" : "false");
    printf("Undefined2");
    printf(" %s\n", js_var_lessthan(js_var_from_str("undefined"), js_var_from(JS_VAR_UNDEFINED)) > 0 ? "true" : "false");
    printf("Undefined3");
    printf(" %s\n", js_var_lessthan(js_var_from_str("undefined"), js_var_from(JS_VAR_UNDEFINED)) < 0 ? "true" : "false");
    printf("Undefined4");
    printf(" %s\n", js_var_lessthan(js_var_from(JS_VAR_UNDEFINED), js_var_from_str("undefined")) < 0 ? "true" : "false");
    printf("NullVsUndefined1");
    printf(" %s\n", js_var_lessthan(js_var_from(JS_VAR_UNDEFINED), js_var_from(JS_VAR_NULL)) > 0 ? "true" : "false");
    printf("NullVsUndefined2");
    printf(" %s\n", js_var_lessthan(js_var_from(JS_VAR_NULL), js_var_from(JS_VAR_UNDEFINED)) > 0 ? "true" : "false");
    printf("NullVsUndefined3");
    printf(" %s\n", js_var_lessthan(js_var_from(JS_VAR_NULL), js_var_from(JS_VAR_UNDEFINED)) < 0 ? "true" : "false");
    printf("NullVsUndefined4");
    printf(" %s\n", js_var_lessthan(js_var_from(JS_VAR_UNDEFINED), js_var_from(JS_VAR_NULL)) < 0 ? "true" : "false");
    free(tmp_array->data);
    free(tmp_array);
    free(tmp_obj->index->data);
    free(tmp_obj->index);
    free(tmp_obj->values->data);
    free(tmp_obj->values);
    free(tmp_obj);

    return 0;
}
