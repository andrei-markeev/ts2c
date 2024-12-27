#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>

typedef short int16_t;

#define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)

void str_int16_t_cat(char *str, int16_t num) {
    char numstr[STR_INT16_T_BUFLEN];
    sprintf(numstr, "%d", num);
    strcat(str, numstr);
}

static const char * s1;
static const char * s2;
static int16_t n;
static const char * s3;
static char * concatenated_str;

int main(void) {
    s1 = "Hello";
    s2 = "World";
    n = 10;
    printf("%s", s1);
    printf("%s\n", s2);
    printf("%s", s1);
    printf("%d\n", n);
    printf("%d", n);
    printf("%s", s2);
    printf("%s\n", s1);
    s3 = malloc(strlen(s1)+strlen(" ")+strlen(s2)+strlen("! ")+STR_INT16_T_BUFLEN+strlen(" times") + 1);
    assert(s3 != NULL);
    ((char *)s3)[0] = '\0';
    strcat((char *)s3, s1);
    strcat((char *)s3, " ");
    strcat((char *)s3, s2);
    strcat((char *)s3, "! ");
    str_int16_t_cat((char *)s3, n);
    strcat((char *)s3, " times");
    printf("%s\n", s3);
    concatenated_str = malloc(strlen(s2)+strlen(s1) + 1);
    assert(concatenated_str != NULL);
    ((char *)concatenated_str)[0] = '\0';
    strcat((char *)concatenated_str, s2);
    strcat((char *)concatenated_str, s1);
    printf("%s\n", concatenated_str);
    free((char *)s3);
    free((char *)concatenated_str);

    return 0;
}
