#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

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

struct obj_t {
    void * test;
};
struct tmp_obj_2_t {
    struct obj_t * nested;
};

static struct obj_t * obj;
static DICT(void *) tmp_obj = NULL;
static struct obj_t * temp;
static struct tmp_obj_2_t * tmp_obj_2 = NULL;

int main(void) {
    DICT_CREATE(tmp_obj, 4);
    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    obj->test = tmp_obj;
    temp = obj;
    tmp_obj_2 = malloc(sizeof(*tmp_obj_2));
    assert(tmp_obj_2 != NULL);
    tmp_obj_2->nested = temp;
    obj->test = tmp_obj_2;
    printf("{ ");
    printf("test: [object Object]");
    printf(" }\n");
    free(obj);
    free(tmp_obj->index->data);
    free(tmp_obj->index);
    free(tmp_obj->values->data);
    free(tmp_obj->values);
    free(tmp_obj);
    free(tmp_obj_2);

    return 0;
}
