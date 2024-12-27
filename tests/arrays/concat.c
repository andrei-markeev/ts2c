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

static struct array_string_t * arr1;
static const char * arr2[2] = { "hello", "world" };
static struct array_string_t * arr3;
static struct array_string_t * tmp_result;
static struct array_string_t * tmp_array;
static int16_t i;
static const char * tmp_array_3[1] = { "static" };
static int16_t j;
static int16_t k;
static int16_t l;
static int16_t m;
static int16_t n;
static struct array_number_t * tmp_result_2;
static int16_t tmp_array_4[3] = { 1, 2, 3 };
static struct array_number_t * tmp_array_2;
static int16_t i_2;
static int16_t i_3;
static int16_t i_4;

int main(void) {
    ARRAY_CREATE(arr1, 2, 0);
    ARRAY_PUSH(arr1, "some");
    ARRAY_PUSH(arr1, "more");
    ARRAY_PUSH(arr1, "stuff");
    ARRAY_CREATE(arr3, 2, 0);
    ARRAY_PUSH(arr3, "banana");
    ARRAY_CREATE(tmp_array, arr1->size+1+2+1+1+arr3->size+1, 0);
    tmp_array->size = tmp_array->capacity;
    i = 0;
    for (j = 0; j < arr1->size; j++)
        tmp_array->data[i++] = arr1->data[j];
    tmp_array->data[i++] = "one";
    for (k = 0; k < 2; k++)
        tmp_array->data[i++] = arr2[k];
    for (l = 0; l < 1; l++)
        tmp_array->data[i++] = tmp_array_3[l];
    tmp_array->data[i++] = "two";
    for (m = 0; m < arr3->size; m++)
        tmp_array->data[i++] = arr3->data[m];
    tmp_array->data[i++] = "three";
    tmp_result = ((void *)tmp_array);
    printf("[ ");
    for (n = 0; n < tmp_result->size; n++) {
        if (n != 0)
            printf(", ");
        printf("\"%s\"", tmp_result->data[n]);
    }
    printf(" ]\n");
    ARRAY_CREATE(tmp_array_2, 3+1+1, 0);
    tmp_array_2->size = tmp_array_2->capacity;
    i_2 = 0;
    for (i_3 = 0; i_3 < 3; i_3++)
        tmp_array_2->data[i_2++] = tmp_array_4[i_3];
    tmp_array_2->data[i_2++] = 20;
    tmp_array_2->data[i_2++] = 30;
    tmp_result_2 = ((void *)tmp_array_2);
    printf("[ ");
    for (i_4 = 0; i_4 < tmp_result_2->size; i_4++) {
        if (i_4 != 0)
            printf(", ");
        printf("%d", tmp_result_2->data[i_4]);
    }
    printf(" ]\n");
    free(arr1->data);
    free(arr1);
    free(arr3->data);
    free(arr3);
    free(tmp_array->data);
    free(tmp_array);
    free(tmp_array_2->data);
    free(tmp_array_2);

    return 0;
}
