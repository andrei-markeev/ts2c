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

#include <stdlib.h>
#include <time.h>

static struct array_pointer_t *gc_main;
static int16_t gc_i;

static int16_t x;
static int16_t y;
static struct tm * my_time;
static char buff[70];

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);

    printf("%d\n", abs(-5));
    printf("%d\n", abs(10));
    srand(123);
    x = rand();
    y = rand();
    printf("%s\n", x == y ? "true" : "false");
    printf("%s\n", x <= RAND_MAX ? "true" : "false");
    my_time = malloc(sizeof(*my_time));
    assert(my_time != NULL);
    ARRAY_PUSH(gc_main, (void *)my_time);
    my_time->tm_year = 112;
    my_time->tm_mon = 9;
    my_time->tm_mday = 9;
    my_time->tm_hour = 8;
    my_time->tm_min = 10;
    my_time->tm_sec = 20;
    my_time->tm_yday = 0;
    my_time->tm_wday = 0;
    my_time->tm_isdst = 0;
    if (strftime(buff, 70, "%A %c", my_time))
        printf("%s\n", buff);
    else
        printf("strftime failed!\n");
    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
