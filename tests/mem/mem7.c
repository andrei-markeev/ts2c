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

struct array_pointer_t {
    int16_t size;
    int16_t capacity;
    void ** data;
};

struct return_from_obj_t {
    const char * hello;
};
struct obj_t {
    struct return_from_obj_t * key;
};
struct obj_t_2 {
    int16_t key;
};

static struct array_pointer_t *gc_main;
static int16_t gc_i;

static struct return_from_obj_t * tmp_result;

struct return_from_obj_t * return_from_obj()
{
    struct obj_t * obj;
    struct return_from_obj_t * tmp_obj = NULL;
    struct return_from_obj_t * result;

    tmp_obj = malloc(sizeof(*tmp_obj));
    assert(tmp_obj != NULL);
    ARRAY_PUSH(gc_main, (void *)tmp_obj);
    tmp_obj->hello = "world";
    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    obj->key = tmp_obj;
    result = obj->key;
    free(obj);
    return result;
}
int16_t return_from_obj2()
{
    struct obj_t_2 * obj;
    int16_t result;

    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    obj->key = 132;
    result = obj->key;
    free(obj);
    return result;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    tmp_result = return_from_obj();
    printf("{ ");
    printf("hello: \"%s\"", tmp_result->hello);
    printf(" }\n");
    printf("%d\n", return_from_obj2());
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
