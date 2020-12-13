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

struct obj1_t {
    struct obj2_t * obj2;
};
struct obj2_t {
    struct array_string_t * array2;
};
struct array_obj1_t {
    int16_t size;
    int16_t capacity;
    struct obj1_t ** data;
};

static struct array_obj1_t * array1;
static struct array_string_t * array2;
static struct obj1_t * obj1;
static struct obj2_t * obj2;
static int16_t i;
static int16_t j;
static int16_t k;
static int16_t l;
static int16_t m;
int main(void) {
    ARRAY_CREATE(array1, 2, 0);
    ARRAY_CREATE(array2, 2, 0);
    obj1 = malloc(sizeof(*obj1));
    assert(obj1 != NULL);
    obj2 = malloc(sizeof(*obj2));
    assert(obj2 != NULL);
    ARRAY_PUSH(array1, obj1);
    obj1->obj2 = obj2;
    obj2->array2 = array2;
    ARRAY_PUSH(array2, "Hello");
    ARRAY_PUSH(array2, "world!");
    printf("[ ");
    for (i = 0; i < array1->size; i++) {
        if (i != 0)
            printf(", ");
        printf("{ ");
        printf("obj2: { ");
            printf("array2: [ ");
                for (j = 0; j < array1->data[i]->obj2->array2->size; j++) {
                    if (j != 0)
                        printf(", ");
                    printf("\"%s\"", array1->data[i]->obj2->array2->data[j]);
                }
                printf(" ]");
            printf(" }");
        printf(" }");
    }
    printf(" ]\n");
    printf("{ ");
    printf("obj2: { ");
        printf("array2: [ ");
            for (k = 0; k < array1->data[0]->obj2->array2->size; k++) {
                if (k != 0)
                    printf(", ");
                printf("\"%s\"", array1->data[0]->obj2->array2->data[k]);
            }
            printf(" ]");
        printf(" }");
    printf(" }\n");
    printf("{ ");
    printf("array2: [ ");
        for (l = 0; l < array1->data[0]->obj2->array2->size; l++) {
            if (l != 0)
                printf(", ");
            printf("\"%s\"", array1->data[0]->obj2->array2->data[l]);
        }
        printf(" ]");
    printf(" }\n");
    printf("[ ");
    for (m = 0; m < array1->data[0]->obj2->array2->size; m++) {
        if (m != 0)
            printf(", ");
        printf("\"%s\"", array1->data[0]->obj2->array2->data[m]);
    }
    printf(" ]\n");
    printf("%s\n", array1->data[0]->obj2->array2->data[1]);
    free(array1->data);
    free(array1);
    free(array2->data);
    free(array2);
    free(obj1);
    free(obj2);

    return 0;
}
