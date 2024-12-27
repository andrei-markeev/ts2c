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

static ARRAY(void *) gc_main;

struct scope_t {
    int16_t counter;
};
struct closure_t {
    int16_t (*func)(struct closure_t *);
    struct scope_t * scope;
};

int16_t gc_i;

static struct closure_t * add;

int16_t func_2(struct closure_t * closure)
{
    (closure->scope->counter = closure->scope->counter + 1);
    return closure->scope->counter;
}
struct closure_t * func()
{
    struct scope_t * scope;
    struct closure_t * closure;

    scope = malloc(sizeof(*scope));
    assert(scope != NULL);
    ARRAY_PUSH(gc_main, (void *)scope);

    scope->counter = 0;
    closure = malloc(sizeof(*closure));
    assert(closure != NULL);
    ARRAY_PUSH(gc_main, (void *)closure);
    closure->func = func_2;
    closure->scope = scope;
    return closure;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    add = (func)();
    add->func(add);
    add->func(add);
    printf("%d\n", add->func(add));
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
