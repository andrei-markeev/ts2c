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

void print(int16_t p)
{
    const char * e;

    TRY
    {
        if (p == 3)
        {
            ARRAY_PUSH(err_defs, "Parameter cannot be 3!");
            THROW(err_defs->size);
        }
        printf("%d\n", p);
    }
    CATCH
        e = err_defs->data[err_val - 1];
        printf("%s\n", e);
    END_TRY
}

int main(void) {
    ARRAY_CREATE(err_defs, 2, 0);

    TRY
    {
        int16_t i;
        i = 0;
        for (;i < 5;i++)
            print(i);
    }
    CATCH
        printf("Something went wrong!\n");
    END_TRY

    return 0;
}
