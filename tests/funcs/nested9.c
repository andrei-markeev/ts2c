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

struct makeCounter_func_t {
    struct increment_closure_t * increment;
    struct increment_closure_t * decrement;
    struct value_closure_t * value;
};
struct scope_t {
    int16_t privateCounter;
};
struct increment_closure_t {
    void (*func)(struct increment_closure_t *);
    struct scope_t * scope;
};
struct value_closure_t {
    int16_t (*func)(struct value_closure_t *);
    struct scope_t * scope;
};

static struct array_pointer_t *gc_main;
static int16_t gc_i;

static struct makeCounter_func_t * (*makeCounter)();
static struct makeCounter_func_t * counter1;
static struct makeCounter_func_t * counter2;

void changeBy(int16_t val, int16_t* privateCounter)
{
    *privateCounter += val;
}
void increment_func(struct increment_closure_t * closure)
{
    changeBy(1, &closure->scope->privateCounter);
}
void decrement_func(struct increment_closure_t * closure)
{
    changeBy(-1, &closure->scope->privateCounter);
}
int16_t value_func(struct value_closure_t * closure)
{
    return closure->scope->privateCounter;
}
struct makeCounter_func_t * makeCounter_func()
{
    struct scope_t * scope;
    struct makeCounter_func_t * tmp_obj = NULL;
    struct increment_closure_t * increment_closure;
    struct increment_closure_t * decrement_closure;
    struct value_closure_t * value_closure;

    scope = malloc(sizeof(*scope));
    assert(scope != NULL);
    ARRAY_PUSH(gc_main, (void *)scope);

    scope->privateCounter = 0;
    increment_closure = malloc(sizeof(*increment_closure));
    assert(increment_closure != NULL);
    ARRAY_PUSH(gc_main, (void *)increment_closure);
    increment_closure->func = increment_func;
    increment_closure->scope = scope;
    decrement_closure = malloc(sizeof(*decrement_closure));
    assert(decrement_closure != NULL);
    ARRAY_PUSH(gc_main, (void *)decrement_closure);
    decrement_closure->func = decrement_func;
    decrement_closure->scope = scope;
    value_closure = malloc(sizeof(*value_closure));
    assert(value_closure != NULL);
    ARRAY_PUSH(gc_main, (void *)value_closure);
    value_closure->func = value_func;
    value_closure->scope = scope;
    tmp_obj = malloc(sizeof(*tmp_obj));
    assert(tmp_obj != NULL);
    ARRAY_PUSH(gc_main, (void *)tmp_obj);
    tmp_obj->increment = increment_closure;
    tmp_obj->decrement = decrement_closure;
    tmp_obj->value = value_closure;
    return tmp_obj;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    makeCounter = makeCounter_func;
    counter1 = makeCounter();
    counter2 = makeCounter();
    printf("%d\n", counter1->value->func(counter1->value));
    printf("%d\n", counter2->value->func(counter2->value));
    counter1->increment->func(counter1->increment);
    counter1->increment->func(counter1->increment);
    printf("%d\n", counter1->value->func(counter1->value));
    printf("%d\n", counter2->value->func(counter2->value));
    counter1->decrement->func(counter1->decrement);
    counter2->decrement->func(counter2->decrement);
    printf("%d\n", counter1->value->func(counter1->value));
    printf("%d\n", counter2->value->func(counter2->value));
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
