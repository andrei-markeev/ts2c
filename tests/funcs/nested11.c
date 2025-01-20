#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>

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

#define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)

void str_int16_t_cat(char *str, int16_t num) {
    char numstr[STR_INT16_T_BUFLEN];
    sprintf(numstr, "%d", num);
    strcat(str, numstr);
}

struct array_pointer_t {
    int16_t size;
    int16_t capacity;
    void ** data;
};

static struct array_pointer_t *gc_main;
static int16_t gc_i;

void bar(int16_t a, const char ** s)
{
    char * tmp_result_2 = NULL;
    char * tmp_result = NULL;

    tmp_result_2 = malloc(strlen(" hello ") + STR_INT16_T_BUFLEN + 1);
    assert(tmp_result_2 != NULL);
    tmp_result_2[0] = '\0';
    strcat(tmp_result_2, " hello ");
    str_int16_t_cat(tmp_result_2, a);
    tmp_result = malloc(strlen(*s) + strlen(tmp_result_2) + 1);
    assert(tmp_result != NULL);
    tmp_result[0] = '\0';
    strcat(tmp_result, *s);
    strcat(tmp_result, tmp_result_2);
    ARRAY_PUSH(gc_main, tmp_result);
    *s = tmp_result;

    free((char *)tmp_result_2);
}
const char * foo()
{
    const char * s;

    s = "a";
    bar(5, &s);
    return s;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    printf("%s\n", foo());
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
