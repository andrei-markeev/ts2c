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

struct sum_t {
    struct func_4_t * (*func)(int16_t, struct sum_t *);
    int16_t a;
};
struct func_4_t {
    struct func_5_t * (*func)(int16_t, struct func_4_t *);
    int16_t a;
    int16_t b;
};
struct func_5_t {
    int16_t (*func)(int16_t, struct func_5_t *);
    int16_t c;
    int16_t a;
    int16_t b;
};

int16_t gc_i;

static int16_t e;
static struct sum_t * f1;
static struct func_4_t * f2;
static struct func_5_t * f3;
static int16_t f4;
int16_t func_6(int16_t d, struct func_5_t * closure)
{
    return closure->a + closure->b + closure->c + d + e;

}
struct func_5_t * func_5(int16_t c, struct func_4_t * closure)
{
    struct func_5_t * func_3;
    func_3 = malloc(sizeof(*func_3));
    assert(func_3 != NULL);
    ARRAY_PUSH(gc_main, (void *)func_3);
    func_3->func = func_6;
    func_3->c = c;
    func_3->a = closure->a;
    func_3->b = closure->b;
    return func_3;

}
struct func_4_t * func_4(int16_t b, struct sum_t * closure)
{
    struct func_4_t * func_2;
    func_2 = malloc(sizeof(*func_2));
    assert(func_2 != NULL);
    ARRAY_PUSH(gc_main, (void *)func_2);
    func_2->func = func_5;
    func_2->a = closure->a;
    func_2->b = b;
    return func_2;

}
struct sum_t * sum(int16_t a)
{
    struct sum_t * func;
    func = malloc(sizeof(*func));
    assert(func != NULL);
    ARRAY_PUSH(gc_main, (void *)func);
    func->func = func_4;
    func->a = a;
    return func;

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
