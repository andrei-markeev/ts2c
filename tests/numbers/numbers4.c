#include <stdio.h>
typedef short int16_t;
typedef unsigned short uint16_t;
static int16_t number;
int main(void) {
    number = 3072;
    printf("Positive:");
    printf(" %d\n", number);
    printf(">>");
    printf(" %d\n", number >> 3);
    number >>= 3;
    printf(">>=");
    printf(" %d\n", number);
    number = 3072;
    printf(">>>");
    printf(" %d\n", ((uint16_t)number) >> 3);
    number = ((uint16_t)number) >> 3;
    printf(">>>=");
    printf(" %d\n", number);
    number = 3072;
    printf("<<");
    printf(" %d\n", number << 2);
    number <<= 2;
    printf("<<=");
    printf(" %d\n", number);
    number = -2;
    printf("Negative:");
    printf(" %d\n", number);
    printf(">>");
    printf(" %d\n", number >> 1);
    number >>= 1;
    printf(">>=");
    printf(" %d\n", number);
    number = -2;
    printf(">>>");
    printf(" %d\n", ((uint16_t)number) >> 1);
    number = ((uint16_t)number) >> 1;
    printf(">>>=");
    printf(" %d\n", number);

    return 0;
}
