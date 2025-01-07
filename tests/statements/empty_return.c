#include <stdio.h>

void f()
{
    printf("this is a function with an empty return statement\n");
    return;
}

int main(void) {
    f();

    return 0;
}
