#include <string.h>
#include <stdio.h>
#include <limits.h>
typedef short int16_t;
#define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)
int str_int16_t_cmp(const char * str, int16_t num) {
    char numstr[STR_INT16_T_BUFLEN];
    sprintf(numstr, "%d", num);
    return strcmp(str, numstr);
}
static const char * s;
static int16_t n;
int main(void) {
    s = "10";
    n = 10;
    printf("%s\n", strcmp(s, "10") == 0 ? "true" : "false");
    printf("%s\n", strcmp(s, "10") == 0 ? "true" : "false");
    printf("%s\n", str_int16_t_cmp(s, n) == 0 ? "true" : "false");
    printf("%s\n", str_int16_t_cmp(s, 5 * 2) == 0 ? "true" : "false");
    printf("%s\n", str_int16_t_cmp(s, 5 * 2 + 1) == 0 ? "true" : "false");

    return 0;
}
