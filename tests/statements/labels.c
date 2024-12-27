#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

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

int16_t str_len(const char * str) {
    int16_t len = 0;
    int16_t i = 0;
    while (*str) {
        i = 1;
        if ((*str & 0xE0) == 0xC0) i=2;
        else if ((*str & 0xF0) == 0xE0) i=3;
        else if ((*str & 0xF8) == 0xF0) i=4;
        str += i;
        len += i == 4 ? 2 : 1;
    }
    return len;
}

static int16_t i;
static int16_t j;
static int16_t arr[4] = { 1, 10, 2, 6 };
static int16_t l;
static int16_t el;
static DICT(int16_t) obj;
static int16_t m;
static const char * k;

int main(void) {
    {
        printf("---1\n");
        goto l1_break;
        printf("---2\n");
    }
     l1_break:
    i = 0;
    while(i < 3) {
        for (j = 0;j < 3;j++)
        {
            if (i == 1 && j == 1)
                goto loop1_continue;
            printf("continue i = %d", i);
            printf(", j = %d\n", j);
        }
        loop1_continue:
        i++;
    }
    for (i = 0;i < 3;i++)
        for (j = 0;j < 3;j++)
    {
        if (i == 1 && j == 1)
            goto loop3_break;
        printf("break i = %d", i);
        printf(", j = %d\n", j);
    }
     loop3_break:
    l = 0;
    while (l < 4) {
        el = arr[l];
        for (i = 0;i < el;i++)
        {
            if (i > 3)
                goto loop5_continue;
            printf("for of");
            printf(" %d\n", i);
        }
        loop5_continue:
        l++;
    }
    j = 0;
    while(j < 4) {
        j++;
        for (i = 0;i < arr[j];i++)
        {
            if (i > 1)
                goto loop6_continue;
            printf("while");
            printf(" %d\n", i);
        }
        loop6_continue: ;
    }
    j = 0;
    do {
        j++;
        for (i = 0;i < arr[j];i++)
        {
            if (i > 1)
                goto loop7_continue;
            printf("do while");
            printf(" %d\n", i);
        }
        loop7_continue: ;
    } while (j < 4);
    DICT_CREATE(obj, 4);
    DICT_SET(obj, "egg", 1);
    DICT_SET(obj, "ham", 2);
    DICT_SET(obj, "pizza", 3);
    DICT_SET(obj, "banana", 4);
    m = 0;
    while (m < obj->index->size) {
        k = obj->index->data[m];
        do
        {
            if (str_len(k) > 3)
                goto loop8_continue;
            printf("for in");
            printf(" %s\n", k);
        }
        while (FALSE);
        loop8_continue:
        m++;
    }
    free(obj->index->data);
    free(obj->index);
    free(obj->values->data);
    free(obj->values);
    free(obj);

    return 0;
}
