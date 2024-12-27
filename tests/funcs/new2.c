#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

struct this_t {
    const char * name;
};

static struct this_t * monkey;

void Monkey(struct this_t * this, const char * name)
{
    this->name = name;
}

int main(void) {
    monkey = malloc(sizeof(*monkey));
    assert(monkey != NULL);
    Monkey(monkey, "Gaston");
    printf("%s\n", monkey->name);
    free(monkey);

    return 0;
}
