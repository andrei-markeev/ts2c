#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>
typedef short int16_t;
#define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)
int str_int16_t_cmp(const char * str, int16_t num) {
    char numstr[STR_INT16_T_BUFLEN];
    sprintf(numstr, "%d", num);
    return strcmp(str, numstr);
}
int16_t str_rpos(const char * str, const char *search) {
    int16_t i;
    const char * found = strstr(str, search);
    int16_t pos = 0;
    const char * end = str + (strlen(str) - strlen(search));
    if (found == 0)
        return -1;
    found = 0;
    while (end > str && found == 0)
        found = strstr(end--, search);
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
void str_int16_t_cat(char *str, int16_t num) {
    char numstr[STR_INT16_T_BUFLEN];
    sprintf(numstr, "%d", num);
    strcat(str, numstr);
}
static const char * s;
static char * tmp_result = NULL;
static char * tmp_result_4 = NULL;
static char * tmp_result_3 = NULL;
static char * tmp_result_2 = NULL;
int main(void) {
    tmp_result = malloc(STR_INT16_T_BUFLEN + strlen("") + 1);
    assert(tmp_result != NULL);
    tmp_result[0] = '\0';
    str_int16_t_cat(tmp_result, 5);
    strcat(tmp_result, "");
    s = tmp_result;
    if (str_int16_t_cmp(s, 5) == 0)
    {
        printf("s:");
        printf(" %s\n", s);
    }
    tmp_result_4 = malloc(strlen(s) + strlen("something") + 1);
    assert(tmp_result_4 != NULL);
    tmp_result_4[0] = '\0';
    strcat(tmp_result_4, s);
    strcat(tmp_result_4, "something");
    tmp_result_3 = malloc(strlen(tmp_result_4) + strlen(s) + 1);
    assert(tmp_result_3 != NULL);
    tmp_result_3[0] = '\0';
    strcat(tmp_result_3, tmp_result_4);
    strcat(tmp_result_3, s);
    tmp_result_2 = malloc(strlen(tmp_result_3) + STR_INT16_T_BUFLEN + 1);
    assert(tmp_result_2 != NULL);
    tmp_result_2[0] = '\0';
    strcat(tmp_result_2, tmp_result_3);
    str_int16_t_cat(tmp_result_2, (5 + 4));
    s = tmp_result_2;
    printf("%s", s);
    printf(" %d\n", str_rpos(s, "5"));
    free((char *)tmp_result);
    free((char *)tmp_result_2);
    free((char *)tmp_result_3);
    free((char *)tmp_result_4);

    return 0;
}
