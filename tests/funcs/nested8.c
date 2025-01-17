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
    int16_t a;
};
struct closure_t {
    struct null * (*func)(int16_t, struct closure_t *);
    struct scope_t * scope;
};
struct scope_t_2 {
    int16_t a;
    int16_t b;
};
struct closure_2_t {
    struct null * (*func)(int16_t, struct closure_2_t *);
    struct scope_t_2 * scope;
};
struct scope_t_3 {
    int16_t c;
    int16_t a;
    int16_t b;
};
struct closure_3_t {
    int16_t (*func)(int16_t, struct closure_3_t *);
    struct scope_t_3 * scope;
};

static ARRAY(void *) gc_main;
static int16_t gc_i;

static int16_t e;
static struct closure_t * f1;
static struct closure_2_t * f2;
static struct closure_3_t * f3;
static int16_t f4;

int16_t func_3(int16_t d, struct closure_3_t * closure)
{
    return closure->scope->a + closure->scope->b + closure->scope->c + d + e;
}
struct closure_3_t * func_2(int16_t c, struct closure_2_t * closure)
{
    struct scope_t_3 * scope;
    struct closure_3_t * closure_3;

    scope = malloc(sizeof(*scope));
    assert(scope != NULL);
    ARRAY_PUSH(gc_main, (void *)scope);

    scope->a = closure->scope->a;
    scope->b = closure->scope->b;
    scope->c = c;
    closure_3 = malloc(sizeof(*closure_3));
    assert(closure_3 != NULL);
    ARRAY_PUSH(gc_main, (void *)closure_3);
    closure_3->func = func_3;
    closure_3->scope = scope;
    return closure_3;
}
struct closure_2_t * func(int16_t b, struct closure_t * closure)
{
    struct scope_t_2 * scope;
    struct closure_2_t * closure_2;

    scope = malloc(sizeof(*scope));
    assert(scope != NULL);
    ARRAY_PUSH(gc_main, (void *)scope);

    scope->a = closure->scope->a;
    scope->b = b;
    closure_2 = malloc(sizeof(*closure_2));
    assert(closure_2 != NULL);
    ARRAY_PUSH(gc_main, (void *)closure_2);
    closure_2->func = func_2;
    closure_2->scope = scope;
    return closure_2;
}
struct closure_t * sum(int16_t a)
{
    struct scope_t * scope;
    struct closure_t * closure;

    scope = malloc(sizeof(*scope));
    assert(scope != NULL);
    ARRAY_PUSH(gc_main, (void *)scope);

    scope->a = a;
    closure = malloc(sizeof(*closure));
    assert(closure != NULL);
    ARRAY_PUSH(gc_main, (void *)closure);
    closure->func = func;
    closure->scope = scope;
    return closure;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    e = 10;
    f1 = sum(1);
    f2 = f1->func(2, f1);
    f3 = f2->func(3, f2);
    f4 = f3->func(4, f3);
    printf("%d\n", f4);
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
