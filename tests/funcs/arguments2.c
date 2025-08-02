#include <stdio.h>

typedef short int16_t;

static const char * args[3];
static const char * args_2[3];
static const char * args_3[3];

void testArgs2(const char * firstString, const char * arguments[3], int16_t arguments_n)
{
    int16_t i;

    printf("%s\n", firstString);
    i = 1;
    for (;i < arguments_n;i++)
        printf("%s\n", arguments[i]);
}

int main(void) {
    args[0] = "123";
    testArgs2("123", args, 1);
    args_2[0] = "hello";
    args_2[1] = "world";
    testArgs2("hello", args_2, 2);
    args_3[0] = "too";
    args_3[1] = "many";
    args_3[2] = "params";
    testArgs2("too", args_3, 3);

    return 0;
}
