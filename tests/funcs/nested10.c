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
    int16_t arg1;
    int16_t arg2;
};
struct nestedfunc_closure_t {
    int16_t (*func)(struct nestedfunc_closure_t *);
    struct scope_t * scope;
};

int16_t gc_i;

static struct nestedfunc_closure_t * tmp_closure;
int16_t nestedfunc(struct nestedfunc_closure_t * closure)
{
    return closure->scope->arg1 + closure->scope->arg2;

}
struct nestedfunc_closure_t * func1(int16_t arg1, int16_t arg2)
{
    struct scope_t * scope;
    struct nestedfunc_closure_t * nestedfunc_closure;

    scope = malloc(sizeof(*scope));
    assert(scope != NULL);
    ARRAY_PUSH(gc_main, (void *)scope);
    
    scope->arg1 = arg1;
    scope->arg2 = arg2;
    nestedfunc_closure = malloc(sizeof(*nestedfunc_closure));
    assert(nestedfunc_closure != NULL);
    ARRAY_PUSH(gc_main, (void *)nestedfunc_closure);
    nestedfunc_closure->func = nestedfunc;
    nestedfunc_closure->scope = scope;
    return nestedfunc_closure;

}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    printf("%d\n", (tmp_closure = func1(1, 2), tmp_closure->func(tmp_closure)));
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
