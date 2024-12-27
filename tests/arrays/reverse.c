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

static struct array_number_t * arr1;
static int16_t i;
static int16_t j;
static int16_t temp;
static int16_t k;
static struct array_string_t * arr2;
static struct array_string_t * tmp_result;
static int16_t l;
static int16_t m;
static const char * temp_2;
static int16_t n;
static struct array_string_t * arr3;
static struct array_string_t * tmp_result_2;
static int16_t i_2;
static int16_t i_3;
static const char * temp_3;
static int16_t i_4;

int main(void) {
    ARRAY_CREATE(arr1, 3, 3);
    arr1->data[0] = 1;
    arr1->data[1] = 3;
    arr1->data[2] = 2;
    i = 0;
    j = arr1->size - 1;
    while (i < j) {
        temp = arr1->data[i];
        arr1->data[i] = arr1->data[j];
        arr1->data[j] = temp;
        i++;
        j--;
    }
    ;
    printf("[ ");
    for (k = 0; k < arr1->size; k++) {
        if (k != 0)
            printf(", ");
        printf("%d", arr1->data[k]);
    }
    printf(" ]\n");
    ARRAY_CREATE(arr2, 5, 5);
    arr2->data[0] = "def";
    arr2->data[1] = "abc";
    arr2->data[2] = "aba";
    arr2->data[3] = "ced";
    arr2->data[4] = "meh";
    l = 0;
    m = arr2->size - 1;
    while (l < m) {
        temp_2 = arr2->data[l];
        arr2->data[l] = arr2->data[m];
        arr2->data[m] = temp_2;
        l++;
        m--;
    }
    tmp_result = ((void *)arr2);
    printf("[ ");
    for (n = 0; n < tmp_result->size; n++) {
        if (n != 0)
            printf(", ");
        printf("\"%s\"", tmp_result->data[n]);
    }
    printf(" ]\n");
    ARRAY_CREATE(arr3, 2, 2);
    arr3->data[0] = "abc";
    arr3->data[1] = "def";
    i_2 = 0;
    i_3 = arr3->size - 1;
    while (i_2 < i_3) {
        temp_3 = arr3->data[i_2];
        arr3->data[i_2] = arr3->data[i_3];
        arr3->data[i_3] = temp_3;
        i_2++;
        i_3--;
    }
    tmp_result_2 = ((void *)arr3);
    printf("[ ");
    for (i_4 = 0; i_4 < tmp_result_2->size; i_4++) {
        if (i_4 != 0)
            printf(", ");
        printf("\"%s\"", tmp_result_2->data[i_4]);
    }
    printf(" ]\n");
    free(arr1->data);
    free(arr1);
    free(arr2->data);
    free(arr2);
    free(arr3->data);
    free(arr3);

    return 0;
}
