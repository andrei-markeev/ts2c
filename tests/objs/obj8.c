#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>

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

struct array_pointer_t {
    int16_t size;
    int16_t capacity;
    void ** data;
};

static struct array_pointer_t *gc_main;
static int16_t gc_i;

static int16_t indices[3] = { 1, 2, 3 };
static const char * values[3] = { "11", "22", "33" };
static DICT(const char *) obj;
static int16_t x;
static int16_t y;

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    DICT_CREATE(obj, 4);
    x = 0;
    for (;x < 3;x++)
    {
        char * tmp;
        tmp = malloc(STR_INT16_T_BUFLEN);
        assert(tmp != NULL);
        sprintf(tmp, "%d", indices[x]);
        ARRAY_PUSH(gc_main, (void *)tmp);
        DICT_SET(obj, tmp, values[x]);
    }
    y = 0;
    for (;y < 3;y++)
    {
        char * tmp_2;
        tmp_2 = malloc(STR_INT16_T_BUFLEN);
        assert(tmp_2 != NULL);
        sprintf(tmp_2, "%d", indices[y]);
        ARRAY_PUSH(gc_main, (void *)tmp_2);
        printf("%s\n", DICT_GET(obj, tmp_2, 0));
    }
    free(obj->index->data);
    free(obj->index);
    free(obj->values->data);
    free(obj->values);
    free(obj);

    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
