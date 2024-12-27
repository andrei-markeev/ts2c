#include <stdio.h>

void func_2()
{
    printf("hello from nested func!\n");
}
void (*func())()
{
    return func_2;
}
void (*(*a())())()
{
    return func;
}

int main(void) {
    a()()();

    return 0;
}
