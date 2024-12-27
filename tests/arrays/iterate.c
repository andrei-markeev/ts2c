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
	#define ARRAY_POP(a) (a->size != 0 ? a->data[--a->size] : 0)

struct array_number_t {
    int16_t size;
    int16_t capacity;
    int16_t* data;
};

static struct array_number_t * a;
static int16_t i;
static int16_t j;
static int16_t elem;

int main(void) {
    ARRAY_CREATE(a, 2, 2);
    a->data[0] = 123;
    a->data[1] = 456;
    i = 0;
    for (;i < a->size;i++)
        printf("%d\n", a->data[i]);
    for (j = 0; j < a->size; j++)
    {
        elem = a->data[j];
        printf("%d\n", elem);
    }
    while (a->size > 0)
        printf("%d\n", ARRAY_POP(a));
    free(a->data);
    free(a);

    return 0;
}
