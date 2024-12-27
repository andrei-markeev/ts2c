#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

struct obj_t {
    struct tmp_obj_t * test;
};
struct tmp_obj_t {
    const char * hello;
    void * test2;
};

static struct obj_t * obj;
static struct tmp_obj_t * tmp_obj = NULL;

int main(void) {
    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    tmp_obj = malloc(sizeof(*tmp_obj));
    assert(tmp_obj != NULL);
    tmp_obj->hello = "world";
    obj->test = tmp_obj;
    obj->test->test2 = obj;
    printf("{ ");
    printf("test: { ");
        printf("hello: \"%s\"", obj->test->hello);    printf(", ");
    printf("test2: [object Object]");
        printf(" }");
    printf(" }\n");
    free(obj);
    free(tmp_obj);

    return 0;
}
