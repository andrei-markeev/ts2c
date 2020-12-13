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

struct alloc_t {
    const char * key1;
    const char * key2;
};

int16_t gc_i;

static ARRAY(void *) gc_146_214;
struct alloc_t * alloc()
{
    struct alloc_t * obj;
    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    ARRAY_PUSH(gc_146_214, (void *)obj);
    obj->key1 = "hello!";
    obj->key2 = "something";
    return obj;

}
struct alloc_t * f2_wrap()
{
    struct alloc_t * a;
    a = alloc();
    return a;

}
void f2()
{
    struct alloc_t * b;

    ARRAY_CREATE(gc_146_214, 2, 0);

    b = f2_wrap();
    printf("f2:");
    printf(" { ");
    printf("key1: \"%s\"", b->key1);    printf(", ");
    printf("key2: \"%s\"", b->key2);
    printf(" }\n");
    for (gc_i = 0; gc_i < gc_146_214->size; gc_i++)
        free(gc_146_214->data[gc_i]);
    free(gc_146_214->data);
    free(gc_146_214);

}
void f1()
{
    struct alloc_t * a;

    ARRAY_CREATE(gc_146_214, 2, 0);

    a = alloc();
    a->key1 = "changed";
    printf("f1:");
    printf(" { ");
    printf("key1: \"%s\"", a->key1);    printf(", ");
    printf("key2: \"%s\"", a->key2);
    printf(" }\n");
    for (gc_i = 0; gc_i < gc_146_214->size; gc_i++)
        free(gc_146_214->data[gc_i]);
    free(gc_146_214->data);
    free(gc_146_214);

}

int main(void) {
    f1();
    f2();

    return 0;
}
