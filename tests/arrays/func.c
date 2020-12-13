#include <stdio.h>
typedef short int16_t;
static int16_t res;
static int16_t tmp_array[6] = { 10, 20, 60, 30, 20, 60 };
int16_t tail(int16_t arr[6], int16_t pos, int16_t max)
{
    if (pos == 6 - 1)
        return arr[pos] > arr[max] ? arr[pos] : arr[max];
    max = arr[pos] > arr[max] ? pos : max;
    pos++;
    return tail(arr, pos, max);

}

int main(void) {
    res = tail(tmp_array, 0, 0);
    printf("%d\n", res);

    return 0;
}
