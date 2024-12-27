#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

typedef short int16_t;

struct obj1_t {
    struct tmp_obj_t * obj2;
};
struct tmp_obj_t {
    const char * key1;
    int16_t key2;
    int16_t key3[3];
    struct tmp_obj_2_t * key4;
};
struct tmp_obj_2_t {
    const char * test;
};

static struct obj1_t * obj1;
static struct tmp_obj_t * tmp_obj = NULL;
static struct tmp_obj_2_t * tmp_obj_2 = NULL;

int main(void) {
    obj1 = malloc(sizeof(*obj1));
    assert(obj1 != NULL);
    tmp_obj_2 = malloc(sizeof(*tmp_obj_2));
    assert(tmp_obj_2 != NULL);
    tmp_obj_2->test = "something";
    tmp_obj = malloc(sizeof(*tmp_obj));
    assert(tmp_obj != NULL);
    tmp_obj->key1 = "blablabla";
    tmp_obj->key2 = 10;
    tmp_obj->key3[0] = 1;
    tmp_obj->key3[1] = 2;
    tmp_obj->key3[2] = 3;
    tmp_obj->key4 = tmp_obj_2;
    obj1->obj2 = tmp_obj;
    obj1->obj2->key2 = 20;
    obj1->obj2->key3[2] = 123;
    printf("{ ");
    printf("obj2: { ");
        printf("key1: \"%s\"", obj1->obj2->key1);    printf(", ");
    printf("key2: %d", obj1->obj2->key2);    printf(", ");
    printf("key3: [ %d, %d, %d ]", obj1->obj2->key3[0], obj1->obj2->key3[1], obj1->obj2->key3[2]);    printf(", ");
    printf("key4: { ");
            printf("test: \"%s\"", obj1->obj2->key4->test);
            printf(" }");
        printf(" }");
    printf(" }\n");
    free(obj1);
    free(tmp_obj);
    free(tmp_obj_2);

    return 0;
}
