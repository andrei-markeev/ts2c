#include <stdio.h>

typedef short int16_t;

static int16_t n;
static int16_t b;

int main(void) {
    n = 0;
    n += 5;
    n *= 2;
    printf("%d\n", n);
    n -= 3;
    printf("%d\n", n);
    b = 10;
    n -= b / 2;
    printf("%d\n", n);

    return 0;
}
