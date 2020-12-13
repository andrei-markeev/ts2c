#include <stdio.h>
typedef short int16_t;
int16_t nested()
{
    return 10;

}
int16_t func()
{
    return nested();

}

int main(void) {
    printf("%d\n", func());

    return 0;
}
