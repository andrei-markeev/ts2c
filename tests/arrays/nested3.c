#include <stdio.h>
typedef short int16_t;
static int16_t a;
static int16_t b;
static int16_t c[2][2];
static int16_t i;
int main(void) {
    a = 2;
    b = a + 1;
    c[0][0] = a;
    c[0][1] = b;
    c[1][0] = a;
    c[1][1] = b;
    printf("[ ");
    for (i = 0; i < 2; i++) {
        if (i != 0)
            printf(", ");
        printf("[ %d, %d ]", c[i][0], c[i][1]);
    }
    printf(" ]\n");

    return 0;
}
