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

struct array_number_t {
    int16_t size;
    int16_t capacity;
    int16_t* data;
};

static struct array_number_t * a;
static int16_t arr_size;
static int16_t arr_size_2;

int main(void) {
    ARRAY_CREATE(a, 2, 0);
    ARRAY_PUSH(a, 10);
    arr_size = a->size;
    printf("%d\n", arr_size);
    ARRAY_PUSH(a, 2);
    arr_size_2 = a->size;
    if (arr_size_2 == 2)
        printf("length is %d\n", a->size);
    free(a->data);
    free(a);

    return 0;
}
