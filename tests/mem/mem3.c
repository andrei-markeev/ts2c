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

struct nested_t {
    const char * key;
};

static int16_t gc_i;

static struct array_pointer_t * gc_74;

struct nested_t * nested()
{
    struct nested_t * obj;

    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    ARRAY_PUSH(gc_74, (void *)obj);
    obj->key = "something";
    return obj;
}
void func()
{
    struct nested_t * x;

    ARRAY_CREATE(gc_74, 2, 0);

    x = nested();
    printf("{ ");
    printf("key: \"%s\"", x->key);
    printf(" }\n");
    for (gc_i = 0; gc_i < gc_74->size; gc_i++)
        free(gc_74->data[gc_i]);
    free(gc_74->data);
    free(gc_74);
}

int main(void) {
    func();

    return 0;
}
