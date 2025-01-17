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

struct a_t {
    int16_t t;
};
struct a_t_2 {
    int16_t b;
};

static ARRAY(void *) gc_main;
static int16_t gc_i;

static struct a_t * a;
static struct a_t_2 * tmp_obj = NULL;

int16_t getT(struct a_t_2 * a, int16_t b, int16_t c)
{
    return a->b * c;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    a = malloc(sizeof(*a));
    assert(a != NULL);
    a->t = 42;
    tmp_obj = malloc(sizeof(*tmp_obj));
    assert(tmp_obj != NULL);
    ARRAY_PUSH(gc_main, (void *)tmp_obj);
    tmp_obj->b = 96;
    printf("%d\n", getT(tmp_obj, 2, 3));
    free(a);
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
