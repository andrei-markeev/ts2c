#include <stdio.h>

typedef short int16_t;

static int16_t a;
static int16_t b;

int main(void) {
    printf("%d\n", 2 + 2);
    printf("%d\n", 22767 + 10000);
    printf("%d\n", -22767 - 10000);
    printf("%d\n", -22767 + (-10000));
    a = 32767;
    b = -32767;
    printf("%d\n", a + b);
    printf("%d\n", a - 10000);

    return 0;
}
