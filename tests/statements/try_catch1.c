#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

#include <setjmp.h>

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

struct array_string_t {
    int16_t size;
    int16_t capacity;
    const char ** data;
};

int err_i = 0;
jmp_buf err_jmp[10];
#define TRY { int err_val = setjmp(err_jmp[err_i++]); if (!err_val) {
#define CATCH } else {
#define THROW(x) longjmp(err_jmp[--err_i], x)
struct array_string_t * err_defs;
#define END_TRY err_defs->size--; } }

static int16_t x;

int main(void) {
    ARRAY_CREATE(err_defs, 2, 0);

    x = 1;
    TRY
    {
        if (x)
        {
            ARRAY_PUSH(err_defs, "test error");
            THROW(err_defs->size);
        }
        printf("Unreachable\n");
    }
    CATCH
        printf("Error occured!\n");
    END_TRY

    return 0;
}
