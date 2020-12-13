#include <stdio.h>
typedef short int16_t;
int16_t str_len(const char * str) {
    int16_t len = 0;
    int16_t i = 0;
    while (*str) {
        i = 1;
        if ((*str & 0xE0) == 0xC0) i=2;
        else if ((*str & 0xF0) == 0xE0) i=3;
        else if ((*str & 0xF8) == 0xF0) i=4;
        str += i;
        len += i == 4 ? 2 : 1;
    }
    return len;
}
static const char * s1;
static const char * s2;
static const char * s3;
static const char * s4;
int main(void) {
    s1 = "simple test";
    printf("%d\n", str_len(s1));
    s2 = "áäöß€𐍈";
    printf("%d\n", str_len(s2));
    s3 = "€";
    printf("%d\n", str_len(s3));
    s4 = "\xe4\xbd\xa0\xe5\xa5\xbd\xe4\xb8\x96\xe7\x95\x8c";
    printf("%d\n", str_len(s4));
    if (str_len(s3) > 1 || str_len(s2) != 7 || str_len(s1) < str_len(s2))
        printf("ERROR!\n");

    return 0;
}
