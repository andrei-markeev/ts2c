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
int array_int16_t_cmp(const void* a, const void* b) {
    return ( *(int16_t*)a - *(int16_t*)b );
}
int array_str_cmp(const void* a, const void* b) { 
    return strcmp(*(const char **)a, *(const char **)b);
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

static struct array_number_t * arr1;
static int16_t i;
static struct array_string_t * arr2;
static struct array_string_t * tmp_result;
static int16_t j;
int main(void) {
    ARRAY_CREATE(arr1, 3, 3);
    arr1->data[0] = 1;
    arr1->data[1] = 3;
    arr1->data[2] = 2;
    qsort(arr1->data, arr1->size, sizeof(*arr1->data), array_int16_t_cmp);
    printf("[ ");
    for (i = 0; i < arr1->size; i++) {
        if (i != 0)
            printf(", ");
        printf("%d", arr1->data[i]);
    }
    printf(" ]\n");
    ARRAY_CREATE(arr2, 5, 5);
    arr2->data[0] = "def";
    arr2->data[1] = "abc";
    arr2->data[2] = "aba";
    arr2->data[3] = "ced";
    arr2->data[4] = "meh";
    qsort(arr2->data, arr2->size, sizeof(*arr2->data), array_str_cmp);
    tmp_result = ((void *)arr2);
    printf("[ ");
    for (j = 0; j < tmp_result->size; j++) {
        if (j != 0)
            printf(", ");
        printf("\"%s\"", tmp_result->data[j]);
    }
    printf(" ]\n");
    free(arr1->data);
    free(arr1);
    free(arr2->data);
    free(arr2);

    return 0;
}
