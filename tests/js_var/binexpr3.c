#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>
#include <ctype.h>
#include <setjmp.h>

#define TRUE 1
#define FALSE 0
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

int err_i = 0;
jmp_buf err_jmp[10];
#define TRY { int err_val = setjmp(err_jmp[err_i++]); if (!err_val) {
#define CATCH } else {
#define THROW(x) longjmp(err_jmp[--err_i], x)
struct array_string_t * err_defs;
#define END_TRY err_defs->size--; } }

struct js_var js_var_get(struct js_var v, struct js_var arg) {
    struct js_var tmp;
    const char *key;
    uint8_t need_dispose = 0;

    if (v.type == JS_VAR_ARRAY) {
        tmp = js_var_to_number(arg);
        if (tmp.type == JS_VAR_NAN)
            return js_var_from(JS_VAR_UNDEFINED);
        else
            return ((struct array_js_var_t *)v.data)->data[tmp.number];
    } else if (v.type == JS_VAR_DICT) {
        key = js_var_to_str(arg, &need_dispose);
        tmp = DICT_GET(((struct dict_js_var_t *)v.data), key, js_var_from(JS_VAR_UNDEFINED));
        if (need_dispose)
            free((void *)key);
        return tmp;
    } else if (v.type == JS_VAR_NULL || v.type == JS_VAR_UNDEFINED) {
        ARRAY_PUSH(err_defs, "TypeError: Cannot read property of null or undefined.");
        THROW(err_defs->size);
    } else
        return js_var_from(JS_VAR_UNDEFINED);
}

struct js_var js_var_plus(struct js_var left, struct js_var right, ARRAY(void *) gc_main)
{
    struct js_var result, left_to_number, right_to_number;
    const char *left_as_string, *right_as_string;
    uint8_t need_dispose_left, need_dispose_right;
    result.data = NULL;

    if (left.type == JS_VAR_STRING || right.type == JS_VAR_STRING 
        || left.type == JS_VAR_ARRAY || right.type == JS_VAR_ARRAY
        || left.type == JS_VAR_DICT || right.type == JS_VAR_DICT)
    {
        left_as_string = js_var_to_str(left, &need_dispose_left);
        right_as_string = js_var_to_str(right, &need_dispose_right);

        result.type = JS_VAR_STRING;
        result.data = malloc(strlen(left_as_string) + strlen(right_as_string) + 1);
        assert(result.data != NULL);
        ARRAY_PUSH(gc_main, result.data);

        strcpy(result.data, left_as_string);
        strcat(result.data, right_as_string);

        if (need_dispose_left)
            free((void *)left_as_string);
        if (need_dispose_right)
            free((void *)right_as_string);
        return result;
    }

    left_to_number = js_var_to_number(left);
    right_to_number = js_var_to_number(right);

    if (left_to_number.type == JS_VAR_NAN || right_to_number.type == JS_VAR_NAN) {
        result.type = JS_VAR_NAN;
        return result;
    }

    result.type = JS_VAR_INT16;
    result.number = left_to_number.number + right_to_number.number;
    return result;
}

static ARRAY(void *) gc_main;
static int16_t gc_i;

static int16_t num;
static const char * str;
static const char * str_num;
static uint8_t bool1;
static uint8_t bool2;
static struct array_js_var_t * static_array1;
static struct array_js_var_t * static_array2;
static struct array_js_var_t * dynamic_array1;
static struct array_js_var_t * dynamic_array2;
static struct array_js_var_t * dynamic_array3;
static struct dict_js_var_t * obj;
static struct dict_js_var_t * dict;
static char * tmp_result = NULL;
static struct js_var v_null;
static struct js_var v_undefined;
static struct js_var v_nan;
static struct js_var v_num;
static struct js_var v_str;
static struct js_var v_str_num;
static struct js_var v_bool1;
static struct js_var v_bool2;
static struct js_var v_arr1;
static struct array_js_var_t * tmp_array = NULL;
static struct js_var v_arr2;
static struct array_js_var_t * tmp_array_2 = NULL;
static struct js_var v_arr3;
static struct array_js_var_t * tmp_array_3 = NULL;
static struct js_var v_dict1;
static struct dict_js_var_t * tmp_obj = NULL;
static struct js_var v_dict2;
static struct dict_js_var_t * tmp_obj_2 = NULL;
static char * tmp_result_2 = NULL;
static char * tmp_result_3 = NULL;
static char * tmp_result_4 = NULL;
static int16_t i;
static int16_t len;
static const char * tmp;
static uint8_t need_dispose;
static int16_t j;
static char * tmp_result_5 = NULL;
static int16_t k;
static int16_t len_2;
static int16_t l;
static char * tmp_result_6 = NULL;
static int16_t m;
static int16_t len_3;
static int16_t n;
static char * tmp_result_7 = NULL;
static int16_t i_2;
static int16_t len_4;
static int16_t i_3;
static char * tmp_result_8 = NULL;
static int16_t i_4;
static int16_t len_5;
static int16_t i_5;
static char * tmp_result_9 = NULL;
static char * tmp_result_10 = NULL;
static char * tmp_result_11 = NULL;
static char * tmp_result_12 = NULL;
static char * tmp_result_13 = NULL;
static char * tmp_result_14 = NULL;
static char * tmp_result_15 = NULL;
static int16_t i_6;
static int16_t len_6;
static int16_t i_7;
static char * tmp_result_16 = NULL;
static int16_t i_8;
static int16_t len_7;
static int16_t i_9;
static char * tmp_result_17 = NULL;
static int16_t i_10;
static int16_t len_8;
static int16_t i_11;
static char * tmp_result_18 = NULL;
static int16_t i_12;
static int16_t len_9;
static int16_t i_13;
static char * tmp_result_20 = NULL;
static int16_t i_14;
static int16_t len_10;
static int16_t i_15;
static char * tmp_result_19 = NULL;
static char * tmp_result_21 = NULL;
static char * tmp_result_22 = NULL;
static char * tmp_result_23 = NULL;
static char * tmp_result_24 = NULL;
static char * tmp_result_25 = NULL;
static char * tmp_result_26 = NULL;
static char * tmp_result_27 = NULL;
static int16_t i_16;
static int16_t len_11;
static int16_t i_17;
static char * tmp_result_28 = NULL;
static int16_t i_18;
static int16_t len_12;
static int16_t i_19;
static char * tmp_result_29 = NULL;
static int16_t i_20;
static int16_t len_13;
static int16_t i_21;
static char * tmp_result_30 = NULL;
static int16_t i_22;
static int16_t len_14;
static int16_t i_23;
static char * tmp_result_32 = NULL;
static char * tmp_result_31 = NULL;
static int16_t i_24;
static int16_t len_15;
static int16_t i_25;
static char * tmp_result_33 = NULL;
static char * tmp_result_34 = NULL;
static char * tmp_result_35 = NULL;
static char * tmp_result_36 = NULL;
static int16_t i_26;
static int16_t len_16;
static int16_t i_27;
static char * tmp_result_37 = NULL;
static int16_t i_28;
static int16_t len_17;
static int16_t i_29;
static char * tmp_result_38 = NULL;
static int16_t i_30;
static int16_t len_18;
static int16_t i_31;
static char * tmp_result_39 = NULL;
static int16_t i_32;
static int16_t len_19;
static int16_t i_33;
static char * tmp_result_41 = NULL;
static int16_t i_34;
static int16_t len_20;
static int16_t i_35;
static char * tmp_result_40 = NULL;
static char * tmp_result_42 = NULL;
static char * tmp_result_43 = NULL;
static char * tmp_result_44 = NULL;
static int16_t i_36;
static int16_t len_21;
static int16_t i_37;
static char * tmp_result_45 = NULL;
static int16_t i_38;
static int16_t len_22;
static int16_t i_39;
static char * tmp_result_46 = NULL;
static int16_t i_40;
static int16_t len_23;
static int16_t i_41;
static char * tmp_result_47 = NULL;
static int16_t i_42;
static int16_t len_24;
static int16_t i_43;
static char * tmp_result_49 = NULL;
static int16_t i_44;
static int16_t len_25;
static int16_t i_45;
static char * tmp_result_48 = NULL;
static char * tmp_result_50 = NULL;
static char * tmp_result_51 = NULL;
static char * tmp_result_52 = NULL;
static int16_t i_46;
static int16_t len_26;
static int16_t i_47;
static char * tmp_result_53 = NULL;
static int16_t i_48;
static int16_t len_27;
static int16_t i_49;
static int16_t len_28;
static int16_t i_50;
static int16_t i_51;
static char * tmp_result_54 = NULL;
static int16_t i_52;
static int16_t len_29;
static int16_t i_53;
static int16_t len_30;
static int16_t i_54;
static int16_t i_55;
static char * tmp_result_55 = NULL;
static int16_t i_56;
static int16_t len_31;
static int16_t i_57;
static int16_t len_32;
static int16_t i_58;
static int16_t i_59;
static char * tmp_result_56 = NULL;
static int16_t i_60;
static int16_t len_33;
static int16_t i_61;
static int16_t len_34;
static int16_t i_62;
static int16_t i_63;
static char * tmp_result_58 = NULL;
static int16_t i_64;
static int16_t len_35;
static int16_t i_65;
static char * tmp_result_57 = NULL;
static int16_t i_66;
static int16_t len_36;
static int16_t i_67;
static char * tmp_result_59 = NULL;
static int16_t i_68;
static int16_t len_37;
static int16_t i_69;
static char * tmp_result_60 = NULL;
static int16_t i_70;
static int16_t len_38;
static int16_t i_71;
static char * tmp_result_61 = NULL;
static int16_t i_72;
static int16_t len_39;
static int16_t i_73;
static char * tmp_result_62 = NULL;
static int16_t i_74;
static int16_t len_40;
static int16_t i_75;
static int16_t len_41;
static int16_t i_76;
static int16_t i_77;
static char * tmp_result_63 = NULL;
static int16_t i_78;
static int16_t len_42;
static int16_t i_79;
static int16_t len_43;
static int16_t i_80;
static int16_t i_81;
static char * tmp_result_64 = NULL;
static int16_t i_82;
static int16_t len_44;
static int16_t i_83;
static int16_t len_45;
static int16_t i_84;
static int16_t i_85;
static char * tmp_result_66 = NULL;
static int16_t i_86;
static int16_t len_46;
static int16_t i_87;
static char * tmp_result_65 = NULL;
static int16_t i_88;
static int16_t len_47;
static int16_t i_89;
static char * tmp_result_67 = NULL;
static int16_t i_90;
static int16_t len_48;
static int16_t i_91;
static char * tmp_result_68 = NULL;
static int16_t i_92;
static int16_t len_49;
static int16_t i_93;
static char * tmp_result_69 = NULL;
static int16_t i_94;
static int16_t len_50;
static int16_t i_95;
static char * tmp_result_70 = NULL;
static int16_t i_96;
static int16_t len_51;
static int16_t i_97;
static int16_t len_52;
static int16_t i_98;
static int16_t i_99;
static char * tmp_result_71 = NULL;
static int16_t i_100;
static int16_t len_53;
static int16_t i_101;
static int16_t len_54;
static int16_t i_102;
static int16_t i_103;
static char * tmp_result_73 = NULL;
static int16_t i_104;
static int16_t len_55;
static int16_t i_105;
static char * tmp_result_72 = NULL;
static int16_t i_106;
static int16_t len_56;
static int16_t i_107;
static char * tmp_result_74 = NULL;
static int16_t i_108;
static int16_t len_57;
static int16_t i_109;
static char * tmp_result_75 = NULL;
static int16_t i_110;
static int16_t len_58;
static int16_t i_111;
static char * tmp_result_76 = NULL;
static int16_t i_112;
static int16_t len_59;
static int16_t i_113;
static char * tmp_result_78 = NULL;
static int16_t i_114;
static int16_t len_60;
static int16_t i_115;
static char * tmp_result_77 = NULL;
static int16_t i_116;
static int16_t len_61;
static int16_t i_117;
static char * tmp_result_79 = NULL;
static int16_t i_118;
static int16_t len_62;
static int16_t i_119;
static char * tmp_result_80 = NULL;
static int16_t i_120;
static int16_t len_63;
static int16_t i_121;
static char * tmp_result_81 = NULL;
static int16_t i_122;
static int16_t len_64;
static int16_t i_123;
static char * tmp_result_82 = NULL;
static int16_t i_124;
static int16_t len_65;
static int16_t i_125;
static char * tmp_result_83 = NULL;
static int16_t i_126;
static int16_t len_66;
static int16_t i_127;
static char * tmp_result_84 = NULL;
static int16_t i_128;
static int16_t len_67;
static int16_t i_129;
static char * tmp_result_85 = NULL;
static char * tmp_result_86 = NULL;
static char * tmp_result_87 = NULL;
static char * tmp_result_88 = NULL;
static char * tmp_result_89 = NULL;
static char * tmp_result_90 = NULL;

void log(struct js_var x)
{
    const char * tmp_str;
    uint8_t tmp_need_dispose;

    printf("%s\n", tmp_str = js_var_to_str(x, &tmp_need_dispose));
    if (tmp_need_dispose)
        free((void *)tmp_str);
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);
    ARRAY_CREATE(err_defs, 2, 0);

    num = 10;
    str = "some";
    str_num = "88";
    bool1 = TRUE;
    bool2 = FALSE;
    ARRAY_CREATE(static_array1, 3, 3);
    static_array1->data[0] = js_var_from_int16_t(1);
    static_array1->data[1] = js_var_from_int16_t(2);
    static_array1->data[2] = js_var_from_int16_t(3);
    ARRAY_CREATE(static_array2, 2, 1);
    static_array2->data[0] = js_var_from_int16_t(99);
    ARRAY_CREATE(dynamic_array1, 3, 3);
    dynamic_array1->data[0] = js_var_from_int16_t(1);
    dynamic_array1->data[1] = js_var_from_int16_t(2);
    dynamic_array1->data[2] = js_var_from_int16_t(3);
    ARRAY_PUSH(dynamic_array1, js_var_from_int16_t(4));
    ARRAY_PUSH(dynamic_array1, js_var_from_int16_t(5));
    ARRAY_CREATE(dynamic_array2, 2, 0);
    ARRAY_PUSH(dynamic_array2, js_var_from_int16_t(111));
    ARRAY_CREATE(dynamic_array3, 2, 0);
    DICT_CREATE(obj, 4);
    DICT_SET(obj, "a", js_var_from_int16_t(10));
    DICT_SET(obj, "b", js_var_from_str("test"));
    DICT_CREATE(dict, 4);
    tmp_result = malloc(strlen("test") + STR_INT16_T_BUFLEN + 1);
    assert(tmp_result != NULL);
    tmp_result[0] = '\0';
    strcat(tmp_result, "test");
    str_int16_t_cat(tmp_result, static_array1->size);
    DICT_SET(dict, tmp_result, js_var_from_int16_t(123));
    v_null = js_var_from(JS_VAR_NULL);
    v_undefined = js_var_from(JS_VAR_UNDEFINED);
    v_nan = js_var_from(JS_VAR_NAN);
    v_num = js_var_from(JS_VAR_NULL);
    v_num = js_var_from_int16_t(10);
    v_str = js_var_from(JS_VAR_NULL);
    v_str = js_var_from_str("hello there");
    v_str_num = js_var_from(JS_VAR_NULL);
    v_str_num = js_var_from_str("23");
    v_bool1 = js_var_from(JS_VAR_NULL);
    v_bool1 = js_var_from_uint8_t(TRUE);
    v_bool2 = js_var_from(JS_VAR_NULL);
    v_bool2 = js_var_from_uint8_t(TRUE);
    v_arr1 = js_var_from(JS_VAR_NULL);
    ARRAY_CREATE(tmp_array, 3, 3);
    tmp_array->data[0] = js_var_from_int16_t(100);
    tmp_array->data[1] = js_var_from_int16_t(200);
    tmp_array->data[2] = js_var_from_int16_t(300);
    v_arr1 = js_var_from_array(tmp_array);
    v_arr2 = js_var_from(JS_VAR_NULL);
    ARRAY_CREATE(tmp_array_2, 2, 1);
    tmp_array_2->data[0] = js_var_from_int16_t(77);
    v_arr2 = js_var_from_array(tmp_array_2);
    v_arr3 = js_var_from(JS_VAR_NULL);
    ARRAY_CREATE(tmp_array_3, 2, 0);
    v_arr3 = js_var_from_array(tmp_array_3);
    v_dict1 = js_var_from(JS_VAR_NULL);
    DICT_CREATE(tmp_obj, 4);
    DICT_SET(tmp_obj, "a", js_var_from_int16_t(66));
    DICT_SET(tmp_obj, "b", js_var_from_str("55"));
    DICT_SET(tmp_obj, "c", js_var_from_str("hh"));
    v_dict1 = js_var_from_dict(tmp_obj);
    v_dict2 = js_var_from(JS_VAR_NULL);
    DICT_CREATE(tmp_obj_2, 4);
    v_dict2 = js_var_from_dict(tmp_obj_2);
    log(js_var_from_int16_t(num + 9));
    tmp_result_2 = malloc(STR_INT16_T_BUFLEN + strlen(str) + 1);
    assert(tmp_result_2 != NULL);
    tmp_result_2[0] = '\0';
    str_int16_t_cat(tmp_result_2, num);
    strcat(tmp_result_2, str);
    ARRAY_PUSH(gc_main, tmp_result_2);
    log(js_var_from_str(tmp_result_2));
    tmp_result_3 = malloc(STR_INT16_T_BUFLEN + strlen(str_num) + 1);
    assert(tmp_result_3 != NULL);
    tmp_result_3[0] = '\0';
    str_int16_t_cat(tmp_result_3, num);
    strcat(tmp_result_3, str_num);
    ARRAY_PUSH(gc_main, tmp_result_3);
    log(js_var_from_str(tmp_result_3));
    log(js_var_from_int16_t(num + bool1));
    log(js_var_from_int16_t(bool2 + num));
    len = static_array1->size;
    for (i = 0; i < static_array1->size; i++) {
        len += strlen(tmp = js_var_to_str(static_array1->data[i], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_4 = malloc(STR_INT16_T_BUFLEN + len + 1);
    assert(tmp_result_4 != NULL);
    tmp_result_4[0] = '\0';
    str_int16_t_cat(tmp_result_4, num);
    for (j = 0; j < static_array1->size; j++) {
        if (j != 0)
            strcat(tmp_result_4, ",");
        strcat(tmp_result_4, (tmp = js_var_to_str(static_array1->data[j], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_4);
    log(js_var_from_str(tmp_result_4));
    log(js_var_plus(js_var_from_int16_t(num), static_array1->data[1], gc_main));
    len_2 = static_array2->size;
    for (k = 0; k < static_array2->size; k++) {
        len_2 += strlen(tmp = js_var_to_str(static_array2->data[k], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_5 = malloc(len_2 + STR_INT16_T_BUFLEN + 1);
    assert(tmp_result_5 != NULL);
    tmp_result_5[0] = '\0';
    for (l = 0; l < static_array2->size; l++) {
        if (l != 0)
            strcat(tmp_result_5, ",");
        strcat(tmp_result_5, (tmp = js_var_to_str(static_array2->data[l], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    str_int16_t_cat(tmp_result_5, num);
    ARRAY_PUSH(gc_main, tmp_result_5);
    log(js_var_from_str(tmp_result_5));
    len_3 = dynamic_array1->size;
    for (m = 0; m < dynamic_array1->size; m++) {
        len_3 += strlen(tmp = js_var_to_str(dynamic_array1->data[m], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_6 = malloc(STR_INT16_T_BUFLEN + len_3 + 1);
    assert(tmp_result_6 != NULL);
    tmp_result_6[0] = '\0';
    str_int16_t_cat(tmp_result_6, num);
    for (n = 0; n < dynamic_array1->size; n++) {
        if (n != 0)
            strcat(tmp_result_6, ",");
        strcat(tmp_result_6, (tmp = js_var_to_str(dynamic_array1->data[n], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_6);
    log(js_var_from_str(tmp_result_6));
    len_4 = dynamic_array2->size;
    for (i_2 = 0; i_2 < dynamic_array2->size; i_2++) {
        len_4 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_2], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_7 = malloc(len_4 + STR_INT16_T_BUFLEN + 1);
    assert(tmp_result_7 != NULL);
    tmp_result_7[0] = '\0';
    for (i_3 = 0; i_3 < dynamic_array2->size; i_3++) {
        if (i_3 != 0)
            strcat(tmp_result_7, ",");
        strcat(tmp_result_7, (tmp = js_var_to_str(dynamic_array2->data[i_3], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    str_int16_t_cat(tmp_result_7, num);
    ARRAY_PUSH(gc_main, tmp_result_7);
    log(js_var_from_str(tmp_result_7));
    len_5 = dynamic_array3->size;
    for (i_4 = 0; i_4 < dynamic_array3->size; i_4++) {
        len_5 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_4], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_8 = malloc(STR_INT16_T_BUFLEN + len_5 + 1);
    assert(tmp_result_8 != NULL);
    tmp_result_8[0] = '\0';
    str_int16_t_cat(tmp_result_8, 11 + num);
    for (i_5 = 0; i_5 < dynamic_array3->size; i_5++) {
        if (i_5 != 0)
            strcat(tmp_result_8, ",");
        strcat(tmp_result_8, (tmp = js_var_to_str(dynamic_array3->data[i_5], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_8);
    log(js_var_from_str(tmp_result_8));
    tmp_result_9 = malloc(STR_INT16_T_BUFLEN + 15 + 1);
    assert(tmp_result_9 != NULL);
    tmp_result_9[0] = '\0';
    str_int16_t_cat(tmp_result_9, num);
    strcat(tmp_result_9, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_9);
    log(js_var_from_str(tmp_result_9));
    log(js_var_plus(js_var_from_int16_t(num), DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    tmp_result_10 = malloc(15 + STR_INT16_T_BUFLEN + 1);
    assert(tmp_result_10 != NULL);
    tmp_result_10[0] = '\0';
    strcat(tmp_result_10, "[object Object]");
    str_int16_t_cat(tmp_result_10, num);
    ARRAY_PUSH(gc_main, tmp_result_10);
    log(js_var_from_str(tmp_result_10));
    log(js_var_plus(DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), js_var_from_int16_t(num), gc_main));
    log(js_var_plus(js_var_from_int16_t(num), v_null, gc_main));
    log(js_var_plus(v_undefined, js_var_from_int16_t(num), gc_main));
    log(js_var_plus(js_var_from_int16_t(num), v_nan, gc_main));
    log(js_var_plus(v_num, js_var_from_int16_t(num), gc_main));
    log(js_var_plus(js_var_from_int16_t(num), v_str, gc_main));
    log(js_var_plus(v_str_num, js_var_from_int16_t(num), gc_main));
    log(js_var_plus(js_var_from_int16_t(num), v_bool1, gc_main));
    log(js_var_plus(v_bool2, js_var_from_int16_t(num), gc_main));
    log(js_var_plus(js_var_from_int16_t(num), v_arr1, gc_main));
    log(js_var_plus(v_arr2, js_var_from_int16_t(num), gc_main));
    log(js_var_plus(js_var_from_int16_t(11 + num), v_arr3, gc_main));
    log(js_var_plus(js_var_from_int16_t(num), v_dict1, gc_main));
    log(js_var_plus(js_var_from_int16_t(num), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_int16_t(num), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_int16_t(num), gc_main));
    tmp_result_11 = malloc(STR_INT16_T_BUFLEN + strlen(str) + 1);
    assert(tmp_result_11 != NULL);
    tmp_result_11[0] = '\0';
    str_int16_t_cat(tmp_result_11, 9);
    strcat(tmp_result_11, str);
    ARRAY_PUSH(gc_main, tmp_result_11);
    log(js_var_from_str(tmp_result_11));
    tmp_result_12 = malloc(strlen(str) + strlen(str_num) + 1);
    assert(tmp_result_12 != NULL);
    tmp_result_12[0] = '\0';
    strcat(tmp_result_12, str);
    strcat(tmp_result_12, str_num);
    ARRAY_PUSH(gc_main, tmp_result_12);
    log(js_var_from_str(tmp_result_12));
    tmp_result_13 = malloc((5-bool1) + strlen(str) + 1);
    assert(tmp_result_13 != NULL);
    tmp_result_13[0] = '\0';
    strcat(tmp_result_13, bool1 ? "true" : "false");
    strcat(tmp_result_13, str);
    ARRAY_PUSH(gc_main, tmp_result_13);
    log(js_var_from_str(tmp_result_13));
    tmp_result_14 = malloc(strlen(str) + (5-bool2) + 1);
    assert(tmp_result_14 != NULL);
    tmp_result_14[0] = '\0';
    strcat(tmp_result_14, str);
    strcat(tmp_result_14, bool2 ? "true" : "false");
    ARRAY_PUSH(gc_main, tmp_result_14);
    log(js_var_from_str(tmp_result_14));
    len_6 = static_array1->size;
    for (i_6 = 0; i_6 < static_array1->size; i_6++) {
        len_6 += strlen(tmp = js_var_to_str(static_array1->data[i_6], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_15 = malloc(len_6 + strlen(str) + 1);
    assert(tmp_result_15 != NULL);
    tmp_result_15[0] = '\0';
    for (i_7 = 0; i_7 < static_array1->size; i_7++) {
        if (i_7 != 0)
            strcat(tmp_result_15, ",");
        strcat(tmp_result_15, (tmp = js_var_to_str(static_array1->data[i_7], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_15, str);
    ARRAY_PUSH(gc_main, tmp_result_15);
    log(js_var_from_str(tmp_result_15));
    log(js_var_plus(static_array1->data[1], js_var_from_str(str), gc_main));
    len_7 = static_array2->size;
    for (i_8 = 0; i_8 < static_array2->size; i_8++) {
        len_7 += strlen(tmp = js_var_to_str(static_array2->data[i_8], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_16 = malloc(strlen(str) + len_7 + 1);
    assert(tmp_result_16 != NULL);
    tmp_result_16[0] = '\0';
    strcat(tmp_result_16, str);
    for (i_9 = 0; i_9 < static_array2->size; i_9++) {
        if (i_9 != 0)
            strcat(tmp_result_16, ",");
        strcat(tmp_result_16, (tmp = js_var_to_str(static_array2->data[i_9], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_16);
    log(js_var_from_str(tmp_result_16));
    len_8 = dynamic_array1->size;
    for (i_10 = 0; i_10 < dynamic_array1->size; i_10++) {
        len_8 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_10], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_17 = malloc(len_8 + strlen(str) + 1);
    assert(tmp_result_17 != NULL);
    tmp_result_17[0] = '\0';
    for (i_11 = 0; i_11 < dynamic_array1->size; i_11++) {
        if (i_11 != 0)
            strcat(tmp_result_17, ",");
        strcat(tmp_result_17, (tmp = js_var_to_str(dynamic_array1->data[i_11], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_17, str);
    ARRAY_PUSH(gc_main, tmp_result_17);
    log(js_var_from_str(tmp_result_17));
    len_9 = dynamic_array2->size;
    for (i_12 = 0; i_12 < dynamic_array2->size; i_12++) {
        len_9 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_12], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_18 = malloc(strlen(str) + len_9 + 1);
    assert(tmp_result_18 != NULL);
    tmp_result_18[0] = '\0';
    strcat(tmp_result_18, str);
    for (i_13 = 0; i_13 < dynamic_array2->size; i_13++) {
        if (i_13 != 0)
            strcat(tmp_result_18, ",");
        strcat(tmp_result_18, (tmp = js_var_to_str(dynamic_array2->data[i_13], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_18);
    log(js_var_from_str(tmp_result_18));
    len_10 = dynamic_array3->size;
    for (i_14 = 0; i_14 < dynamic_array3->size; i_14++) {
        len_10 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_14], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_20 = malloc(STR_INT16_T_BUFLEN + len_10 + 1);
    assert(tmp_result_20 != NULL);
    tmp_result_20[0] = '\0';
    str_int16_t_cat(tmp_result_20, 11);
    for (i_15 = 0; i_15 < dynamic_array3->size; i_15++) {
        if (i_15 != 0)
            strcat(tmp_result_20, ",");
        strcat(tmp_result_20, (tmp = js_var_to_str(dynamic_array3->data[i_15], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_19 = malloc(strlen(tmp_result_20) + strlen(str) + 1);
    assert(tmp_result_19 != NULL);
    tmp_result_19[0] = '\0';
    strcat(tmp_result_19, tmp_result_20);
    strcat(tmp_result_19, str);
    ARRAY_PUSH(gc_main, tmp_result_19);
    log(js_var_from_str(tmp_result_19));
    tmp_result_21 = malloc(15 + strlen(str) + 1);
    assert(tmp_result_21 != NULL);
    tmp_result_21[0] = '\0';
    strcat(tmp_result_21, "[object Object]");
    strcat(tmp_result_21, str);
    ARRAY_PUSH(gc_main, tmp_result_21);
    log(js_var_from_str(tmp_result_21));
    log(js_var_plus(DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), js_var_from_str(str), gc_main));
    tmp_result_22 = malloc(strlen(str) + 15 + 1);
    assert(tmp_result_22 != NULL);
    tmp_result_22[0] = '\0';
    strcat(tmp_result_22, str);
    strcat(tmp_result_22, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_22);
    log(js_var_from_str(tmp_result_22));
    log(js_var_plus(js_var_from_str(str), DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    log(js_var_plus(v_null, js_var_from_str(str), gc_main));
    log(js_var_plus(js_var_from_str(str), v_undefined, gc_main));
    log(js_var_plus(v_nan, js_var_from_str(str), gc_main));
    log(js_var_plus(js_var_from_str(str), v_num, gc_main));
    log(js_var_plus(v_str, js_var_from_str(str), gc_main));
    log(js_var_plus(js_var_from_str(str), v_str_num, gc_main));
    log(js_var_plus(v_bool1, js_var_from_str(str), gc_main));
    log(js_var_plus(js_var_from_str(str), v_bool2, gc_main));
    log(js_var_plus(v_arr1, js_var_from_str(str), gc_main));
    log(js_var_plus(js_var_from_str(str), v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), js_var_from_str(str), gc_main));
    log(js_var_plus(js_var_from_str(str), v_dict1, gc_main));
    log(js_var_plus(js_var_from_str(str), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_str(str), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_str(str), gc_main));
    tmp_result_23 = malloc(strlen(str_num) + STR_INT16_T_BUFLEN + 1);
    assert(tmp_result_23 != NULL);
    tmp_result_23[0] = '\0';
    strcat(tmp_result_23, str_num);
    str_int16_t_cat(tmp_result_23, 9);
    ARRAY_PUSH(gc_main, tmp_result_23);
    log(js_var_from_str(tmp_result_23));
    tmp_result_24 = malloc(strlen(str_num) + strlen(str_num) + 1);
    assert(tmp_result_24 != NULL);
    tmp_result_24[0] = '\0';
    strcat(tmp_result_24, str_num);
    strcat(tmp_result_24, str_num);
    ARRAY_PUSH(gc_main, tmp_result_24);
    log(js_var_from_str(tmp_result_24));
    tmp_result_25 = malloc(strlen(str_num) + (5-bool1) + 1);
    assert(tmp_result_25 != NULL);
    tmp_result_25[0] = '\0';
    strcat(tmp_result_25, str_num);
    strcat(tmp_result_25, bool1 ? "true" : "false");
    ARRAY_PUSH(gc_main, tmp_result_25);
    log(js_var_from_str(tmp_result_25));
    tmp_result_26 = malloc((5-bool2) + strlen(str_num) + 1);
    assert(tmp_result_26 != NULL);
    tmp_result_26[0] = '\0';
    strcat(tmp_result_26, bool2 ? "true" : "false");
    strcat(tmp_result_26, str_num);
    ARRAY_PUSH(gc_main, tmp_result_26);
    log(js_var_from_str(tmp_result_26));
    len_11 = static_array1->size;
    for (i_16 = 0; i_16 < static_array1->size; i_16++) {
        len_11 += strlen(tmp = js_var_to_str(static_array1->data[i_16], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_27 = malloc(strlen(str_num) + len_11 + 1);
    assert(tmp_result_27 != NULL);
    tmp_result_27[0] = '\0';
    strcat(tmp_result_27, str_num);
    for (i_17 = 0; i_17 < static_array1->size; i_17++) {
        if (i_17 != 0)
            strcat(tmp_result_27, ",");
        strcat(tmp_result_27, (tmp = js_var_to_str(static_array1->data[i_17], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_27);
    log(js_var_from_str(tmp_result_27));
    log(js_var_plus(js_var_from_str(str_num), static_array1->data[1], gc_main));
    len_12 = static_array2->size;
    for (i_18 = 0; i_18 < static_array2->size; i_18++) {
        len_12 += strlen(tmp = js_var_to_str(static_array2->data[i_18], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_28 = malloc(len_12 + strlen(str_num) + 1);
    assert(tmp_result_28 != NULL);
    tmp_result_28[0] = '\0';
    for (i_19 = 0; i_19 < static_array2->size; i_19++) {
        if (i_19 != 0)
            strcat(tmp_result_28, ",");
        strcat(tmp_result_28, (tmp = js_var_to_str(static_array2->data[i_19], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_28, str_num);
    ARRAY_PUSH(gc_main, tmp_result_28);
    log(js_var_from_str(tmp_result_28));
    len_13 = dynamic_array1->size;
    for (i_20 = 0; i_20 < dynamic_array1->size; i_20++) {
        len_13 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_20], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_29 = malloc(strlen(str_num) + len_13 + 1);
    assert(tmp_result_29 != NULL);
    tmp_result_29[0] = '\0';
    strcat(tmp_result_29, str_num);
    for (i_21 = 0; i_21 < dynamic_array1->size; i_21++) {
        if (i_21 != 0)
            strcat(tmp_result_29, ",");
        strcat(tmp_result_29, (tmp = js_var_to_str(dynamic_array1->data[i_21], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_29);
    log(js_var_from_str(tmp_result_29));
    len_14 = dynamic_array2->size;
    for (i_22 = 0; i_22 < dynamic_array2->size; i_22++) {
        len_14 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_22], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_30 = malloc(len_14 + strlen(str_num) + 1);
    assert(tmp_result_30 != NULL);
    tmp_result_30[0] = '\0';
    for (i_23 = 0; i_23 < dynamic_array2->size; i_23++) {
        if (i_23 != 0)
            strcat(tmp_result_30, ",");
        strcat(tmp_result_30, (tmp = js_var_to_str(dynamic_array2->data[i_23], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_30, str_num);
    ARRAY_PUSH(gc_main, tmp_result_30);
    log(js_var_from_str(tmp_result_30));
    tmp_result_32 = malloc(STR_INT16_T_BUFLEN + strlen(str_num) + 1);
    assert(tmp_result_32 != NULL);
    tmp_result_32[0] = '\0';
    str_int16_t_cat(tmp_result_32, 11);
    strcat(tmp_result_32, str_num);
    len_15 = dynamic_array3->size;
    for (i_24 = 0; i_24 < dynamic_array3->size; i_24++) {
        len_15 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_24], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_31 = malloc(strlen(tmp_result_32) + len_15 + 1);
    assert(tmp_result_31 != NULL);
    tmp_result_31[0] = '\0';
    strcat(tmp_result_31, tmp_result_32);
    for (i_25 = 0; i_25 < dynamic_array3->size; i_25++) {
        if (i_25 != 0)
            strcat(tmp_result_31, ",");
        strcat(tmp_result_31, (tmp = js_var_to_str(dynamic_array3->data[i_25], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_31);
    log(js_var_from_str(tmp_result_31));
    tmp_result_33 = malloc(strlen(str_num) + 15 + 1);
    assert(tmp_result_33 != NULL);
    tmp_result_33[0] = '\0';
    strcat(tmp_result_33, str_num);
    strcat(tmp_result_33, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_33);
    log(js_var_from_str(tmp_result_33));
    log(js_var_plus(js_var_from_str(str_num), DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    tmp_result_34 = malloc(15 + strlen(str_num) + 1);
    assert(tmp_result_34 != NULL);
    tmp_result_34[0] = '\0';
    strcat(tmp_result_34, "[object Object]");
    strcat(tmp_result_34, str_num);
    ARRAY_PUSH(gc_main, tmp_result_34);
    log(js_var_from_str(tmp_result_34));
    log(js_var_plus(DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), js_var_from_str(str_num), gc_main));
    log(js_var_plus(js_var_from_str(str_num), v_null, gc_main));
    log(js_var_plus(v_undefined, js_var_from_str(str_num), gc_main));
    log(js_var_plus(js_var_from_str(str_num), v_nan, gc_main));
    log(js_var_plus(v_num, js_var_from_str(str_num), gc_main));
    log(js_var_plus(js_var_from_str(str_num), v_str, gc_main));
    log(js_var_plus(v_str_num, js_var_from_str(str_num), gc_main));
    log(js_var_plus(js_var_from_str(str_num), v_bool1, gc_main));
    log(js_var_plus(v_bool2, js_var_from_str(str_num), gc_main));
    log(js_var_plus(js_var_from_str(str_num), v_arr1, gc_main));
    log(js_var_plus(v_arr2, js_var_from_str(str_num), gc_main));
    tmp_result_35 = malloc(STR_INT16_T_BUFLEN + strlen(str_num) + 1);
    assert(tmp_result_35 != NULL);
    tmp_result_35[0] = '\0';
    str_int16_t_cat(tmp_result_35, 11);
    strcat(tmp_result_35, str_num);
    log(js_var_plus(js_var_from_str(tmp_result_35), v_arr3, gc_main));
    log(js_var_plus(js_var_from_str(str_num), v_dict1, gc_main));
    log(js_var_plus(js_var_from_str(str_num), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_str(str_num), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_int16_t(num), gc_main));
    log(js_var_from_int16_t(9 + bool1));
    log(js_var_from_int16_t(bool1 + bool1));
    log(js_var_from_int16_t(bool1 + bool2));
    len_16 = static_array1->size;
    for (i_26 = 0; i_26 < static_array1->size; i_26++) {
        len_16 += strlen(tmp = js_var_to_str(static_array1->data[i_26], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_36 = malloc(len_16 + (5-bool1) + 1);
    assert(tmp_result_36 != NULL);
    tmp_result_36[0] = '\0';
    for (i_27 = 0; i_27 < static_array1->size; i_27++) {
        if (i_27 != 0)
            strcat(tmp_result_36, ",");
        strcat(tmp_result_36, (tmp = js_var_to_str(static_array1->data[i_27], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_36, bool1 ? "true" : "false");
    ARRAY_PUSH(gc_main, tmp_result_36);
    log(js_var_from_str(tmp_result_36));
    log(js_var_plus(static_array1->data[1], js_var_from_uint8_t(bool1), gc_main));
    len_17 = static_array2->size;
    for (i_28 = 0; i_28 < static_array2->size; i_28++) {
        len_17 += strlen(tmp = js_var_to_str(static_array2->data[i_28], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_37 = malloc((5-bool1) + len_17 + 1);
    assert(tmp_result_37 != NULL);
    tmp_result_37[0] = '\0';
    strcat(tmp_result_37, bool1 ? "true" : "false");
    for (i_29 = 0; i_29 < static_array2->size; i_29++) {
        if (i_29 != 0)
            strcat(tmp_result_37, ",");
        strcat(tmp_result_37, (tmp = js_var_to_str(static_array2->data[i_29], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_37);
    log(js_var_from_str(tmp_result_37));
    len_18 = dynamic_array1->size;
    for (i_30 = 0; i_30 < dynamic_array1->size; i_30++) {
        len_18 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_30], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_38 = malloc(len_18 + (5-bool1) + 1);
    assert(tmp_result_38 != NULL);
    tmp_result_38[0] = '\0';
    for (i_31 = 0; i_31 < dynamic_array1->size; i_31++) {
        if (i_31 != 0)
            strcat(tmp_result_38, ",");
        strcat(tmp_result_38, (tmp = js_var_to_str(dynamic_array1->data[i_31], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_38, bool1 ? "true" : "false");
    ARRAY_PUSH(gc_main, tmp_result_38);
    log(js_var_from_str(tmp_result_38));
    len_19 = dynamic_array2->size;
    for (i_32 = 0; i_32 < dynamic_array2->size; i_32++) {
        len_19 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_32], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_39 = malloc((5-bool1) + len_19 + 1);
    assert(tmp_result_39 != NULL);
    tmp_result_39[0] = '\0';
    strcat(tmp_result_39, bool1 ? "true" : "false");
    for (i_33 = 0; i_33 < dynamic_array2->size; i_33++) {
        if (i_33 != 0)
            strcat(tmp_result_39, ",");
        strcat(tmp_result_39, (tmp = js_var_to_str(dynamic_array2->data[i_33], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_39);
    log(js_var_from_str(tmp_result_39));
    len_20 = dynamic_array3->size;
    for (i_34 = 0; i_34 < dynamic_array3->size; i_34++) {
        len_20 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_34], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_41 = malloc(STR_INT16_T_BUFLEN + len_20 + 1);
    assert(tmp_result_41 != NULL);
    tmp_result_41[0] = '\0';
    str_int16_t_cat(tmp_result_41, 11);
    for (i_35 = 0; i_35 < dynamic_array3->size; i_35++) {
        if (i_35 != 0)
            strcat(tmp_result_41, ",");
        strcat(tmp_result_41, (tmp = js_var_to_str(dynamic_array3->data[i_35], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_40 = malloc(strlen(tmp_result_41) + (5-bool1) + 1);
    assert(tmp_result_40 != NULL);
    tmp_result_40[0] = '\0';
    strcat(tmp_result_40, tmp_result_41);
    strcat(tmp_result_40, bool1 ? "true" : "false");
    ARRAY_PUSH(gc_main, tmp_result_40);
    log(js_var_from_str(tmp_result_40));
    tmp_result_42 = malloc(15 + (5-bool1) + 1);
    assert(tmp_result_42 != NULL);
    tmp_result_42[0] = '\0';
    strcat(tmp_result_42, "[object Object]");
    strcat(tmp_result_42, bool1 ? "true" : "false");
    ARRAY_PUSH(gc_main, tmp_result_42);
    log(js_var_from_str(tmp_result_42));
    log(js_var_plus(DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), js_var_from_uint8_t(bool1), gc_main));
    tmp_result_43 = malloc((5-bool1) + 15 + 1);
    assert(tmp_result_43 != NULL);
    tmp_result_43[0] = '\0';
    strcat(tmp_result_43, bool1 ? "true" : "false");
    strcat(tmp_result_43, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_43);
    log(js_var_from_str(tmp_result_43));
    log(js_var_plus(js_var_from_uint8_t(bool1), DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    log(js_var_plus(v_null, js_var_from_uint8_t(bool1), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool1), v_undefined, gc_main));
    log(js_var_plus(v_nan, js_var_from_uint8_t(bool1), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool1), v_num, gc_main));
    log(js_var_plus(v_str, js_var_from_uint8_t(bool1), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool1), v_str_num, gc_main));
    log(js_var_plus(v_bool1, js_var_from_uint8_t(bool1), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool1), v_bool2, gc_main));
    log(js_var_plus(v_arr1, js_var_from_uint8_t(bool1), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool1), v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), js_var_from_uint8_t(bool1), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool1), v_dict1, gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool1), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_uint8_t(bool1), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_uint8_t(bool1), gc_main));
    log(js_var_from_int16_t(9 + bool2));
    len_21 = static_array1->size;
    for (i_36 = 0; i_36 < static_array1->size; i_36++) {
        len_21 += strlen(tmp = js_var_to_str(static_array1->data[i_36], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_44 = malloc(len_21 + (5-bool2) + 1);
    assert(tmp_result_44 != NULL);
    tmp_result_44[0] = '\0';
    for (i_37 = 0; i_37 < static_array1->size; i_37++) {
        if (i_37 != 0)
            strcat(tmp_result_44, ",");
        strcat(tmp_result_44, (tmp = js_var_to_str(static_array1->data[i_37], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_44, bool2 ? "true" : "false");
    ARRAY_PUSH(gc_main, tmp_result_44);
    log(js_var_from_str(tmp_result_44));
    log(js_var_plus(static_array1->data[1], js_var_from_uint8_t(bool2), gc_main));
    len_22 = static_array2->size;
    for (i_38 = 0; i_38 < static_array2->size; i_38++) {
        len_22 += strlen(tmp = js_var_to_str(static_array2->data[i_38], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_45 = malloc((5-bool2) + len_22 + 1);
    assert(tmp_result_45 != NULL);
    tmp_result_45[0] = '\0';
    strcat(tmp_result_45, bool2 ? "true" : "false");
    for (i_39 = 0; i_39 < static_array2->size; i_39++) {
        if (i_39 != 0)
            strcat(tmp_result_45, ",");
        strcat(tmp_result_45, (tmp = js_var_to_str(static_array2->data[i_39], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_45);
    log(js_var_from_str(tmp_result_45));
    len_23 = dynamic_array1->size;
    for (i_40 = 0; i_40 < dynamic_array1->size; i_40++) {
        len_23 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_40], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_46 = malloc(len_23 + (5-bool2) + 1);
    assert(tmp_result_46 != NULL);
    tmp_result_46[0] = '\0';
    for (i_41 = 0; i_41 < dynamic_array1->size; i_41++) {
        if (i_41 != 0)
            strcat(tmp_result_46, ",");
        strcat(tmp_result_46, (tmp = js_var_to_str(dynamic_array1->data[i_41], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_46, bool2 ? "true" : "false");
    ARRAY_PUSH(gc_main, tmp_result_46);
    log(js_var_from_str(tmp_result_46));
    len_24 = dynamic_array2->size;
    for (i_42 = 0; i_42 < dynamic_array2->size; i_42++) {
        len_24 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_42], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_47 = malloc((5-bool2) + len_24 + 1);
    assert(tmp_result_47 != NULL);
    tmp_result_47[0] = '\0';
    strcat(tmp_result_47, bool2 ? "true" : "false");
    for (i_43 = 0; i_43 < dynamic_array2->size; i_43++) {
        if (i_43 != 0)
            strcat(tmp_result_47, ",");
        strcat(tmp_result_47, (tmp = js_var_to_str(dynamic_array2->data[i_43], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_47);
    log(js_var_from_str(tmp_result_47));
    len_25 = dynamic_array3->size;
    for (i_44 = 0; i_44 < dynamic_array3->size; i_44++) {
        len_25 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_44], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_49 = malloc(STR_INT16_T_BUFLEN + len_25 + 1);
    assert(tmp_result_49 != NULL);
    tmp_result_49[0] = '\0';
    str_int16_t_cat(tmp_result_49, 11);
    for (i_45 = 0; i_45 < dynamic_array3->size; i_45++) {
        if (i_45 != 0)
            strcat(tmp_result_49, ",");
        strcat(tmp_result_49, (tmp = js_var_to_str(dynamic_array3->data[i_45], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_48 = malloc(strlen(tmp_result_49) + (5-bool2) + 1);
    assert(tmp_result_48 != NULL);
    tmp_result_48[0] = '\0';
    strcat(tmp_result_48, tmp_result_49);
    strcat(tmp_result_48, bool2 ? "true" : "false");
    ARRAY_PUSH(gc_main, tmp_result_48);
    log(js_var_from_str(tmp_result_48));
    tmp_result_50 = malloc(15 + (5-bool2) + 1);
    assert(tmp_result_50 != NULL);
    tmp_result_50[0] = '\0';
    strcat(tmp_result_50, "[object Object]");
    strcat(tmp_result_50, bool2 ? "true" : "false");
    ARRAY_PUSH(gc_main, tmp_result_50);
    log(js_var_from_str(tmp_result_50));
    log(js_var_plus(DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), js_var_from_uint8_t(bool2), gc_main));
    tmp_result_51 = malloc((5-bool2) + 15 + 1);
    assert(tmp_result_51 != NULL);
    tmp_result_51[0] = '\0';
    strcat(tmp_result_51, bool2 ? "true" : "false");
    strcat(tmp_result_51, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_51);
    log(js_var_from_str(tmp_result_51));
    log(js_var_plus(js_var_from_uint8_t(bool2), DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    log(js_var_plus(v_null, js_var_from_uint8_t(bool2), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool2), v_undefined, gc_main));
    log(js_var_plus(v_nan, js_var_from_uint8_t(bool2), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool2), v_num, gc_main));
    log(js_var_plus(v_str, js_var_from_uint8_t(bool2), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool2), v_str_num, gc_main));
    log(js_var_plus(v_bool1, js_var_from_uint8_t(bool2), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool2), v_bool2, gc_main));
    log(js_var_plus(v_arr1, js_var_from_uint8_t(bool2), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool2), v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), js_var_from_uint8_t(bool2), gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool2), v_dict1, gc_main));
    log(js_var_plus(js_var_from_uint8_t(bool2), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_uint8_t(bool2), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_uint8_t(bool2), gc_main));
    len_26 = static_array1->size;
    for (i_46 = 0; i_46 < static_array1->size; i_46++) {
        len_26 += strlen(tmp = js_var_to_str(static_array1->data[i_46], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_52 = malloc(STR_INT16_T_BUFLEN + len_26 + 1);
    assert(tmp_result_52 != NULL);
    tmp_result_52[0] = '\0';
    str_int16_t_cat(tmp_result_52, 9);
    for (i_47 = 0; i_47 < static_array1->size; i_47++) {
        if (i_47 != 0)
            strcat(tmp_result_52, ",");
        strcat(tmp_result_52, (tmp = js_var_to_str(static_array1->data[i_47], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_52);
    log(js_var_from_str(tmp_result_52));
    len_27 = static_array1->size;
    for (i_48 = 0; i_48 < static_array1->size; i_48++) {
        len_27 += strlen(tmp = js_var_to_str(static_array1->data[i_48], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    len_28 = static_array1->size;
    for (i_49 = 0; i_49 < static_array1->size; i_49++) {
        len_28 += strlen(tmp = js_var_to_str(static_array1->data[i_49], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_53 = malloc(len_27 + len_28 + 1);
    assert(tmp_result_53 != NULL);
    tmp_result_53[0] = '\0';
    for (i_50 = 0; i_50 < static_array1->size; i_50++) {
        if (i_50 != 0)
            strcat(tmp_result_53, ",");
        strcat(tmp_result_53, (tmp = js_var_to_str(static_array1->data[i_50], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    for (i_51 = 0; i_51 < static_array1->size; i_51++) {
        if (i_51 != 0)
            strcat(tmp_result_53, ",");
        strcat(tmp_result_53, (tmp = js_var_to_str(static_array1->data[i_51], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_53);
    log(js_var_from_str(tmp_result_53));
    log(js_var_plus(static_array1->data[1], js_var_from_array(static_array1), gc_main));
    len_29 = static_array1->size;
    for (i_52 = 0; i_52 < static_array1->size; i_52++) {
        len_29 += strlen(tmp = js_var_to_str(static_array1->data[i_52], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    len_30 = static_array2->size;
    for (i_53 = 0; i_53 < static_array2->size; i_53++) {
        len_30 += strlen(tmp = js_var_to_str(static_array2->data[i_53], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_54 = malloc(len_29 + len_30 + 1);
    assert(tmp_result_54 != NULL);
    tmp_result_54[0] = '\0';
    for (i_54 = 0; i_54 < static_array1->size; i_54++) {
        if (i_54 != 0)
            strcat(tmp_result_54, ",");
        strcat(tmp_result_54, (tmp = js_var_to_str(static_array1->data[i_54], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    for (i_55 = 0; i_55 < static_array2->size; i_55++) {
        if (i_55 != 0)
            strcat(tmp_result_54, ",");
        strcat(tmp_result_54, (tmp = js_var_to_str(static_array2->data[i_55], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_54);
    log(js_var_from_str(tmp_result_54));
    len_31 = dynamic_array1->size;
    for (i_56 = 0; i_56 < dynamic_array1->size; i_56++) {
        len_31 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_56], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    len_32 = static_array1->size;
    for (i_57 = 0; i_57 < static_array1->size; i_57++) {
        len_32 += strlen(tmp = js_var_to_str(static_array1->data[i_57], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_55 = malloc(len_31 + len_32 + 1);
    assert(tmp_result_55 != NULL);
    tmp_result_55[0] = '\0';
    for (i_58 = 0; i_58 < dynamic_array1->size; i_58++) {
        if (i_58 != 0)
            strcat(tmp_result_55, ",");
        strcat(tmp_result_55, (tmp = js_var_to_str(dynamic_array1->data[i_58], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    for (i_59 = 0; i_59 < static_array1->size; i_59++) {
        if (i_59 != 0)
            strcat(tmp_result_55, ",");
        strcat(tmp_result_55, (tmp = js_var_to_str(static_array1->data[i_59], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_55);
    log(js_var_from_str(tmp_result_55));
    len_33 = static_array1->size;
    for (i_60 = 0; i_60 < static_array1->size; i_60++) {
        len_33 += strlen(tmp = js_var_to_str(static_array1->data[i_60], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    len_34 = dynamic_array2->size;
    for (i_61 = 0; i_61 < dynamic_array2->size; i_61++) {
        len_34 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_61], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_56 = malloc(len_33 + len_34 + 1);
    assert(tmp_result_56 != NULL);
    tmp_result_56[0] = '\0';
    for (i_62 = 0; i_62 < static_array1->size; i_62++) {
        if (i_62 != 0)
            strcat(tmp_result_56, ",");
        strcat(tmp_result_56, (tmp = js_var_to_str(static_array1->data[i_62], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    for (i_63 = 0; i_63 < dynamic_array2->size; i_63++) {
        if (i_63 != 0)
            strcat(tmp_result_56, ",");
        strcat(tmp_result_56, (tmp = js_var_to_str(dynamic_array2->data[i_63], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_56);
    log(js_var_from_str(tmp_result_56));
    len_35 = dynamic_array3->size;
    for (i_64 = 0; i_64 < dynamic_array3->size; i_64++) {
        len_35 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_64], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_58 = malloc(STR_INT16_T_BUFLEN + len_35 + 1);
    assert(tmp_result_58 != NULL);
    tmp_result_58[0] = '\0';
    str_int16_t_cat(tmp_result_58, 11);
    for (i_65 = 0; i_65 < dynamic_array3->size; i_65++) {
        if (i_65 != 0)
            strcat(tmp_result_58, ",");
        strcat(tmp_result_58, (tmp = js_var_to_str(dynamic_array3->data[i_65], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    len_36 = static_array1->size;
    for (i_66 = 0; i_66 < static_array1->size; i_66++) {
        len_36 += strlen(tmp = js_var_to_str(static_array1->data[i_66], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_57 = malloc(strlen(tmp_result_58) + len_36 + 1);
    assert(tmp_result_57 != NULL);
    tmp_result_57[0] = '\0';
    strcat(tmp_result_57, tmp_result_58);
    for (i_67 = 0; i_67 < static_array1->size; i_67++) {
        if (i_67 != 0)
            strcat(tmp_result_57, ",");
        strcat(tmp_result_57, (tmp = js_var_to_str(static_array1->data[i_67], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_57);
    log(js_var_from_str(tmp_result_57));
    len_37 = static_array1->size;
    for (i_68 = 0; i_68 < static_array1->size; i_68++) {
        len_37 += strlen(tmp = js_var_to_str(static_array1->data[i_68], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_59 = malloc(15 + len_37 + 1);
    assert(tmp_result_59 != NULL);
    tmp_result_59[0] = '\0';
    strcat(tmp_result_59, "[object Object]");
    for (i_69 = 0; i_69 < static_array1->size; i_69++) {
        if (i_69 != 0)
            strcat(tmp_result_59, ",");
        strcat(tmp_result_59, (tmp = js_var_to_str(static_array1->data[i_69], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_59);
    log(js_var_from_str(tmp_result_59));
    log(js_var_plus(DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), js_var_from_array(static_array1), gc_main));
    len_38 = static_array1->size;
    for (i_70 = 0; i_70 < static_array1->size; i_70++) {
        len_38 += strlen(tmp = js_var_to_str(static_array1->data[i_70], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_60 = malloc(len_38 + 15 + 1);
    assert(tmp_result_60 != NULL);
    tmp_result_60[0] = '\0';
    for (i_71 = 0; i_71 < static_array1->size; i_71++) {
        if (i_71 != 0)
            strcat(tmp_result_60, ",");
        strcat(tmp_result_60, (tmp = js_var_to_str(static_array1->data[i_71], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_60, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_60);
    log(js_var_from_str(tmp_result_60));
    log(js_var_plus(js_var_from_array(static_array1), DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    log(js_var_plus(v_null, js_var_from_array(static_array1), gc_main));
    log(js_var_plus(js_var_from_array(static_array1), v_undefined, gc_main));
    log(js_var_plus(v_nan, js_var_from_array(static_array1), gc_main));
    log(js_var_plus(js_var_from_array(static_array1), v_num, gc_main));
    log(js_var_plus(v_str, js_var_from_array(static_array1), gc_main));
    log(js_var_plus(js_var_from_array(static_array1), v_str_num, gc_main));
    log(js_var_plus(v_bool1, js_var_from_array(static_array1), gc_main));
    log(js_var_plus(js_var_from_array(static_array1), v_bool2, gc_main));
    log(js_var_plus(v_arr1, js_var_from_array(static_array1), gc_main));
    log(js_var_plus(js_var_from_array(static_array1), v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), js_var_from_array(static_array1), gc_main));
    log(js_var_plus(js_var_from_array(static_array1), v_dict1, gc_main));
    log(js_var_plus(js_var_from_array(static_array1), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_array(static_array1), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_array(static_array1), gc_main));
    len_39 = static_array2->size;
    for (i_72 = 0; i_72 < static_array2->size; i_72++) {
        len_39 += strlen(tmp = js_var_to_str(static_array2->data[i_72], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_61 = malloc(STR_INT16_T_BUFLEN + len_39 + 1);
    assert(tmp_result_61 != NULL);
    tmp_result_61[0] = '\0';
    str_int16_t_cat(tmp_result_61, 9);
    for (i_73 = 0; i_73 < static_array2->size; i_73++) {
        if (i_73 != 0)
            strcat(tmp_result_61, ",");
        strcat(tmp_result_61, (tmp = js_var_to_str(static_array2->data[i_73], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_61);
    log(js_var_from_str(tmp_result_61));
    len_40 = static_array2->size;
    for (i_74 = 0; i_74 < static_array2->size; i_74++) {
        len_40 += strlen(tmp = js_var_to_str(static_array2->data[i_74], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    len_41 = static_array2->size;
    for (i_75 = 0; i_75 < static_array2->size; i_75++) {
        len_41 += strlen(tmp = js_var_to_str(static_array2->data[i_75], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_62 = malloc(len_40 + len_41 + 1);
    assert(tmp_result_62 != NULL);
    tmp_result_62[0] = '\0';
    for (i_76 = 0; i_76 < static_array2->size; i_76++) {
        if (i_76 != 0)
            strcat(tmp_result_62, ",");
        strcat(tmp_result_62, (tmp = js_var_to_str(static_array2->data[i_76], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    for (i_77 = 0; i_77 < static_array2->size; i_77++) {
        if (i_77 != 0)
            strcat(tmp_result_62, ",");
        strcat(tmp_result_62, (tmp = js_var_to_str(static_array2->data[i_77], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_62);
    log(js_var_from_str(tmp_result_62));
    len_42 = dynamic_array1->size;
    for (i_78 = 0; i_78 < dynamic_array1->size; i_78++) {
        len_42 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_78], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    len_43 = static_array2->size;
    for (i_79 = 0; i_79 < static_array2->size; i_79++) {
        len_43 += strlen(tmp = js_var_to_str(static_array2->data[i_79], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_63 = malloc(len_42 + len_43 + 1);
    assert(tmp_result_63 != NULL);
    tmp_result_63[0] = '\0';
    for (i_80 = 0; i_80 < dynamic_array1->size; i_80++) {
        if (i_80 != 0)
            strcat(tmp_result_63, ",");
        strcat(tmp_result_63, (tmp = js_var_to_str(dynamic_array1->data[i_80], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    for (i_81 = 0; i_81 < static_array2->size; i_81++) {
        if (i_81 != 0)
            strcat(tmp_result_63, ",");
        strcat(tmp_result_63, (tmp = js_var_to_str(static_array2->data[i_81], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_63);
    log(js_var_from_str(tmp_result_63));
    len_44 = static_array2->size;
    for (i_82 = 0; i_82 < static_array2->size; i_82++) {
        len_44 += strlen(tmp = js_var_to_str(static_array2->data[i_82], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    len_45 = dynamic_array2->size;
    for (i_83 = 0; i_83 < dynamic_array2->size; i_83++) {
        len_45 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_83], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_64 = malloc(len_44 + len_45 + 1);
    assert(tmp_result_64 != NULL);
    tmp_result_64[0] = '\0';
    for (i_84 = 0; i_84 < static_array2->size; i_84++) {
        if (i_84 != 0)
            strcat(tmp_result_64, ",");
        strcat(tmp_result_64, (tmp = js_var_to_str(static_array2->data[i_84], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    for (i_85 = 0; i_85 < dynamic_array2->size; i_85++) {
        if (i_85 != 0)
            strcat(tmp_result_64, ",");
        strcat(tmp_result_64, (tmp = js_var_to_str(dynamic_array2->data[i_85], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_64);
    log(js_var_from_str(tmp_result_64));
    len_46 = dynamic_array3->size;
    for (i_86 = 0; i_86 < dynamic_array3->size; i_86++) {
        len_46 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_86], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_66 = malloc(STR_INT16_T_BUFLEN + len_46 + 1);
    assert(tmp_result_66 != NULL);
    tmp_result_66[0] = '\0';
    str_int16_t_cat(tmp_result_66, 11);
    for (i_87 = 0; i_87 < dynamic_array3->size; i_87++) {
        if (i_87 != 0)
            strcat(tmp_result_66, ",");
        strcat(tmp_result_66, (tmp = js_var_to_str(dynamic_array3->data[i_87], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    len_47 = static_array2->size;
    for (i_88 = 0; i_88 < static_array2->size; i_88++) {
        len_47 += strlen(tmp = js_var_to_str(static_array2->data[i_88], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_65 = malloc(strlen(tmp_result_66) + len_47 + 1);
    assert(tmp_result_65 != NULL);
    tmp_result_65[0] = '\0';
    strcat(tmp_result_65, tmp_result_66);
    for (i_89 = 0; i_89 < static_array2->size; i_89++) {
        if (i_89 != 0)
            strcat(tmp_result_65, ",");
        strcat(tmp_result_65, (tmp = js_var_to_str(static_array2->data[i_89], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_65);
    log(js_var_from_str(tmp_result_65));
    len_48 = static_array2->size;
    for (i_90 = 0; i_90 < static_array2->size; i_90++) {
        len_48 += strlen(tmp = js_var_to_str(static_array2->data[i_90], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_67 = malloc(15 + len_48 + 1);
    assert(tmp_result_67 != NULL);
    tmp_result_67[0] = '\0';
    strcat(tmp_result_67, "[object Object]");
    for (i_91 = 0; i_91 < static_array2->size; i_91++) {
        if (i_91 != 0)
            strcat(tmp_result_67, ",");
        strcat(tmp_result_67, (tmp = js_var_to_str(static_array2->data[i_91], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_67);
    log(js_var_from_str(tmp_result_67));
    log(js_var_plus(DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), js_var_from_array(static_array2), gc_main));
    len_49 = static_array2->size;
    for (i_92 = 0; i_92 < static_array2->size; i_92++) {
        len_49 += strlen(tmp = js_var_to_str(static_array2->data[i_92], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_68 = malloc(len_49 + 15 + 1);
    assert(tmp_result_68 != NULL);
    tmp_result_68[0] = '\0';
    for (i_93 = 0; i_93 < static_array2->size; i_93++) {
        if (i_93 != 0)
            strcat(tmp_result_68, ",");
        strcat(tmp_result_68, (tmp = js_var_to_str(static_array2->data[i_93], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_68, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_68);
    log(js_var_from_str(tmp_result_68));
    log(js_var_plus(js_var_from_array(static_array2), DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    log(js_var_plus(v_null, js_var_from_array(static_array2), gc_main));
    log(js_var_plus(js_var_from_array(static_array2), v_undefined, gc_main));
    log(js_var_plus(v_nan, js_var_from_array(static_array2), gc_main));
    log(js_var_plus(js_var_from_array(static_array2), v_num, gc_main));
    log(js_var_plus(v_str, js_var_from_array(static_array2), gc_main));
    log(js_var_plus(js_var_from_array(static_array2), v_str_num, gc_main));
    log(js_var_plus(v_bool1, js_var_from_array(static_array2), gc_main));
    log(js_var_plus(js_var_from_array(static_array2), v_bool2, gc_main));
    log(js_var_plus(v_arr1, js_var_from_array(static_array2), gc_main));
    log(js_var_plus(js_var_from_array(static_array2), v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), js_var_from_array(static_array2), gc_main));
    log(js_var_plus(js_var_from_array(static_array2), v_dict1, gc_main));
    log(js_var_plus(js_var_from_array(static_array2), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_array(static_array2), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_array(static_array2), gc_main));
    len_50 = dynamic_array1->size;
    for (i_94 = 0; i_94 < dynamic_array1->size; i_94++) {
        len_50 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_94], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_69 = malloc(STR_INT16_T_BUFLEN + len_50 + 1);
    assert(tmp_result_69 != NULL);
    tmp_result_69[0] = '\0';
    str_int16_t_cat(tmp_result_69, 9);
    for (i_95 = 0; i_95 < dynamic_array1->size; i_95++) {
        if (i_95 != 0)
            strcat(tmp_result_69, ",");
        strcat(tmp_result_69, (tmp = js_var_to_str(dynamic_array1->data[i_95], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_69);
    log(js_var_from_str(tmp_result_69));
    len_51 = dynamic_array1->size;
    for (i_96 = 0; i_96 < dynamic_array1->size; i_96++) {
        len_51 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_96], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    len_52 = dynamic_array1->size;
    for (i_97 = 0; i_97 < dynamic_array1->size; i_97++) {
        len_52 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_97], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_70 = malloc(len_51 + len_52 + 1);
    assert(tmp_result_70 != NULL);
    tmp_result_70[0] = '\0';
    for (i_98 = 0; i_98 < dynamic_array1->size; i_98++) {
        if (i_98 != 0)
            strcat(tmp_result_70, ",");
        strcat(tmp_result_70, (tmp = js_var_to_str(dynamic_array1->data[i_98], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    for (i_99 = 0; i_99 < dynamic_array1->size; i_99++) {
        if (i_99 != 0)
            strcat(tmp_result_70, ",");
        strcat(tmp_result_70, (tmp = js_var_to_str(dynamic_array1->data[i_99], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_70);
    log(js_var_from_str(tmp_result_70));
    len_53 = dynamic_array1->size;
    for (i_100 = 0; i_100 < dynamic_array1->size; i_100++) {
        len_53 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_100], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    len_54 = dynamic_array2->size;
    for (i_101 = 0; i_101 < dynamic_array2->size; i_101++) {
        len_54 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_101], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_71 = malloc(len_53 + len_54 + 1);
    assert(tmp_result_71 != NULL);
    tmp_result_71[0] = '\0';
    for (i_102 = 0; i_102 < dynamic_array1->size; i_102++) {
        if (i_102 != 0)
            strcat(tmp_result_71, ",");
        strcat(tmp_result_71, (tmp = js_var_to_str(dynamic_array1->data[i_102], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    for (i_103 = 0; i_103 < dynamic_array2->size; i_103++) {
        if (i_103 != 0)
            strcat(tmp_result_71, ",");
        strcat(tmp_result_71, (tmp = js_var_to_str(dynamic_array2->data[i_103], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_71);
    log(js_var_from_str(tmp_result_71));
    len_55 = dynamic_array3->size;
    for (i_104 = 0; i_104 < dynamic_array3->size; i_104++) {
        len_55 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_104], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_73 = malloc(STR_INT16_T_BUFLEN + len_55 + 1);
    assert(tmp_result_73 != NULL);
    tmp_result_73[0] = '\0';
    str_int16_t_cat(tmp_result_73, 11);
    for (i_105 = 0; i_105 < dynamic_array3->size; i_105++) {
        if (i_105 != 0)
            strcat(tmp_result_73, ",");
        strcat(tmp_result_73, (tmp = js_var_to_str(dynamic_array3->data[i_105], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    len_56 = dynamic_array1->size;
    for (i_106 = 0; i_106 < dynamic_array1->size; i_106++) {
        len_56 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_106], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_72 = malloc(strlen(tmp_result_73) + len_56 + 1);
    assert(tmp_result_72 != NULL);
    tmp_result_72[0] = '\0';
    strcat(tmp_result_72, tmp_result_73);
    for (i_107 = 0; i_107 < dynamic_array1->size; i_107++) {
        if (i_107 != 0)
            strcat(tmp_result_72, ",");
        strcat(tmp_result_72, (tmp = js_var_to_str(dynamic_array1->data[i_107], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_72);
    log(js_var_from_str(tmp_result_72));
    len_57 = dynamic_array1->size;
    for (i_108 = 0; i_108 < dynamic_array1->size; i_108++) {
        len_57 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_108], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_74 = malloc(15 + len_57 + 1);
    assert(tmp_result_74 != NULL);
    tmp_result_74[0] = '\0';
    strcat(tmp_result_74, "[object Object]");
    for (i_109 = 0; i_109 < dynamic_array1->size; i_109++) {
        if (i_109 != 0)
            strcat(tmp_result_74, ",");
        strcat(tmp_result_74, (tmp = js_var_to_str(dynamic_array1->data[i_109], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_74);
    log(js_var_from_str(tmp_result_74));
    log(js_var_plus(DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), js_var_from_array(dynamic_array1), gc_main));
    len_58 = dynamic_array1->size;
    for (i_110 = 0; i_110 < dynamic_array1->size; i_110++) {
        len_58 += strlen(tmp = js_var_to_str(dynamic_array1->data[i_110], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_75 = malloc(len_58 + 15 + 1);
    assert(tmp_result_75 != NULL);
    tmp_result_75[0] = '\0';
    for (i_111 = 0; i_111 < dynamic_array1->size; i_111++) {
        if (i_111 != 0)
            strcat(tmp_result_75, ",");
        strcat(tmp_result_75, (tmp = js_var_to_str(dynamic_array1->data[i_111], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_75, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_75);
    log(js_var_from_str(tmp_result_75));
    log(js_var_plus(js_var_from_array(dynamic_array1), DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    log(js_var_plus(v_null, js_var_from_array(dynamic_array1), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array1), v_undefined, gc_main));
    log(js_var_plus(v_nan, js_var_from_array(dynamic_array1), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array1), v_num, gc_main));
    log(js_var_plus(v_str, js_var_from_array(dynamic_array1), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array1), v_str_num, gc_main));
    log(js_var_plus(v_bool1, js_var_from_array(dynamic_array1), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array1), v_bool2, gc_main));
    log(js_var_plus(v_arr1, js_var_from_array(dynamic_array1), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array1), v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), js_var_from_array(dynamic_array1), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array1), v_dict1, gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array1), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_array(dynamic_array1), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_array(dynamic_array1), gc_main));
    len_59 = dynamic_array2->size;
    for (i_112 = 0; i_112 < dynamic_array2->size; i_112++) {
        len_59 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_112], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_76 = malloc(STR_INT16_T_BUFLEN + len_59 + 1);
    assert(tmp_result_76 != NULL);
    tmp_result_76[0] = '\0';
    str_int16_t_cat(tmp_result_76, 9);
    for (i_113 = 0; i_113 < dynamic_array2->size; i_113++) {
        if (i_113 != 0)
            strcat(tmp_result_76, ",");
        strcat(tmp_result_76, (tmp = js_var_to_str(dynamic_array2->data[i_113], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_76);
    log(js_var_from_str(tmp_result_76));
    len_60 = dynamic_array3->size;
    for (i_114 = 0; i_114 < dynamic_array3->size; i_114++) {
        len_60 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_114], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_78 = malloc(STR_INT16_T_BUFLEN + len_60 + 1);
    assert(tmp_result_78 != NULL);
    tmp_result_78[0] = '\0';
    str_int16_t_cat(tmp_result_78, 11);
    for (i_115 = 0; i_115 < dynamic_array3->size; i_115++) {
        if (i_115 != 0)
            strcat(tmp_result_78, ",");
        strcat(tmp_result_78, (tmp = js_var_to_str(dynamic_array3->data[i_115], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    len_61 = dynamic_array2->size;
    for (i_116 = 0; i_116 < dynamic_array2->size; i_116++) {
        len_61 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_116], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_77 = malloc(strlen(tmp_result_78) + len_61 + 1);
    assert(tmp_result_77 != NULL);
    tmp_result_77[0] = '\0';
    strcat(tmp_result_77, tmp_result_78);
    for (i_117 = 0; i_117 < dynamic_array2->size; i_117++) {
        if (i_117 != 0)
            strcat(tmp_result_77, ",");
        strcat(tmp_result_77, (tmp = js_var_to_str(dynamic_array2->data[i_117], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_77);
    log(js_var_from_str(tmp_result_77));
    len_62 = dynamic_array2->size;
    for (i_118 = 0; i_118 < dynamic_array2->size; i_118++) {
        len_62 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_118], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_79 = malloc(15 + len_62 + 1);
    assert(tmp_result_79 != NULL);
    tmp_result_79[0] = '\0';
    strcat(tmp_result_79, "[object Object]");
    for (i_119 = 0; i_119 < dynamic_array2->size; i_119++) {
        if (i_119 != 0)
            strcat(tmp_result_79, ",");
        strcat(tmp_result_79, (tmp = js_var_to_str(dynamic_array2->data[i_119], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_79);
    log(js_var_from_str(tmp_result_79));
    log(js_var_plus(DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), js_var_from_array(dynamic_array2), gc_main));
    len_63 = dynamic_array2->size;
    for (i_120 = 0; i_120 < dynamic_array2->size; i_120++) {
        len_63 += strlen(tmp = js_var_to_str(dynamic_array2->data[i_120], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_80 = malloc(len_63 + 15 + 1);
    assert(tmp_result_80 != NULL);
    tmp_result_80[0] = '\0';
    for (i_121 = 0; i_121 < dynamic_array2->size; i_121++) {
        if (i_121 != 0)
            strcat(tmp_result_80, ",");
        strcat(tmp_result_80, (tmp = js_var_to_str(dynamic_array2->data[i_121], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_80, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_80);
    log(js_var_from_str(tmp_result_80));
    log(js_var_plus(js_var_from_array(dynamic_array2), DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    log(js_var_plus(v_null, js_var_from_array(dynamic_array2), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array2), v_undefined, gc_main));
    log(js_var_plus(v_nan, js_var_from_array(dynamic_array2), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array2), v_num, gc_main));
    log(js_var_plus(v_str, js_var_from_array(dynamic_array2), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array2), v_str_num, gc_main));
    log(js_var_plus(v_bool1, js_var_from_array(dynamic_array2), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array2), v_bool2, gc_main));
    log(js_var_plus(v_arr1, js_var_from_array(dynamic_array2), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array2), v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), js_var_from_array(dynamic_array2), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array2), v_dict1, gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array2), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_array(dynamic_array2), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_array(dynamic_array2), gc_main));
    len_64 = dynamic_array3->size;
    for (i_122 = 0; i_122 < dynamic_array3->size; i_122++) {
        len_64 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_122], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_81 = malloc(len_64 + STR_INT16_T_BUFLEN + 1);
    assert(tmp_result_81 != NULL);
    tmp_result_81[0] = '\0';
    for (i_123 = 0; i_123 < dynamic_array3->size; i_123++) {
        if (i_123 != 0)
            strcat(tmp_result_81, ",");
        strcat(tmp_result_81, (tmp = js_var_to_str(dynamic_array3->data[i_123], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    str_int16_t_cat(tmp_result_81, 9);
    ARRAY_PUSH(gc_main, tmp_result_81);
    log(js_var_from_str(tmp_result_81));
    len_65 = dynamic_array3->size;
    for (i_124 = 0; i_124 < dynamic_array3->size; i_124++) {
        len_65 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_124], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_82 = malloc(len_65 + 15 + 1);
    assert(tmp_result_82 != NULL);
    tmp_result_82[0] = '\0';
    for (i_125 = 0; i_125 < dynamic_array3->size; i_125++) {
        if (i_125 != 0)
            strcat(tmp_result_82, ",");
        strcat(tmp_result_82, (tmp = js_var_to_str(dynamic_array3->data[i_125], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    strcat(tmp_result_82, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_82);
    log(js_var_from_str(tmp_result_82));
    log(js_var_plus(js_var_from_array(dynamic_array3), DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    len_66 = dynamic_array3->size;
    for (i_126 = 0; i_126 < dynamic_array3->size; i_126++) {
        len_66 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_126], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_83 = malloc(15 + len_66 + 1);
    assert(tmp_result_83 != NULL);
    tmp_result_83[0] = '\0';
    strcat(tmp_result_83, "[object Object]");
    for (i_127 = 0; i_127 < dynamic_array3->size; i_127++) {
        if (i_127 != 0)
            strcat(tmp_result_83, ",");
        strcat(tmp_result_83, (tmp = js_var_to_str(dynamic_array3->data[i_127], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    ARRAY_PUSH(gc_main, tmp_result_83);
    log(js_var_from_str(tmp_result_83));
    log(js_var_plus(DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), js_var_from_array(dynamic_array3), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array3), v_null, gc_main));
    log(js_var_plus(v_undefined, js_var_from_array(dynamic_array3), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array3), v_nan, gc_main));
    log(js_var_plus(v_num, js_var_from_array(dynamic_array3), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array3), v_str, gc_main));
    log(js_var_plus(v_str_num, js_var_from_array(dynamic_array3), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array3), v_bool1, gc_main));
    log(js_var_plus(v_bool2, js_var_from_array(dynamic_array3), gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array3), v_arr1, gc_main));
    log(js_var_plus(v_arr2, js_var_from_array(dynamic_array3), gc_main));
    len_67 = dynamic_array3->size;
    for (i_128 = 0; i_128 < dynamic_array3->size; i_128++) {
        len_67 += strlen(tmp = js_var_to_str(dynamic_array3->data[i_128], &need_dispose));
        if (need_dispose)
            free((void *)tmp);
    }
    tmp_result_84 = malloc(STR_INT16_T_BUFLEN + len_67 + 1);
    assert(tmp_result_84 != NULL);
    tmp_result_84[0] = '\0';
    str_int16_t_cat(tmp_result_84, 11);
    for (i_129 = 0; i_129 < dynamic_array3->size; i_129++) {
        if (i_129 != 0)
            strcat(tmp_result_84, ",");
        strcat(tmp_result_84, (tmp = js_var_to_str(dynamic_array3->data[i_129], &need_dispose)));
        if (need_dispose)
            free((void *)tmp);
    }
    log(js_var_plus(js_var_from_str(tmp_result_84), v_arr3, gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array3), v_dict1, gc_main));
    log(js_var_plus(js_var_from_array(dynamic_array3), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_array(dynamic_array3), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_array(dynamic_array3), gc_main));
    tmp_result_85 = malloc(15 + STR_INT16_T_BUFLEN + 1);
    assert(tmp_result_85 != NULL);
    tmp_result_85[0] = '\0';
    strcat(tmp_result_85, "[object Object]");
    str_int16_t_cat(tmp_result_85, 9);
    ARRAY_PUSH(gc_main, tmp_result_85);
    log(js_var_from_str(tmp_result_85));
    tmp_result_86 = malloc(15 + 15 + 1);
    assert(tmp_result_86 != NULL);
    tmp_result_86[0] = '\0';
    strcat(tmp_result_86, "[object Object]");
    strcat(tmp_result_86, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_86);
    log(js_var_from_str(tmp_result_86));
    log(js_var_plus(js_var_from_dict(obj), DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    tmp_result_87 = malloc(15 + 15 + 1);
    assert(tmp_result_87 != NULL);
    tmp_result_87[0] = '\0';
    strcat(tmp_result_87, "[object Object]");
    strcat(tmp_result_87, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_87);
    log(js_var_from_str(tmp_result_87));
    log(js_var_plus(DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), js_var_from_dict(obj), gc_main));
    log(js_var_plus(js_var_from_dict(obj), v_null, gc_main));
    log(js_var_plus(v_undefined, js_var_from_dict(obj), gc_main));
    log(js_var_plus(js_var_from_dict(obj), v_nan, gc_main));
    log(js_var_plus(v_num, js_var_from_dict(obj), gc_main));
    log(js_var_plus(js_var_from_dict(obj), v_str, gc_main));
    log(js_var_plus(v_str_num, js_var_from_dict(obj), gc_main));
    log(js_var_plus(js_var_from_dict(obj), v_bool1, gc_main));
    log(js_var_plus(v_bool2, js_var_from_dict(obj), gc_main));
    log(js_var_plus(js_var_from_dict(obj), v_arr1, gc_main));
    log(js_var_plus(v_arr2, js_var_from_dict(obj), gc_main));
    tmp_result_88 = malloc(STR_INT16_T_BUFLEN + 15 + 1);
    assert(tmp_result_88 != NULL);
    tmp_result_88[0] = '\0';
    str_int16_t_cat(tmp_result_88, 11);
    strcat(tmp_result_88, "[object Object]");
    log(js_var_plus(js_var_from_str(tmp_result_88), v_arr3, gc_main));
    log(js_var_plus(js_var_from_dict(obj), v_dict1, gc_main));
    log(js_var_plus(js_var_from_dict(obj), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_dict(obj), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_dict(obj), gc_main));
    tmp_result_89 = malloc(STR_INT16_T_BUFLEN + 15 + 1);
    assert(tmp_result_89 != NULL);
    tmp_result_89[0] = '\0';
    str_int16_t_cat(tmp_result_89, 9);
    strcat(tmp_result_89, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_89);
    log(js_var_from_str(tmp_result_89));
    tmp_result_90 = malloc(15 + 15 + 1);
    assert(tmp_result_90 != NULL);
    tmp_result_90[0] = '\0';
    strcat(tmp_result_90, "[object Object]");
    strcat(tmp_result_90, "[object Object]");
    ARRAY_PUSH(gc_main, tmp_result_90);
    log(js_var_from_str(tmp_result_90));
    log(js_var_plus(js_var_from_dict(dict), DICT_GET(dict, "test3", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    log(js_var_plus(v_null, js_var_from_dict(dict), gc_main));
    log(js_var_plus(js_var_from_dict(dict), v_undefined, gc_main));
    log(js_var_plus(v_nan, js_var_from_dict(dict), gc_main));
    log(js_var_plus(js_var_from_dict(dict), v_num, gc_main));
    log(js_var_plus(v_str, js_var_from_dict(dict), gc_main));
    log(js_var_plus(js_var_from_dict(dict), v_str_num, gc_main));
    log(js_var_plus(v_bool1, js_var_from_dict(dict), gc_main));
    log(js_var_plus(js_var_from_dict(dict), v_bool2, gc_main));
    log(js_var_plus(v_arr1, js_var_from_dict(dict), gc_main));
    log(js_var_plus(js_var_from_dict(dict), v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), js_var_from_dict(dict), gc_main));
    log(js_var_plus(js_var_from_dict(dict), v_dict1, gc_main));
    log(js_var_plus(js_var_from_dict(dict), js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, js_var_from_dict(dict), gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), js_var_from_dict(dict), gc_main));
    log(js_var_plus(js_var_from_int16_t(9), v_null, gc_main));
    log(js_var_plus(v_null, v_null, gc_main));
    log(js_var_plus(v_null, v_undefined, gc_main));
    log(js_var_plus(v_nan, v_null, gc_main));
    log(js_var_plus(v_null, v_num, gc_main));
    log(js_var_plus(v_str, v_null, gc_main));
    log(js_var_plus(v_null, v_str_num, gc_main));
    log(js_var_plus(v_bool1, v_null, gc_main));
    log(js_var_plus(v_null, v_bool2, gc_main));
    log(js_var_plus(v_arr1, v_null, gc_main));
    log(js_var_plus(v_null, v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), v_null, gc_main));
    log(js_var_plus(v_null, v_dict1, gc_main));
    log(js_var_plus(v_null, js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, v_null, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_null, gc_main));
    log(js_var_plus(v_undefined, js_var_from_int16_t(9), gc_main));
    log(js_var_plus(v_undefined, v_undefined, gc_main));
    log(js_var_plus(v_undefined, DICT_GET(obj, "a", js_var_from(JS_VAR_UNDEFINED)), gc_main));
    log(js_var_plus(v_undefined, v_nan, gc_main));
    log(js_var_plus(v_num, v_undefined, gc_main));
    log(js_var_plus(v_undefined, v_str, gc_main));
    log(js_var_plus(v_str_num, v_undefined, gc_main));
    log(js_var_plus(v_undefined, v_bool1, gc_main));
    log(js_var_plus(v_bool2, v_undefined, gc_main));
    log(js_var_plus(v_undefined, v_arr1, gc_main));
    log(js_var_plus(v_arr2, v_undefined, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_undefined, gc_main), v_arr3, gc_main));
    log(js_var_plus(v_undefined, v_dict1, gc_main));
    log(js_var_plus(v_undefined, js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, v_undefined, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_undefined, gc_main));
    log(js_var_plus(v_nan, js_var_from_int16_t(9), gc_main));
    log(js_var_plus(v_nan, v_nan, gc_main));
    log(js_var_plus(v_num, v_nan, gc_main));
    log(js_var_plus(v_nan, v_str, gc_main));
    log(js_var_plus(v_str_num, v_nan, gc_main));
    log(js_var_plus(v_nan, v_bool1, gc_main));
    log(js_var_plus(v_bool2, v_nan, gc_main));
    log(js_var_plus(v_nan, v_arr1, gc_main));
    log(js_var_plus(v_arr2, v_nan, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_nan, gc_main), v_arr3, gc_main));
    log(js_var_plus(v_nan, v_dict1, gc_main));
    log(js_var_plus(v_nan, js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, v_nan, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_nan, gc_main));
    log(js_var_plus(js_var_from_int16_t(9), v_num, gc_main));
    log(js_var_plus(v_num, v_num, gc_main));
    log(js_var_plus(v_str, v_num, gc_main));
    log(js_var_plus(v_num, v_str_num, gc_main));
    log(js_var_plus(v_bool1, v_num, gc_main));
    log(js_var_plus(v_num, v_bool2, gc_main));
    log(js_var_plus(v_arr1, v_num, gc_main));
    log(js_var_plus(v_num, v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), v_num, gc_main));
    log(js_var_plus(v_num, v_dict1, gc_main));
    log(js_var_plus(v_num, js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, v_num, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_num, gc_main));
    log(js_var_plus(js_var_from_int16_t(9), v_str, gc_main));
    log(js_var_plus(v_str, v_str, gc_main));
    log(js_var_plus(v_str, v_str_num, gc_main));
    log(js_var_plus(v_bool1, v_str, gc_main));
    log(js_var_plus(v_str, v_bool2, gc_main));
    log(js_var_plus(v_arr1, v_str, gc_main));
    log(js_var_plus(v_str, v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), v_str, gc_main));
    log(js_var_plus(v_str, v_dict1, gc_main));
    log(js_var_plus(v_str, js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, v_str, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_str, gc_main));
    log(js_var_plus(js_var_from_int16_t(9), v_str_num, gc_main));
    log(js_var_plus(v_str_num, v_str_num, gc_main));
    log(js_var_plus(v_bool1, v_str_num, gc_main));
    log(js_var_plus(v_str_num, v_bool2, gc_main));
    log(js_var_plus(v_arr1, v_str_num, gc_main));
    log(js_var_plus(v_str_num, v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), v_str_num, gc_main));
    log(js_var_plus(v_str_num, v_dict1, gc_main));
    log(js_var_plus(v_str_num, js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, v_str_num, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_str_num, gc_main));
    log(js_var_plus(js_var_from_int16_t(9), v_bool1, gc_main));
    log(js_var_plus(v_bool1, v_bool1, gc_main));
    log(js_var_plus(v_bool1, v_bool2, gc_main));
    log(js_var_plus(v_arr1, v_bool1, gc_main));
    log(js_var_plus(v_bool1, v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), v_bool1, gc_main));
    log(js_var_plus(v_bool1, v_dict1, gc_main));
    log(js_var_plus(v_bool1, js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, v_bool1, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_bool1, gc_main));
    log(js_var_plus(js_var_from_int16_t(9), v_arr1, gc_main));
    log(js_var_plus(v_arr1, v_arr1, gc_main));
    log(js_var_plus(v_arr1, v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), v_arr1, gc_main));
    log(js_var_plus(v_arr1, v_dict1, gc_main));
    log(js_var_plus(v_arr1, js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, v_arr1, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_arr1, gc_main));
    log(js_var_plus(js_var_from_int16_t(9), v_arr2, gc_main));
    log(js_var_plus(v_arr2, v_arr2, gc_main));
    log(js_var_plus(js_var_plus(js_var_from_int16_t(11), v_arr3, gc_main), v_arr2, gc_main));
    log(js_var_plus(v_arr2, v_dict1, gc_main));
    log(js_var_plus(v_arr2, js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, v_arr2, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_arr2, gc_main));
    log(js_var_plus(v_dict1, js_var_from_int16_t(9), gc_main));
    log(js_var_plus(v_dict1, v_dict1, gc_main));
    log(js_var_plus(v_dict1, js_var_get(v_dict1, js_var_from_str("a")), gc_main));
    log(js_var_plus(v_dict2, v_dict1, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_dict1, gc_main));
    log(js_var_plus(v_dict2, js_var_from_int16_t(9), gc_main));
    log(js_var_plus(v_dict2, v_dict2, gc_main));
    log(js_var_plus(js_var_get(v_dict2, js_var_from_str("test3")), v_dict2, gc_main));
    free(static_array1->data);
    free(static_array1);
    free(static_array2->data);
    free(static_array2);
    free(dynamic_array1->data);
    free(dynamic_array1);
    free(dynamic_array2->data);
    free(dynamic_array2);
    free(dynamic_array3->data);
    free(dynamic_array3);
    free(obj->index->data);
    free(obj->index);
    free(obj->values->data);
    free(obj->values);
    free(obj);
    free(dict->index->data);
    free(dict->index);
    free(dict->values->data);
    free(dict->values);
    free(dict);
    free((char *)tmp_result);
    free(tmp_array->data);
    free(tmp_array);
    free(tmp_array_2->data);
    free(tmp_array_2);
    free(tmp_array_3->data);
    free(tmp_array_3);
    free(tmp_obj->index->data);
    free(tmp_obj->index);
    free(tmp_obj->values->data);
    free(tmp_obj->values);
    free(tmp_obj);
    free(tmp_obj_2->index->data);
    free(tmp_obj_2->index);
    free(tmp_obj_2->values->data);
    free(tmp_obj_2->values);
    free(tmp_obj_2);
    free((char *)tmp_result_20);
    free((char *)tmp_result_32);
    free((char *)tmp_result_35);
    free((char *)tmp_result_41);
    free((char *)tmp_result_49);
    free((char *)tmp_result_58);
    free((char *)tmp_result_66);
    free((char *)tmp_result_73);
    free((char *)tmp_result_78);
    free((char *)tmp_result_84);
    free((char *)tmp_result_88);
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
