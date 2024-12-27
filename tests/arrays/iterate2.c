#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

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

struct array_pointer_t {
    int16_t size;
    int16_t capacity;
    void ** data;
};

static struct array_pointer_t * x;
static int16_t i;

int main(void) {
    ARRAY_CREATE(x, 2, 0);
    i = -1;
    for (;++i < x->size;)
        printf("%d\n", i);
    free(x->data);
    free(x);

    return 0;
}
