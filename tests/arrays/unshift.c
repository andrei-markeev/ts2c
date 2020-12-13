#include <string.h>
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
#define ARRAY_INSERT(array, pos, item) {\
    ARRAY_PUSH(array, item); \
    if (pos < array->size - 1) {\
        memmove(&(array->data[(pos) + 1]), &(array->data[pos]), (array->size - (pos) - 1) * sizeof(*array->data)); \
        array->data[pos] = item; \
    } \
}
#define ARRAY_REMOVE(array, pos, num) {\
    memmove(&(array->data[pos]), &(array->data[(pos) + num]), (array->size - (pos) - num) * sizeof(*array->data)); \
    array->size -= num; \
}

struct array_number_t {
    int16_t size;
    int16_t capacity;
    int16_t* data;
};

static struct array_number_t * arr;
static int16_t value;
static int16_t i;
static int16_t j;
static int16_t value_2;
int main(void) {
    ARRAY_CREATE(arr, 3, 3);
    arr->data[0] = 10;
    arr->data[1] = 20;
    arr->data[2] = 30;
    value = arr->data[0];
    ARRAY_REMOVE(arr, 0, 1);
    printf("%d\n", value);
    ARRAY_INSERT(arr, 0, 88);
    printf("[ ");
    for (i = 0; i < arr->size; i++) {
        if (i != 0)
            printf(", ");
        printf("%d", arr->data[i]);
    }
    printf(" ]\n");
    ARRAY_INSERT(arr, 0, 100);
    ARRAY_INSERT(arr, 0, 200);
    ARRAY_INSERT(arr, 0, 300);
    ARRAY_POP(arr);
    printf("[ ");
    for (j = 0; j < arr->size; j++) {
        if (j != 0)
            printf(", ");
        printf("%d", arr->data[j]);
    }
    printf(" ]\n");
    value_2 = arr->data[0];
    ARRAY_REMOVE(arr, 0, 1);
    printf("%d\n", value_2);
    free(arr->data);
    free(arr);

    return 0;
}
