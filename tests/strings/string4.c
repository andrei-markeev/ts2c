#include <string.h>

#include <stdio.h>

typedef short int16_t;

int16_t str_pos(const char * str, const char *search) {
    int16_t i;
    const char * found = strstr(str, search);
    int16_t pos = 0;
    if (found == 0)
        return -1;
    while (*str && str < found) {
        i = 1;
        if ((*str & 0xE0) == 0xC0) i=2;
        else if ((*str & 0xF0) == 0xE0) i=3;
        else if ((*str & 0xF8) == 0xF0) i=4;
        str += i;
        pos += i == 4 ? 2 : 1;
    }
    return pos;
}

static const char * s1;
static const char * s2;

int main(void) {
    s1 = "simple test";
    s2 = "áäöß€𐍈";
    printf("%d\n", str_pos(s1, "test"));
    printf("%d\n", str_pos(s1, s2));
    printf("%d\n", str_pos(s2, "test"));
    printf("%d\n", str_pos(s2, "á"));
    printf("%d\n", str_pos(s2, "ß€"));
    printf("%d\n", str_pos(s2, "€"));
    printf("%d\n", str_pos(s2, "𐍈"));

    return 0;
}
