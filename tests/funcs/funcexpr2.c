#include <stdio.h>

typedef short int16_t;

static int16_t arr[3] = { 1, 2, 3 };
static int16_t* tmp_result;

int16_t* func(int16_t arr[3])
{
    int16_t i;

    i = 0;
    for (;i < 3;i++)
        arr[i]++;
    return arr;
}

int main(void) {
    tmp_result = (func)(arr);
    printf("[ %d, %d, %d ]\n", tmp_result[0], tmp_result[1], tmp_result[2]);

    return 0;
}
