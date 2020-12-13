#include <string.h>
#include <stdlib.h>
#include <assert.h>
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
int16_t str_char_code_at(const char * str, int16_t pos) {
    int16_t i, res = 0;
    while (*str) {
        i = 1;
        if ((*str & 0xE0) == 0xC0) i=2;
        else if ((*str & 0xF0) == 0xE0) i=3;
        else if ((*str & 0xF8) == 0xF0) i=4;
        if (pos == 0) {
            res += (unsigned char)*str++;
            if (i > 1) {
                res <<= 6; res -= 0x3080;
                res += (unsigned char)*str++;
            }
            return res;
        }
        str += i;
        pos -= i == 4 ? 2 : 1;
    }
    return -1;
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
static const char * str;
static const char * char_at;
static const char * char_at_2;
static const char * char_at_3;
static const char * char_at_4;
int main(void) {
    str = "тест test";
    printf("%d\n", str_char_code_at(str, 3));
    printf("%d\n", str_char_code_at(str, 8));
    printf("%d\n", str_char_code_at(str, 10));
    printf("%d\n", str_char_code_at("hello world!", 10));
    char_at = str_substring(str, 3, (3) + 1);
    printf("%s\n", char_at);
    char_at_2 = str_substring(str, 8, (8) + 1);
    printf("%s\n", char_at_2);
    char_at_3 = str_substring(str, 10, (10) + 1);
    printf("%s\n", char_at_3);
    char_at_4 = str_substring("hello world!", 10, (10) + 1);
    printf("%s\n", char_at_4);
    free((char *)char_at);
    free((char *)char_at_2);
    free((char *)char_at_3);
    free((char *)char_at_4);

    return 0;
}
