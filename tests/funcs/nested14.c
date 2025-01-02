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
    int16_t x;
};
struct closure_t {
    int16_t (*func)(struct closure_t *);
    struct scope_t * scope;
};

int16_t gc_i;

static struct closure_t * (*a)();
static int16_t ax;

int16_t func(struct closure_t * closure)
{
    return closure->scope->x;
}
struct closure_t * a_func()
{
    struct scope_t * scope;
    struct closure_t * closure;

    scope = malloc(sizeof(*scope));
    assert(scope != NULL);
    ARRAY_PUSH(gc_main, (void *)scope);

    scope->x = 14;
    closure = malloc(sizeof(*closure));
    assert(closure != NULL);
    ARRAY_PUSH(gc_main, (void *)closure);
    closure->func = func;
    closure->scope = scope;
    return (closure);
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    a = a_func;
    ax = a()->func(a());
    printf("%d\n", ax);
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
