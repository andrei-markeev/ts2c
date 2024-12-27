#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

struct obj_t {
    const char * hello;
};
struct obj2_t {
    const char * initial;
    const char * added;
    const char * added2;
};

static struct obj_t * obj;
static struct obj2_t * obj2;

int main(void) {
    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    obj->hello = "world";
    printf("{ ");
    printf("hello: \"%s\"", obj->hello);
    printf(" }\n");
    obj2 = malloc(sizeof(*obj2));
    assert(obj2 != NULL);
    obj2->initial = "property";
    obj2->added = "property 2";
    obj2->added2 = "property 3";
    printf("{ ");
    printf("initial: \"%s\"", obj2->initial);    printf(", ");
    printf("added: \"%s\"", obj2->added);    printf(", ");
    printf("added2: \"%s\"", obj2->added2);
    printf(" }\n");
    free(obj);
    free(obj2);

    return 0;
}
