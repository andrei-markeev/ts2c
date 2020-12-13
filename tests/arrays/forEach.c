#include <stdio.h>
typedef short int16_t;
static int16_t numbers[3] = { 30, 40, 50 };
static int16_t summ;
static int16_t i;
int main(void) {
    summ = 0;
    for (i = 0; i < 3; i++) {
        static int16_t item;
        item = numbers[i];
        summ = summ + item;
    };
    printf("%d\n", summ);

    return 0;
}
