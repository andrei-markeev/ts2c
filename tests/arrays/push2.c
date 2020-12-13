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
struct array_string_t {
    int16_t size;
    int16_t capacity;
    const char ** data;
};

struct array_number_t {
    int16_t size;
    int16_t capacity;
    int16_t* data;
};

static struct array_string_t * array1;
static int16_t i;
static struct array_number_t * array2;
static int16_t j;
int main(void) {
    ARRAY_CREATE(array1, 2, 0);
    ARRAY_PUSH(array1, "Hello");
    printf("[ ");
    for (i = 0; i < array1->size; i++) {
        if (i != 0)
            printf(", ");
        printf("\"%s\"", array1->data[i]);
    }
    printf(" ]\n");
    ARRAY_CREATE(array2, 2, 0);
    i = 0;
    for (;i < 5;i++)
        ARRAY_PUSH(array2, 10 * i);
    printf("[ ");
    for (j = 0; j < array2->size; j++) {
        if (j != 0)
            printf(", ");
        printf("%d", array2->data[j]);
    }
    printf(" ]\n");
    free(array1->data);
    free(array1);
    free(array2->data);
    free(array2);

    return 0;
}
