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

static int16_t arr1[3] = { 1, 2, 3 };
static int16_t arr_pos;
static int16_t i;
static int16_t arr_pos_2;
static int16_t j;
static struct array_number_t * arr2;
static int16_t arr_pos_3;
static int16_t k;
static int16_t arr_pos_4;
static int16_t l;
static int16_t arr_pos_5;
static int16_t m;
static int16_t arr_pos_6;
static int16_t n;

int main(void) {
    arr_pos = -1;
    for (i = 0; i < 3; i++) {
        if (arr1[i] == 2) {
            arr_pos = i;
            break;
        }
    }
    printf("%d\n", arr_pos);
    arr_pos_2 = -1;
    for (j = 0; j < 3; j++) {
        if (arr1[j] == 4) {
            arr_pos_2 = j;
            break;
        }
    }
    printf("%d\n", arr_pos_2);
    ARRAY_CREATE(arr2, 4, 4);
    arr2->data[0] = 10;
    arr2->data[1] = 20;
    arr2->data[2] = 30;
    arr2->data[3] = 40;
    ARRAY_PUSH(arr2, 60);
    arr_pos_3 = -1;
    for (k = 0; k < arr2->size; k++) {
        if (arr2->data[k] == 10) {
            arr_pos_3 = k;
            break;
        }
    }
    printf("%d\n", arr_pos_3);
    arr_pos_4 = -1;
    for (l = 0; l < arr2->size; l++) {
        if (arr2->data[l] == 50) {
            arr_pos_4 = l;
            break;
        }
    }
    printf("%d\n", arr_pos_4);
    arr_pos_5 = -1;
    for (m = 0; m < arr2->size; m++) {
        if (arr2->data[m] == 60) {
            arr_pos_5 = m;
            break;
        }
    }
    printf("%d\n", arr_pos_5);
    ARRAY_POP(arr2);
    arr_pos_6 = -1;
    for (n = 0; n < arr2->size; n++) {
        if (arr2->data[n] == 60) {
            arr_pos_6 = n;
            break;
        }
    }
    printf("%d\n", arr_pos_6);
    free(arr2->data);
    free(arr2);

    return 0;
}
