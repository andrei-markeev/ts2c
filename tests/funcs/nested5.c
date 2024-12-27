#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

typedef short int16_t;

int16_t str_len(const char * str) {
    int16_t len = 0;
    int16_t i = 0;
    while (*str) {
        i = 1;
        if ((*str & 0xE0) == 0xC0) i=2;
        else if ((*str & 0xF0) == 0xE0) i=3;
        else if ((*str & 0xF8) == 0xF0) i=4;
        str += i;
        len += i == 4 ? 2 : 1;
    }
    return len;
}

struct obj_t {
    int16_t a;
    const char * b;
};

void inc_obj_a(struct obj_t * obj)
{
    obj->a++;
}
void do_stuff()
{
    struct obj_t * obj;
    int16_t i;

    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    obj->a = 10;
    obj->b = "something";
    i = 0;
    for (;i < str_len(obj->b);i++)
        inc_obj_a(obj);
    printf("{ ");
    printf("a: %d", obj->a);    printf(", ");
    printf("b: \"%s\"", obj->b);
    printf(" }\n");
    free(obj);
}

int main(void) {
    do_stuff();

    return 0;
}
