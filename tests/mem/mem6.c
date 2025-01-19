#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

typedef short int16_t;

#define ARRAY(T) struct {\
    int16_t size;\
    int16_t capacity;\
    T *data;\
} *
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

struct array_pointer_t {
    int16_t size;
    int16_t capacity;
    void ** data;
};

struct array_number_t {
    int16_t size;
    int16_t capacity;
    int16_t* data;
};

static int16_t gc_i;

static ARRAY(struct array_pointer_t *) gc_main_arrays;
static struct array_number_t * init_arr;

void recurse(struct array_number_t * incoming_arr);

void indirect_recurse(struct array_number_t * arr)
{
    int16_t i;

    printf("[ ");
    for (i = 0; i < arr->size; i++) {
        if (i != 0)
            printf(", ");
        printf("%d", arr->data[i]);
    }
    printf(" ]\n");
    recurse(arr);
}
void recurse(struct array_number_t * incoming_arr)
{
    int16_t counter;
    struct array_number_t * new_arr;

    counter = ARRAY_POP(incoming_arr);
    counter--;
    ARRAY_CREATE(new_arr, 2, 0);
    ARRAY_PUSH(gc_main_arrays, (void *)new_arr);
    ARRAY_PUSH(new_arr, counter);
    if (counter > 0)
        indirect_recurse(new_arr);
}

int main(void) {
    ARRAY_CREATE(gc_main_arrays, 2, 0);

    ARRAY_CREATE(init_arr, 2, 0);
    ARRAY_PUSH(gc_main_arrays, (void *)init_arr);
    ARRAY_PUSH(init_arr, 5);
    recurse(init_arr);
    for (gc_i = 0; gc_i < gc_main_arrays->size; gc_i++) {
        free(gc_main_arrays->data[gc_i]->data);
        free(gc_main_arrays->data[gc_i]);
    }
    free(gc_main_arrays->data);
    free(gc_main_arrays);

    return 0;
}
