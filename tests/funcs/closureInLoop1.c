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

struct scope_t {
    int16_t x;
};
struct closure_t {
    const char * (*func)(struct closure_t *);
    struct scope_t * scope;
};
struct array_closure_t {
    int16_t size;
    int16_t capacity;
    struct closure_t ** data;
};

int16_t gc_i;

static ARRAY(ARRAY(void *)) gc_main_arrays;
static struct array_closure_t * arr;
static int16_t i;

const char * func(struct closure_t * closure)
{
    char * tmp_result = NULL;

    tmp_result = malloc(strlen("number ") + STR_INT16_T_BUFLEN + 1);
    assert(tmp_result != NULL);
    tmp_result[0] = '\0';
    strcat(tmp_result, "number ");
    str_int16_t_cat(tmp_result, closure->scope->x);
    ARRAY_PUSH(gc_main, tmp_result);
    return tmp_result;
}
struct array_closure_t * prepare()
{
    struct scope_t * scope;
    struct array_closure_t * printArr;

    scope = malloc(sizeof(*scope));
    assert(scope != NULL);
    ARRAY_PUSH(gc_main, (void *)scope);

    ARRAY_CREATE(printArr, 2, 0);
    ARRAY_PUSH(gc_main_arrays, (void *)printArr);
    scope->x = 0;
    for (;scope->x < 9;scope->x++)
    {
        struct closure_t * closure;
        closure = malloc(sizeof(*closure));
        assert(closure != NULL);
        ARRAY_PUSH(gc_main, (void *)closure);
        closure->func = func;
        closure->scope = scope;
        ARRAY_PUSH(printArr, closure);
    }
    return printArr;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);
    ARRAY_CREATE(gc_main_arrays, 2, 0);

    arr = ((void *)prepare());
    i = 0;
    for (;i < arr->size;i++)
    {
        struct closure_t * getMessage;
        getMessage = arr->data[i];
        printf("%s\n", getMessage->func(getMessage));
    }
    for (gc_i = 0; gc_i < gc_main_arrays->size; gc_i++) {
        free(gc_main_arrays->data[gc_i]->data);
        free(gc_main_arrays->data[gc_i]);
    }
    free(gc_main_arrays->data);
    free(gc_main_arrays);
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
