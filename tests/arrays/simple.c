#include <stdio.h>
typedef short int16_t;
static int16_t int_array[3] = { 10, 20, 30 };
static const char * string_array[2] = { "Hello", "World!" };
int main(void) {
    printf("[ %d, %d, %d ]\n", int_array[0], int_array[1], int_array[2]);
    printf("[ \"%s\", \"%s\" ]\n", string_array[0], string_array[1]);

    return 0;
}
