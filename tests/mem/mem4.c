#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>

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

#define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)

int16_t str_pos(const char * str, const char *search) {
    int16_t i;
    const char * found = strstr(str, search);
    int16_t pos = 0;
    if (found == 0)
        return -1;
    while (*str && str < found) {
        i = 1;
        if ((*str & 0xE0) == 0xC0) i=2;
        else if ((*str & 0xF0) == 0xE0) i=3;
        else if ((*str & 0xF8) == 0xF0) i=4;
        str += i;
        pos += i == 4 ? 2 : 1;
    }
    return pos;
}

void str_int16_t_cat(char *str, int16_t num) {
    char numstr[STR_INT16_T_BUFLEN];
    sprintf(numstr, "%d", num);
    strcat(str, numstr);
}

static int16_t gc_i;

static const char * variants[4] = { "banana", "kiwi", "pear", "plum" };
static ARRAY(void *) gc_212;

const char * alloc(int16_t n)
{
    char * tmp_result_2 = NULL;
    char * tmp_result = NULL;

    if (n < 4 - 1)
    {
        const char * s;
        tmp_result_2 = malloc(strlen(variants[n]) + strlen(",") + 1);
        assert(tmp_result_2 != NULL);
        tmp_result_2[0] = '\0';
        strcat(tmp_result_2, variants[n]);
        strcat(tmp_result_2, ",");
        tmp_result = malloc(strlen(tmp_result_2) + strlen(variants[n + 1]) + 1);
        assert(tmp_result != NULL);
        tmp_result[0] = '\0';
        strcat(tmp_result, tmp_result_2);
        strcat(tmp_result, variants[n + 1]);
        ARRAY_PUSH(gc_212, tmp_result);
        s = tmp_result;
        free((char *)tmp_result_2);
        return s;
    }
    else
    {
        free((char *)tmp_result_2);
        return "";
    }
    free((char *)tmp_result_2);
}
void use(int16_t index, const char * search)
{
    const char * value;

    ARRAY_CREATE(gc_212, 2, 0);

    value = alloc(index);
    if (str_pos(value, search) > -1)
        printf("%s\n", value);
    else
        printf("%s not found!\n", search);
    for (gc_i = 0; gc_i < gc_212->size; gc_i++)
        free(gc_212->data[gc_i]);
    free(gc_212->data);
    free(gc_212);
}

int main(void) {
    use(0, "banana");
    use(1, "plum");
    use(2, "plum");
    use(3, "pear");
    use(4, "kiwi");

    return 0;
}
