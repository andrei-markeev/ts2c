#include <stdio.h>

typedef short int16_t;

static int16_t a[4] = { 1, 2, 3, 4 };
static int16_t i;

void add(int16_t i, int16_t arr[4])
{
    arr[i]++;
}
void do_stuff(int16_t arr[4])
{
    int16_t i;

    i = 0;
    for (;i < 4;i++)
        add(i, arr);
}

int main(void) {
    do_stuff(a);
    printf("[ ");
    for (i = 0; i < 4; i++) {
        if (i != 0)
            printf(", ");
        printf("%d", a[i]);
    }
    printf(" ]\n");

    return 0;
}
