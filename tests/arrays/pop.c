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

static struct array_number_t * int_arr;
static int16_t i;
static int16_t j;

int main(void) {
    ARRAY_CREATE(int_arr, 2, 2);
    int_arr->data[0] = 10;
    int_arr->data[1] = 20;
    ARRAY_POP(int_arr);
    ARRAY_PUSH(int_arr, 100);
    ARRAY_PUSH(int_arr, 200);
    ARRAY_PUSH(int_arr, 300);
    printf("[ ");
    for (i = 0; i < int_arr->size; i++) {
        if (i != 0)
            printf(", ");
        printf("%d", int_arr->data[i]);
    }
    printf(" ]\n");
    ARRAY_POP(int_arr);
    ARRAY_POP(int_arr);
    ARRAY_POP(int_arr);
    ARRAY_POP(int_arr);
    ARRAY_POP(int_arr);
    ARRAY_POP(int_arr);
    printf("[ ");
    for (j = 0; j < int_arr->size; j++) {
        if (j != 0)
            printf(", ");
        printf("%d", int_arr->data[j]);
    }
    printf(" ]\n");
    free(int_arr->data);
    free(int_arr);

    return 0;
}
