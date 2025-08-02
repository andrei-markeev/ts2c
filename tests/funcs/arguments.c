#include <stdio.h>

typedef short int16_t;

static const char * args[2];
static const char * args_2[2];

void testArgs(const char * arguments[2], int16_t arguments_n)
{
    printf("%d\n", arguments_n);
    printf("%s\n", arguments[0]);
}

int main(void) {
    args[0] = "string";
    testArgs(args, 1);
    args_2[0] = "hello";
    args_2[1] = "world";
    testArgs(args_2, 2);

    return 0;
}
