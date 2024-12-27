#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

struct obj_t {
    const char * hello;
};

static struct obj_t * obj;

int main(void) {
    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    obj->hello = "World";
    printf("{ ");
    printf("hello: \"%s\"", obj->hello);
    printf(" }\n");
    free(obj);

    return 0;
}
