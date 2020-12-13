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
struct array_string_t {
    int16_t size;
    int16_t capacity;
    const char ** data;
};
static struct array_string_t * arr;
static int16_t i;
static int16_t j;
static int16_t k;
static int16_t l;
static int16_t m;
static struct array_string_t * tmp_result;
static struct array_string_t * tmp_removed_values;
static int16_t n;
static int16_t i_2;
static struct array_string_t * tmp_result_2;
static struct array_string_t * tmp_removed_values_2;
static int16_t i_3;
static int16_t i_4;
static int16_t i_5;
static struct array_string_t * tmp_result_3;
static struct array_string_t * tmp_removed_values_3;
static int16_t i_6;
static int16_t i_7;
static int16_t i_8;
int main(void) {
    ARRAY_CREATE(arr, 6, 6);
    arr->data[0] = "some";
    arr->data[1] = "test";
    arr->data[2] = "string";
    arr->data[3] = "values";
    arr->data[4] = "go";
    arr->data[5] = "here";
    ;
    printf("[ ");
    for (i = 0; i < arr->size; i++) {
        if (i != 0)
            printf(", ");
        printf("\"%s\"", arr->data[i]);
    }
    printf(" ]\n");
    ARRAY_REMOVE(arr, (0) < 0 ? arr->size + (0) : (0), 1);
    printf("[ ");
    for (j = 0; j < arr->size; j++) {
        if (j != 0)
            printf(", ");
        printf("\"%s\"", arr->data[j]);
    }
    printf(" ]\n");
    ARRAY_REMOVE(arr, (1) < 0 ? arr->size + (1) : (1), 1);
    printf("[ ");
    for (k = 0; k < arr->size; k++) {
        if (k != 0)
            printf(", ");
        printf("\"%s\"", arr->data[k]);
    }
    printf(" ]\n");
    ARRAY_INSERT(arr, 1, "new2");
    ARRAY_INSERT(arr, 1, "new1");
    printf("[ ");
    for (l = 0; l < arr->size; l++) {
        if (l != 0)
            printf(", ");
        printf("\"%s\"", arr->data[l]);
    }
    printf(" ]\n");
    ARRAY_REMOVE(arr, (2) < 0 ? arr->size + (2) : (2), 2);
    ARRAY_INSERT(arr, 2, "new4");
    ARRAY_INSERT(arr, 2, "new3");
    printf("[ ");
    for (m = 0; m < arr->size; m++) {
        if (m != 0)
            printf(", ");
        printf("\"%s\"", arr->data[m]);
    }
    printf(" ]\n");
    ARRAY_CREATE(tmp_removed_values, 1, 1);
    for (n = 0; n < 1; n++)
        tmp_removed_values->data[n] = arr->data[n+((3) < 0 ? arr->size + (3) : (3))];
    ARRAY_REMOVE(arr, (3) < 0 ? arr->size + (3) : (3), 1);
    tmp_result = ((void *)tmp_removed_values);
    printf("[ ");
    for (i_2 = 0; i_2 < tmp_result->size; i_2++) {
        if (i_2 != 0)
            printf(", ");
        printf("\"%s\"", tmp_result->data[i_2]);
    }
    printf(" ]\n");
    ARRAY_CREATE(tmp_removed_values_2, 2, 2);
    for (i_3 = 0; i_3 < 2; i_3++)
        tmp_removed_values_2->data[i_3] = arr->data[i_3+((3) < 0 ? arr->size + (3) : (3))];
    ARRAY_REMOVE(arr, (3) < 0 ? arr->size + (3) : (3), 2);
    ARRAY_INSERT(arr, 3, "new5");
    tmp_result_2 = ((void *)tmp_removed_values_2);
    printf("[ ");
    for (i_4 = 0; i_4 < tmp_result_2->size; i_4++) {
        if (i_4 != 0)
            printf(", ");
        printf("\"%s\"", tmp_result_2->data[i_4]);
    }
    printf(" ]\n");
    printf("[ ");
    for (i_5 = 0; i_5 < arr->size; i_5++) {
        if (i_5 != 0)
            printf(", ");
        printf("\"%s\"", arr->data[i_5]);
    }
    printf(" ]\n");
    ARRAY_CREATE(tmp_removed_values_3, 1, 1);
    for (i_6 = 0; i_6 < 1; i_6++)
        tmp_removed_values_3->data[i_6] = arr->data[i_6+((-3) < 0 ? arr->size + (-3) : (-3))];
    ARRAY_REMOVE(arr, (-3) < 0 ? arr->size + (-3) : (-3), 1);
    tmp_result_3 = ((void *)tmp_removed_values_3);
    printf("[ ");
    for (i_7 = 0; i_7 < tmp_result_3->size; i_7++) {
        if (i_7 != 0)
            printf(", ");
        printf("\"%s\"", tmp_result_3->data[i_7]);
    }
    printf(" ]\n");
    ARRAY_REMOVE(arr, (-3) < 0 ? arr->size + (-3) : (-3), 1);
    printf("[ ");
    for (i_8 = 0; i_8 < arr->size; i_8++) {
        if (i_8 != 0)
            printf(", ");
        printf("\"%s\"", arr->data[i_8]);
    }
    printf(" ]\n");
    free(arr->data);
    free(arr);
    free(tmp_removed_values->data);
    free(tmp_removed_values);
    free(tmp_removed_values_2->data);
    free(tmp_removed_values_2);
    free(tmp_removed_values_3->data);
    free(tmp_removed_values_3);

    return 0;
}
