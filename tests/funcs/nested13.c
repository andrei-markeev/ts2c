#include <stdio.h>

static void (*(*a)())();

void func()
{
    printf("here\n");
}
void (*a_func())()
{
    return (func);
}

int main(void) {
    a = a_func;
    a()();

    return 0;
}
