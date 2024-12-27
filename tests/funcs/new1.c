#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

typedef short int16_t;

struct this_t {
    int16_t test;
    int16_t hello;
};

static struct this_t * x;

void func1(struct this_t * this)
{
    this->test = 10;
    this->hello = 20;
}

int main(void) {
    x = malloc(sizeof(*x));
    assert(x != NULL);
    func1(x);
    printf("%d\n", x->test);
    free(x);

    return 0;
}
