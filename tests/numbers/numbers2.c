#include <stdio.h>

typedef short int16_t;

int16_t parse_int16_t(const char * str) {
    int r;
    sscanf(str, "%d", &r);
    return (int16_t) r;
}

static int16_t n1;
static int16_t n2;
static int16_t n3;
static int16_t n4;
static int16_t n5;
static int16_t n6;
static int16_t n7;

int main(void) {
    n1 = parse_int16_t("3");
    printf("%d\n", n1);
    n2 = parse_int16_t("2342");
    printf("%d\n", n2);
    n3 = parse_int16_t("    3");
    printf("%d\n", n3);
    n4 = parse_int16_t("    1212");
    printf("%d\n", n4);
    n5 = parse_int16_t("    3  wew");
    printf("%d\n", n5);
    n6 = parse_int16_t("    902  wew");
    printf("%d\n", n6);
    n7 = parse_int16_t("   12 3  wew");
    printf("%d\n", n7);

    return 0;
}
