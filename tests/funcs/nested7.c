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

struct scope_t {
    int16_t x;
};
struct closure_t {
    int16_t (*func)(int16_t, struct closure_t *);
    struct scope_t * scope;
};

static ARRAY(void *) gc_main;
static int16_t gc_i;

static struct closure_t * add5;
static struct closure_t * add10;

int16_t func(int16_t y, struct closure_t * closure)
{
    return closure->scope->x + y;
}
struct closure_t * makeAdder(int16_t x)
{
    struct scope_t * scope;
    struct closure_t * closure;

    scope = malloc(sizeof(*scope));
    assert(scope != NULL);
    ARRAY_PUSH(gc_main, (void *)scope);

    scope->x = x;
    closure = malloc(sizeof(*closure));
    assert(closure != NULL);
    ARRAY_PUSH(gc_main, (void *)closure);
    closure->func = func;
    closure->scope = scope;
    return closure;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    add5 = makeAdder(5);
    add10 = makeAdder(10);
    printf("%d\n", add5->func(2, add5));
    printf("%d\n", add10->func(2, add10));
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
