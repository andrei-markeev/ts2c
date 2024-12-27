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

static int16_t i;
static int16_t arr1[4] = { 10, 20, 30, 100 };
static const char * arr2[4] = { "hello", "world", "bar", "foo" };
static int16_t slice1[2];
static int16_t j;
static struct array_number_t * slice2;
static int16_t k;
static int16_t slice2_size;
static int16_t slice2_start;
static int16_t slice2_end;
static struct array_string_t * slice3;
static int16_t l;
static int16_t slice3_size;
static int16_t slice3_start;
static int16_t slice3_end;
static struct array_string_t * slice4;
static int16_t m;
static int16_t slice4_size;
static int16_t slice4_start;
static int16_t slice4_end;
static const char * slice5[2];
static int16_t n;
static int16_t i_2;
static int16_t i_3;
static int16_t i_4;
static struct array_number_t * tmp_result;
static int16_t i_5;
static struct array_number_t * tmp_slice;
static int16_t tmp_slice_size;
static int16_t tmp_slice_start;
static int16_t tmp_slice_end;
static int16_t i_6;
static int16_t* tmp_result_2;
static int16_t i_7;
static int16_t tmp_slice_2[2];
static const char ** tmp_result_3;
static int16_t i_8;
static const char * tmp_slice_3[1];
static int16_t i_9;
static int16_t i_10;

int main(void) {
    i = 0;
    for (j = 0; j < 2; j++)
        slice1[j] = arr1[j + 0];
    slice2_start = (i + 2) < 0 ? 4 + (i + 2) : (i + 2);
    slice2_end = (-1) < 0 ? 4 + (-1) : (-1);
    slice2_size = slice2_end - slice2_start;
    ARRAY_CREATE(slice2, slice2_size, slice2_size);
    for (k = 0; k < slice2_size; k++)
        slice2->data[k] = arr1[k + slice2_start];
    ARRAY_PUSH(slice2, 33);
    slice3_start = (1) < 0 ? 4 + (1) : (1);
    slice3_end = (i - 1) < 0 ? 4 + (i - 1) : (i - 1);
    slice3_size = slice3_end - slice3_start;
    ARRAY_CREATE(slice3, slice3_size, slice3_size);
    for (l = 0; l < slice3_size; l++)
        slice3->data[l] = arr2[l + slice3_start];
    ARRAY_INSERT(slice3, 0, "apple");
    slice4_start = (1) < 0 ? 4 + (1) : (1);
    slice4_end = (3) < 0 ? 4 + (3) : (3);
    slice4_size = slice4_end - slice4_start;
    ARRAY_CREATE(slice4, slice4_size, slice4_size);
    for (m = 0; m < slice4_size; m++)
        slice4->data[m] = arr2[m + slice4_start];
    ARRAY_PUSH(slice4, "test");
    for (n = 0; n < 2; n++)
        slice5[n] = arr2[n + 0];
    printf("[ %d, %d ]\n", slice1[0], slice1[1]);
    printf("[ ");
    for (i_2 = 0; i_2 < slice2->size; i_2++) {
        if (i_2 != 0)
            printf(", ");
        printf("%d", slice2->data[i_2]);
    }
    printf(" ]\n");
    printf("[ ");
    for (i_3 = 0; i_3 < slice3->size; i_3++) {
        if (i_3 != 0)
            printf(", ");
        printf("\"%s\"", slice3->data[i_3]);
    }
    printf(" ]\n");
    printf("[ ");
    for (i_4 = 0; i_4 < slice4->size; i_4++) {
        if (i_4 != 0)
            printf(", ");
        printf("\"%s\"", slice4->data[i_4]);
    }
    printf(" ]\n");
    printf("[ \"%s\", \"%s\" ]\n", slice5[0], slice5[1]);
    tmp_slice_start = (2) < 0 ? 4 + (2) : (2);
    tmp_slice_end = (-2) < 0 ? 4 + (-2) : (-2);
    tmp_slice_size = tmp_slice_end - tmp_slice_start;
    ARRAY_CREATE(tmp_slice, tmp_slice_size, tmp_slice_size);
    for (i_5 = 0; i_5 < tmp_slice_size; i_5++)
        tmp_slice->data[i_5] = arr1[i_5 + tmp_slice_start];
    tmp_result = ((void *)tmp_slice);
    printf("[ ");
    for (i_6 = 0; i_6 < tmp_result->size; i_6++) {
        if (i_6 != 0)
            printf(", ");
        printf("%d", tmp_result->data[i_6]);
    }
    printf(" ]\n");
    for (i_7 = 0; i_7 < 2; i_7++)
        tmp_slice_2[i_7] = arr1[i_7 + 1];
    tmp_result_2 = tmp_slice_2;
    printf("[ %d, %d ]\n", tmp_result_2[0], tmp_result_2[1]);
    for (i_8 = 0; i_8 < 1; i_8++)
        tmp_slice_3[i_8] = arr2[i_8 + 3];
    tmp_result_3 = tmp_slice_3;
    printf("[ \"%s\" ]\n", tmp_result_3[0]);
    printf("[ ");
    for (i_9 = 0; i_9 < 4; i_9++) {
        if (i_9 != 0)
            printf(", ");
        printf("%d", arr1[i_9]);
    }
    printf(" ]\n");
    printf("[ ");
    for (i_10 = 0; i_10 < 4; i_10++) {
        if (i_10 != 0)
            printf(", ");
        printf("\"%s\"", arr2[i_10]);
    }
    printf(" ]\n");
    free(slice2->data);
    free(slice2);
    free(slice3->data);
    free(slice3);
    free(slice4->data);
    free(slice4);
    free(tmp_slice->data);
    free(tmp_slice);

    return 0;
}
