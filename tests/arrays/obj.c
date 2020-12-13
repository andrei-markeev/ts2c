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

struct obj_t {
    int16_t arr[3];
};
struct a_t {
    struct array_number_t * foo;
};
struct array_number_t {
    int16_t size;
    int16_t capacity;
    int16_t* data;
};

static struct obj_t * obj;
static struct a_t * a;
static struct array_number_t * tmp_array = NULL;
static int16_t i;
int main(void) {
    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    obj->arr[0] = 1;
    obj->arr[1] = 2;
    obj->arr[2] = 3;
    printf("{ ");
    printf("arr: [ %d, %d, %d ]", obj->arr[0], obj->arr[1], obj->arr[2]);
    printf(" }\n");
    a = malloc(sizeof(*a));
    assert(a != NULL);
    ARRAY_CREATE(tmp_array, 4, 4);
    tmp_array->data[0] = 1;
    tmp_array->data[1] = 2;
    tmp_array->data[2] = 3;
    tmp_array->data[3] = 5;
    a->foo = ((void *)tmp_array);
    ARRAY_PUSH(a->foo, 6);
    printf("[ ");
    for (i = 0; i < a->foo->size; i++) {
        if (i != 0)
            printf(", ");
        printf("%d", a->foo->data[i]);
    }
    printf(" ]\n");
    free(obj);
    free(a);
    free(tmp_array->data);
    free(tmp_array);

    return 0;
}
