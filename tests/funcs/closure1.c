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
    int16_t a;
    int16_t b;
};
struct sum_closure_t {
    int16_t (*func)(struct sum_closure_t *);
    struct scope_t * scope;
};

int16_t gc_i;

static struct sum_closure_t * func;

int16_t sum(struct sum_closure_t * closure)
{
    return closure->scope->a + closure->scope->b;
}
struct sum_closure_t * func_2(int16_t a)
{
    struct scope_t * scope;
    struct sum_closure_t * sum_closure;

    scope = malloc(sizeof(*scope));
    assert(scope != NULL);
    ARRAY_PUSH(gc_main, (void *)scope);

    scope->b = 20;
    scope->a = a;
    sum_closure = malloc(sizeof(*sum_closure));
    assert(sum_closure != NULL);
    ARRAY_PUSH(gc_main, (void *)sum_closure);
    sum_closure->func = sum;
    sum_closure->scope = scope;
    return sum_closure;
}
struct sum_closure_t * test()
{
    int16_t a;

    a = 10;
    return (func_2)(a);
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    func = test();
    printf("%d\n", func->func(func));
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
