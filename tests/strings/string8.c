#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#include <limits.h>

typedef short int16_t;

#define STR_INT16_T_BUFLEN ((CHAR_BIT * sizeof(int16_t) - 1) / 3 + 2)

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

const char * str_substring(const char * str, int16_t start, int16_t end) {
    int16_t i, tmp, pos, len = str_len(str), byte_start = -1;
    char *p, *buf;
    start = start < 0 ? 0 : (start > len ? len : start);
    end = end < 0 ? 0 : (end > len ? len : end);
    if (end < start) {
        tmp = start;
        start = end;
        end = tmp;
    }
    i = 0;
    pos = 0;
    p = (char *)str;
    while (*p) {
        if (start == pos)
            byte_start = p - str;
        if (end == pos)
            break;
        i = 1;
        if ((*p & 0xE0) == 0xC0) i=2;
        else if ((*p & 0xF0) == 0xE0) i=3;
        else if ((*p & 0xF8) == 0xF0) i=4;
        p += i;
        pos += i == 4 ? 2 : 1;
    }
    len = byte_start == -1 ? 0 : p - str - byte_start;
    buf = malloc(len + 1);
    assert(buf != NULL);
    memcpy(buf, str + byte_start, len);
    buf[len] = '\0';
    return buf;
}
const char * str_slice(const char * str, int16_t start, int16_t end) {
    int16_t len = str_len(str);
    start = start < 0 ? len + start : start;
    end = end < 0 ? len + end : end;
    if (end - start < 0)
        end = start;
    return str_substring(str, start, end);
}
void str_int16_t_cat(char *str, int16_t num) {
    char numstr[STR_INT16_T_BUFLEN];
    sprintf(numstr, "%d", num);
    strcat(str, numstr);
}

static const char * s1;
static const char * s2;
static const char * substr;
static const char * substr_2;
static const char * substr_3;
static char * tmp_result = NULL;
static const char * substr_4;
static const char * substr_5;
static const char * substr_6;
static const char * substr_7;
static const char * substr_8;
static char * tmp_result_2 = NULL;
static const char * substr_9;

int main(void) {
    s1 = "simple test";
    s2 = "áäöß€𐍈";
    substr = str_substring(s1, 1, 5);
    printf("%s\n", substr);
    substr_2 = str_substring(s2, -1, 2);
    printf("%s\n", substr_2);
    substr_3 = str_substring(s2, 9, 3);
    printf("%s\n", substr_3);
    tmp_result = malloc(strlen(s1) + strlen(s2) + 1);
    assert(tmp_result != NULL);
    tmp_result[0] = '\0';
    strcat(tmp_result, s1);
    strcat(tmp_result, s2);
    substr_4 = str_substring((tmp_result), 15, str_len((tmp_result)));
    printf("%s\n", substr_4);
    substr_5 = str_substring("test €€€ hello", 10, str_len("test €€€ hello"));
    printf("%s\n", substr_5);
    substr_6 = str_slice(s2, -1, 2);
    printf("%s\n", substr_6);
    substr_7 = str_slice(s2, -100, 2);
    printf("%s\n", substr_7);
    substr_8 = str_slice(s2, 1, -1);
    printf("%s\n", substr_8);
    tmp_result_2 = malloc(strlen("test €€€ ") + strlen(s1) + 1);
    assert(tmp_result_2 != NULL);
    tmp_result_2[0] = '\0';
    strcat(tmp_result_2, "test €€€ ");
    strcat(tmp_result_2, s1);
    substr_9 = str_slice((tmp_result_2), 10, str_len((tmp_result_2)));
    printf("%s\n", substr_9);
    free((char *)substr);
    free((char *)substr_2);
    free((char *)substr_3);
    free((char *)substr_4);
    free((char *)tmp_result);
    free((char *)substr_5);
    free((char *)substr_6);
    free((char *)substr_7);
    free((char *)substr_8);
    free((char *)substr_9);
    free((char *)tmp_result_2);

    return 0;
}
