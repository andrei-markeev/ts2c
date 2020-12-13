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

static int16_t int_arr1[6] = { 10, 40, 20, 30, 40, 50 };
static struct array_number_t * int_arr2;
static const char * str_arr1[4] = { "hello", "world", "test", "hello" };
static struct array_string_t * str_arr2;
static int16_t arr_pos;
static int16_t i;
static int16_t arr_pos_2;
static int16_t j;
static int16_t arr_pos_3;
static int16_t k;
static int16_t arr_pos_4;
static int16_t l;
int main(void) {
    ARRAY_CREATE(int_arr2, 3, 3);
    int_arr2->data[0] = 1;
    int_arr2->data[1] = 2;
    int_arr2->data[2] = 3;
    ARRAY_PUSH(int_arr2, 3);
    ARRAY_PUSH(int_arr2, 4);
    ARRAY_PUSH(int_arr2, 5);
    ARRAY_CREATE(str_arr2, 2, 2);
    str_arr2->data[0] = "test";
    str_arr2->data[1] = "hello";
    ARRAY_INSERT(str_arr2, 0, "something");
    arr_pos = -1;
    for (i = 6 - 1; i >= 0; i--) {
        if (int_arr1[i] == 40) {
            arr_pos = i;
            break;
        }
    }
    printf("%d\n", arr_pos);
    arr_pos_2 = -1;
    for (j = int_arr2->size - 1; j >= 0; j--) {
        if (int_arr2->data[j] == 3) {
            arr_pos_2 = j;
            break;
        }
    }
    printf("%d\n", arr_pos_2);
    arr_pos_3 = -1;
    for (k = 4 - 1; k >= 0; k--) {
        if (strcmp(str_arr1[k], "hello") == 0) {
            arr_pos_3 = k;
            break;
        }
    }
    printf("%d\n", arr_pos_3);
    arr_pos_4 = -1;
    for (l = str_arr2->size - 1; l >= 0; l--) {
        if (strcmp(str_arr2->data[l], "something") == 0) {
            arr_pos_4 = l;
            break;
        }
    }
    printf("%d\n", arr_pos_4);
    free(int_arr2->data);
    free(int_arr2);
    free(str_arr2->data);
    free(str_arr2);

    return 0;
}
