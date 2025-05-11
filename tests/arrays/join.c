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
#define ARRAY_POP(a) (a->size != 0 ? a->data[--a->size] : 0)

#define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)

void str_int16_t_cat(char *str, int16_t num) {
    char numstr[STR_INT16_T_BUFLEN];
    sprintf(numstr, "%d", num);
    strcat(str, numstr);
}

struct array_string_t {
    int16_t size;
    int16_t capacity;
    const char ** data;
};

static const char * arr[2] = { "Hello", "world!" };
static const char * str;
static int16_t i;
static int16_t len;
static struct array_string_t * arr2;
static int16_t j;
static char * tmp_joined_string;
static int16_t len_2;
static struct array_string_t * arr3;
static int16_t k;
static int16_t l;
static int16_t m;
static char * tmp_joined_string_2;
static int16_t len_3;
static int16_t arr4[4] = { 1, 2, 3, 7 };
static int16_t n;
static char * tmp_joined_string_3;
static int16_t tmp_array[4] = { 1, 2, 5, 2 };
static int16_t i_2;
static char * tmp_joined_string_4;
static const char * tmp_array_2[3] = { "happy", "new", "year" };
static int16_t i_3;
static char * tmp_joined_string_5;
static int16_t len_4;

int main(void) {
    len = 0;
    for (i = 0; i < 2; i++)
        len += strlen(arr[i]);
    str = malloc(len + strlen(", ")*(2-1) + 1);
    assert(str != NULL);
    ((char *)str)[0] = '\0';
    for (i = 0; i < 2; i++) {
        if (i > 0)
            strcat((char *)str, ", ");
        strcat((char *)str, arr[i]);
    }
    printf("%s\n", str);
    ARRAY_CREATE(arr2, 2, 1);
    arr2->data[0] = "something was there, but...";
    ARRAY_POP(arr2);
    len_2 = 0;
    for (j = 0; j < arr2->size; j++)
        len_2 += strlen(arr2->data[j]);
    tmp_joined_string = malloc(arr2->size == 0 ? 1 : len_2 + strlen(",")*(arr2->size-1) + 1);
    assert(tmp_joined_string != NULL);
    ((char *)tmp_joined_string)[0] = '\0';
    for (j = 0; j < arr2->size; j++) {
        if (j > 0)
            strcat((char *)tmp_joined_string, ",");
        strcat((char *)tmp_joined_string, arr2->data[j]);
    }
    printf("%s\n", tmp_joined_string);
    ARRAY_CREATE(arr3, 2+1+1+1, 0);
    arr3->size = arr3->capacity;
    k = 0;
    for (l = 0; l < 2; l++)
        arr3->data[k++] = arr[l];
    arr3->data[k++] = "and";
    arr3->data[k++] = "hi";
    arr3->data[k++] = "there";
    len_3 = 0;
    for (m = 0; m < arr3->size; m++)
        len_3 += strlen(arr3->data[m]);
    tmp_joined_string_2 = malloc(arr3->size == 0 ? 1 : len_3 + strlen(",")*(arr3->size-1) + 1);
    assert(tmp_joined_string_2 != NULL);
    ((char *)tmp_joined_string_2)[0] = '\0';
    for (m = 0; m < arr3->size; m++) {
        if (m > 0)
            strcat((char *)tmp_joined_string_2, ",");
        strcat((char *)tmp_joined_string_2, arr3->data[m]);
    }
    printf("%s\n", tmp_joined_string_2);
    tmp_joined_string_3 = malloc(STR_INT16_T_BUFLEN*4+strlen("_")*(4-1)+1);
    assert(tmp_joined_string_3 != NULL);
    ((char *)tmp_joined_string_3)[0] = '\0';
    for (n = 0; n < 4; n++) {
        if (n > 0)
            strcat((char *)tmp_joined_string_3, "_");
        str_int16_t_cat((char *)tmp_joined_string_3, arr4[n]);
    }
    printf("%s\n", tmp_joined_string_3);
    tmp_joined_string_4 = malloc(STR_INT16_T_BUFLEN*4+strlen(",")*(4-1)+1);
    assert(tmp_joined_string_4 != NULL);
    ((char *)tmp_joined_string_4)[0] = '\0';
    for (i_2 = 0; i_2 < 4; i_2++) {
        if (i_2 > 0)
            strcat((char *)tmp_joined_string_4, ",");
        str_int16_t_cat((char *)tmp_joined_string_4, tmp_array[i_2]);
    }
    printf("%s\n", tmp_joined_string_4);
    len_4 = 0;
    for (i_3 = 0; i_3 < 3; i_3++)
        len_4 += strlen(tmp_array_2[i_3]);
    tmp_joined_string_5 = malloc(len_4 + strlen(",")*(3-1) + 1);
    assert(tmp_joined_string_5 != NULL);
    ((char *)tmp_joined_string_5)[0] = '\0';
    for (i_3 = 0; i_3 < 3; i_3++) {
        if (i_3 > 0)
            strcat((char *)tmp_joined_string_5, ",");
        strcat((char *)tmp_joined_string_5, tmp_array_2[i_3]);
    }
    printf("%s\n", tmp_joined_string_5);
    free((char *)str);
    free(arr2->data);
    free(arr2);
    free((char *)tmp_joined_string);
    free(arr3->data);
    free(arr3);
    free((char *)tmp_joined_string_2);
    free((char *)tmp_joined_string_3);
    free((char *)tmp_joined_string_4);
    free((char *)tmp_joined_string_5);

    return 0;
}
