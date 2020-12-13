#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

struct obj1_t {
    struct obj2_t * o2;
};
struct obj2_t {
    void * o1;
};

static struct obj1_t * obj1;
static struct obj2_t * obj2;
int main(void) {
    obj1 = malloc(sizeof(*obj1));
    assert(obj1 != NULL);
    obj2 = malloc(sizeof(*obj2));
    assert(obj2 != NULL);
    obj1->o2 = obj2;
    obj2->o1 = obj1;
    printf("{ ");
    printf("o2: { ");
        printf("o1: [object Object]");
        printf(" }");
    printf(" }\n");
    printf("{ ");
    printf("o1: [object Object]");
    printf(" }\n");
    free(obj1);
    free(obj2);

    return 0;
}
