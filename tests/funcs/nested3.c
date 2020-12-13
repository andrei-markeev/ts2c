#include <stdio.h>
typedef short int16_t;
void add(int16_t n, int16_t* sum, int16_t k)
{
    (*sum = *sum + n * k);
    printf("%d\n", *sum);

}
void do_stuff()
{
    int16_t sum;
    int16_t k;
    sum = 0;
    k = 2;
    add(10, &sum, k);
    add(30, &sum, k);
    add(5, &sum, k);

}

int main(void) {
    do_stuff();

    return 0;
}
