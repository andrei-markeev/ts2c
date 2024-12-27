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

#define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)

void str_int16_t_cat(char *str, int16_t num) {
    char numstr[STR_INT16_T_BUFLEN];
    sprintf(numstr, "%d", num);
    strcat(str, numstr);
}

static ARRAY(void *) gc_main;

int16_t gc_i;

static const char * (*callback1)(const char *);
static const char * (*callback2)(const char *);

const char * something(const char * (*callback)(const char *))
{
    return callback("something");
}
const char * callback1_func(const char * value)
{
    char * tmp_result = NULL;

    tmp_result = malloc(strlen("first callback ") + strlen(value) + 1);
    assert(tmp_result != NULL);
    tmp_result[0] = '\0';
    strcat(tmp_result, "first callback ");
    strcat(tmp_result, value);
    ARRAY_PUSH(gc_main, tmp_result);
    return tmp_result;
}
const char * callback2_func(const char * value)
{
    char * tmp_result = NULL;

    tmp_result = malloc(strlen("second callback ") + strlen(value) + 1);
    assert(tmp_result != NULL);
    tmp_result[0] = '\0';
    strcat(tmp_result, "second callback ");
    strcat(tmp_result, value);
    ARRAY_PUSH(gc_main, tmp_result);
    return tmp_result;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    callback1 = callback1_func;
    callback2 = callback2_func;
    printf("%s\n", something(callback1));
    printf("%s\n", something(callback2));
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
