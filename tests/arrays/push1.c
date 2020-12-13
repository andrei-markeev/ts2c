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

static struct array_number_t * int_arr;
static int16_t i;
static struct array_string_t * string_arr;
static int16_t j;
int main(void) {
    ARRAY_CREATE(int_arr, 2, 1);
    int_arr->data[0] = 1;
    ARRAY_PUSH(int_arr, 10);
    ARRAY_PUSH(int_arr, 20);
    ARRAY_PUSH(int_arr, 30);
    ARRAY_PUSH(int_arr, 40);
    ARRAY_PUSH(int_arr, 50);
    printf("[ ");
    for (i = 0; i < int_arr->size; i++) {
        if (i != 0)
            printf(", ");
        printf("%d", int_arr->data[i]);
    }
    printf(" ]\n");
    ARRAY_CREATE(string_arr, 2, 1);
    string_arr->data[0] = "";
    ARRAY_PUSH(string_arr, "hello");
    ARRAY_PUSH(string_arr, "every");
    ARRAY_PUSH(string_arr, "one");
    printf("[ ");
    for (j = 0; j < string_arr->size; j++) {
        if (j != 0)
            printf(", ");
        printf("\"%s\"", string_arr->data[j]);
    }
    printf(" ]\n");
    free(int_arr->data);
    free(int_arr);
    free(string_arr->data);
    free(string_arr);

    return 0;
}
