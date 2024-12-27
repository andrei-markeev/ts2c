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

struct state_t {
    const char * prop;
};

int16_t gc_i;

static struct state_t * state;

void print()
{
    printf("{ ");
    printf("prop: \"%s\"", state->prop);
    printf(" }\n");
}
void saveState(struct state_t * newState)
{
    state = newState;
}
void generateState()
{
    struct state_t * obj;
    struct state_t * x;

    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    ARRAY_PUSH(gc_main, (void *)obj);
    obj->prop = "I don't believe \"transpiling\" from TS to C is possible!";
    x = obj;
    saveState(x);
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    state = malloc(sizeof(*state));
    assert(state != NULL);
    ARRAY_PUSH(gc_main, (void *)state);
    state->prop = "hi";
    generateState();
    print();
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
