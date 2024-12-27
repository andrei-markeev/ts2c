#include <stdio.h>

typedef short int16_t;

int16_t two(int16_t i)
{
    return 2 * i;
}
int16_t one(int16_t i)
{
    return two(i);
}

int main(void) {
    printf("%d\n", one(3));

    return 0;
}
