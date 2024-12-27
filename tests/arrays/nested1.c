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

struct array_array_number_t {
    int16_t size;
    int16_t capacity;
    struct array_number_t ** data;
};
struct array_number_t {
    int16_t size;
    int16_t capacity;
    int16_t* data;
};

static struct array_array_number_t * arrOfArrays1;
static struct array_number_t * tmp_array = NULL;
static struct array_number_t * tmp_array_2 = NULL;
static int16_t i;
static int16_t j;
static struct array_number_t * ari;
static int16_t k;

int main(void) {
    ARRAY_CREATE(arrOfArrays1, 2, 0);
    ARRAY_CREATE(tmp_array, 3, 3);
    tmp_array->data[0] = 10;
    tmp_array->data[1] = 20;
    tmp_array->data[2] = 30;
    ARRAY_PUSH(arrOfArrays1, tmp_array);
    ARRAY_PUSH(arrOfArrays1->data[0], 100);
    ARRAY_CREATE(tmp_array_2, 2, 2);
    tmp_array_2->data[0] = 1;
    tmp_array_2->data[1] = 2;
    ARRAY_PUSH(arrOfArrays1, tmp_array_2);
    printf("[ ");
    for (i = 0; i < arrOfArrays1->size; i++) {
        if (i != 0)
            printf(", ");
        printf("[ ");
        for (j = 0; j < arrOfArrays1->data[i]->size; j++) {
            if (j != 0)
                printf(", ");
            printf("%d", arrOfArrays1->data[i]->data[j]);
        }
        printf(" ]");
    }
    printf(" ]\n");
    for (k = 0; k < arrOfArrays1->size; k++)
    {
        ari = (void *)arrOfArrays1->data[k];
        {
            int16_t l;
            printf("[ ");
            for (l = 0; l < ari->size; l++) {
                if (l != 0)
                    printf(", ");
                printf("%d", ari->data[l]);
            }
            printf(" ]\n");
        }
    }
    free(arrOfArrays1->data);
    free(arrOfArrays1);
    free(tmp_array->data);
    free(tmp_array);
    free(tmp_array_2->data);
    free(tmp_array_2);

    return 0;
}
