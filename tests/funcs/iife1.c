#include <stdio.h>
static const char * x;
int main(void) {
    x = "global x";
    {
        const char * x;
        x = "inside ffe";
        printf("%s\n", x);
    };
    printf("%s\n", x);

    return 0;
}
