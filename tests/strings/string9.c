#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#define TRUE 1
#define FALSE 0
typedef unsigned char uint8_t;
typedef short int16_t;
struct regex_indices_struct_t {
    int16_t index;
    int16_t end;
};
struct regex_match_struct_t {
    int16_t index;
    int16_t end;
    struct regex_indices_struct_t *matches;
    int16_t matches_count;
};
typedef struct regex_match_struct_t regex_func_t(const char*, int16_t);
struct regex_struct_t {
    const char * str;
    regex_func_t * func;
};
#define ARRAY(T) struct {\
    int16_t size;\
    int16_t capacity;\
    T *data;\
} *
#define ARRAY_CREATE(array, init_capacity, init_size) {\
    array = malloc(sizeof(*array)); \
    array->data = malloc((init_capacity) * sizeof(*array->data)); \
    assert(array->data != NULL); \
    array->capacity = init_capacity; \
    array->size = init_size; \
}
#define ARRAY_PUSH(array, item) {\
    if (array->size == array->capacity) {  \
        array->capacity *= 2;  \
        array->data = realloc(array->data, array->capacity * sizeof(*array->data)); \
        assert(array->data != NULL); \
    }  \
    array->data[array->size++] = item; \
}
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
struct array_string_t {
    int16_t size;
    int16_t capacity;
    const char ** data;
};
void regex_clear_matches(struct regex_match_struct_t *match_info, int16_t groupN) {
    int16_t i;
    for (i = 0; i < groupN; i++) {
        match_info->matches[i].index = -1;
        match_info->matches[i].end = -1;
    }
}
struct array_string_t *regex_match(struct regex_struct_t regex, const char * s) {
    struct regex_match_struct_t match_info;
    struct array_string_t *match_array = NULL;
    int16_t i;

    match_info = regex.func(s, TRUE);
    if (match_info.index != -1) {
        ARRAY_CREATE(match_array, match_info.matches_count + 1, match_info.matches_count + 1);
        match_array->data[0] = str_substring(s, match_info.index, match_info.end);
        for (i = 0;i < match_info.matches_count; i++) {
            if (match_info.matches[i].index != -1 && match_info.matches[i].end != -1)
                match_array->data[i + 1] = str_substring(s, match_info.matches[i].index, match_info.matches[i].end);
            else
                match_array->data[i + 1] = str_substring(s, 0, 0);
        }
    }
    if (match_info.matches_count)
        free(match_info.matches);

    return match_array;
}
int16_t gc_i;
int16_t gc_j;

static ARRAY(ARRAY(ARRAY(void *))) gc_main_arrays_c;
static struct array_string_t * match;
static struct array_string_t * match_array;
static struct array_string_t * match_array_2;
static const char * html;
static struct regex_struct_t startTagRegex;
static struct array_string_t * match2;
static struct array_string_t * tmp_result;
static struct array_string_t * match_array_3;
static int16_t j;
static struct regex_struct_t endTagRegex;
static struct array_string_t * tmp_result_2;
static const char * substr;
static struct array_string_t * match_array_4;
static int16_t k;
static struct array_string_t * tmp_result_3;
static struct array_string_t * match_array_5;
static int16_t l;
static struct array_string_t * tmp_result_4;
static struct array_string_t * match_array_6;
static int16_t m;
struct regex_match_struct_t regex_2_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 't') next = 1;
        }
        if (state == 1) {
            if (ch == 'e') next = 2;
            if (ch == 's') next = 2;
        }
        if (state == 2) {
            if (ch == 'e') next = 2;
            if (ch == 's') next = 2;
            if (ch == 't') next = 3;
        }

        if (next == -1) {
            if (state == 3)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 3) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 3)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_2 = { "/t[es]+t/", regex_2_search };

struct regex_match_struct_t regex_3_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'l') next = 1;
        }
        if (state == 1) {
            if (ch == 'o') next = 2;
        }
        if (state == 2) {
            if (next == -1) next = 3;
            if (ch == 'l') next = 4;
        }
        if (state == 3) {
            if (next == -1) next = 3;
            if (ch == 'l') next = 4;
        }
        if (state == 4) {
            end = iterator;
            if (next == -1) next = 3;
            if (ch == 'l') next = 4;
        }

        if (next == -1) {
            if (state == 4)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 4) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 4)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_3 = { "/lo.*l/", regex_3_search };

struct regex_match_struct_t regex_4_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[3];
    if (capture) {
        result.matches = malloc(3 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 3);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == '<' && iterator == 0) next = 1;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 1) {
            if (ch == '!') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == '-') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'A' && ch <= 'Z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 2) {
            if (ch == '-') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'A' && ch <= 'Z') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 3) {
            if (ch == '	') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '!') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == '-') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'Z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 4) {
            if (ch == '	') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '-') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'Z') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 5) {
            if (ch == '	') { next = 8; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 8; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '-') next = 9;
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= ':') next = 9;
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'X') next = 9;
            if (ch == 'Z') next = 9;
            if (ch == '_') next = 9;
            if (ch >= 'a' && ch <= 'x') next = 9;
            if (ch == 'z') next = 9;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 6) {
            if (ch == '>') next = 7;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 8) {
            if (ch == '	') { next = 8; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 8; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '-') next = 9;
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= ':') next = 9;
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'X') next = 9;
            if (ch == 'Z') next = 9;
            if (ch == '_') next = 9;
            if (ch >= 'a' && ch <= 'x') next = 9;
            if (ch == 'z') next = 9;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 9) {
            if (ch == '	') { next = 11; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 11; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '-') next = 9;
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= ':') next = 9;
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'X') next = 9;
            if (ch == 'Z') next = 9;
            if (ch == '_') next = 9;
            if (ch >= 'a' && ch <= 'x') next = 9;
            if (ch == 'z') next = 9;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 10) {
            if (ch == '	') next = 12;
            if (ch == ' ') next = 12;
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 11) {
            if (ch == '	') { next = 11; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 11; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 12) {
            if (ch == '	') next = 12;
            if (ch == ' ') next = 12;
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 13) {
            if (ch == '	') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '"') next = 17;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 14) {
            if (ch == '	') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '\'') next = 18;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 15) {
            if (ch == '	') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 16; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 16) {
            if (ch == '	') { next = 19; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 19; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '-') next = 9;
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= ':') next = 9;
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'X') next = 9;
            if (ch == 'Z') next = 9;
            if (ch == '_') next = 9;
            if (ch >= 'a' && ch <= 'x') next = 9;
            if (ch == 'z') next = 9;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 17) {
            if (next == -1 && ch != '"') next = 17;
            if (ch == '"') { next = 20; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 18) {
            if (next == -1 && ch != '\'') next = 18;
            if (ch == '\'') { next = 20; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 19) {
            if (ch == '	') { next = 19; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 19; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 13; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 14; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '-') next = 9;
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch >= '0' && ch <= ':') next = 9;
            if (ch == '=') { next = 10; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '>') next = 7;
            if (ch >= 'A' && ch <= 'X') next = 9;
            if (ch == 'Z') next = 9;
            if (ch == '_') next = 9;
            if (ch >= 'a' && ch <= 'x') next = 9;
            if (ch == 'z') next = 9;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 15; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 20) {
            if (ch == '	') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 21; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 22; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 20; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 21) {
            if (ch == '	') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 21; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 22; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '"') next = 17;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 20; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 22) {
            if (ch == '	') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == ' ') { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } }
            if (ch == '"') { next = 21; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '\'') { next = 22; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == '/') { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (ch == '>') next = 7;
            if (next == -1 && ch != '\'') next = 18;
            if (next == -1 && ch != '>' && ch != '	' && ch != ' ') { next = 20; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 7)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 3);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 7) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 3);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 7)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 3;
    return result;
}
struct regex_struct_t regex_4 = { "/^<(!?[-A-Za-z0-9_]+)((?:\\s+[\\w\\-\\:]+(?:\\s*=\\s*(?:(?:\"[^\"]*\")|(?:'[^']*')|[^>\\s]+))?)*)\\s*(\\/?)>/", regex_4_search };

struct regex_match_struct_t regex_5_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[1];
    if (capture) {
        result.matches = malloc(1 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 1);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == '<' && iterator == 0) next = 1;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 1) {
            if (ch == '/') next = 2;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 2) {
            if (ch == '-') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'A' && ch <= 'Z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 3) {
            if (ch == '-') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= '0' && ch <= '9') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '>') next = 5;
            if (ch >= 'A' && ch <= 'Z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '_') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'a' && ch <= 'z') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (next == -1 && ch != '>') next = 4;
        }
        if (state == 4) {
            if (next == -1 && ch != '>') next = 4;
            if (ch == '>') next = 5;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 5)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 1);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 5) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 1);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 5)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_5 = { "/^<\\/([-A-Za-z0-9_]+)[^>]*>/", regex_5_search };

struct regex_match_struct_t regex_6_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[3];
    if (capture) {
        result.matches = malloc(3 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 3);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (capture && next == -1) {
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 1) {
            if (ch == 'b') { next = 2; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } }
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 2) {
            if (ch == 'a') { next = 3; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 3) {
            if (ch == 'b') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 4) {
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'b') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 5; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }

        if (next == -1) {
            if (state == 5)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 3);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 5) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 3);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 5)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 3;
    return result;
}
struct regex_struct_t regex_6 = { "/(a(ba)b+)+(c)/", regex_6_search };

struct regex_match_struct_t regex_7_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[1];
    if (capture) {
        result.matches = malloc(1 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 1);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == ' ') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'c') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'd') next = 3;
        }
        if (state == 1) {
            if (ch == ' ') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'c') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'd') next = 3;
        }
        if (state == 2) {
            if (ch == 'd') next = 3;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 3)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 1);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 3) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 1);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 3)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_7 = { "/[a ]*(c)?d/", regex_7_search };

struct regex_match_struct_t regex_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 't') next = 1;
        }
        if (state == 1) {
            if (ch == 'h') next = 2;
        }
        if (state == 2) {
            if (ch == 'i') next = 3;
        }
        if (state == 3) {
            if (ch == 'n') next = 4;
        }
        if (state == 4) {
            if (ch == 'g') next = 5;
        }

        if (next == -1) {
            if (state == 5)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 5) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 5)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex = { "/thing/", regex_search };

int main(void) {
    ARRAY_CREATE(gc_main_arrays_c, 2, 0);

    match = regex_match(regex, "something here");
    ARRAY_PUSH(gc_main_arrays_c, (void *)match);
    printf("%s\n", match->data[0]);
    match = regex_match(regex_2, "Matching string");
    ARRAY_PUSH(gc_main_arrays_c, (void *)match);
    if (match)
        printf("Incorrect!\n");
    match_array = regex_match(regex_3, "Hello world world!");
    printf("%s\n", match_array->data[0]);
    match_array_2 = regex_match(regex_3, "Hello world!");
    printf("%s\n", match_array_2->data[0]);
    html = "<html lang=\"en\"><body></body></html>";
    startTagRegex = regex_4;
    match2 = regex_match(startTagRegex, html);
    if (match2)
    {
        int16_t i;
        printf("[ ");
        for (i = 0; i < match2->size; i++) {
            if (i != 0)
                printf(", ");
            printf("\"%s\"", match2->data[i]);
        }
        printf(" ]\n");
    }
    match_array_3 = regex_match(startTagRegex, "<img src=\"test.png\" />");
    tmp_result = ((void *)match_array_3);
    printf("[ ");
    for (j = 0; j < tmp_result->size; j++) {
        if (j != 0)
            printf(", ");
        printf("\"%s\"", tmp_result->data[j]);
    }
    printf(" ]\n");
    endTagRegex = regex_5;
    substr = str_slice(html, 22, str_len(html));
    match_array_4 = regex_match(endTagRegex, substr);
    tmp_result_2 = ((void *)match_array_4);
    printf("[ ");
    for (k = 0; k < tmp_result_2->size; k++) {
        if (k != 0)
            printf(", ");
        printf("\"%s\"", tmp_result_2->data[k]);
    }
    printf(" ]\n");
    match_array_5 = regex_match(regex_6, "abababc");
    tmp_result_3 = ((void *)match_array_5);
    printf("[ ");
    for (l = 0; l < tmp_result_3->size; l++) {
        if (l != 0)
            printf(", ");
        printf("\"%s\"", tmp_result_3->data[l]);
    }
    printf(" ]\n");
    match_array_6 = regex_match(regex_7, "a cd");
    tmp_result_4 = ((void *)match_array_6);
    printf("[ ");
    for (m = 0; m < tmp_result_4->size; m++) {
        if (m != 0)
            printf(", ");
        printf("\"%s\"", tmp_result_4->data[m]);
    }
    printf(" ]\n");
    for (gc_i = 0; gc_i < (match_array ? match_array->size : 0); gc_i++) free((void*)match_array->data[gc_i]);
    for (gc_i = 0; gc_i < (match_array_2 ? match_array_2->size : 0); gc_i++) free((void*)match_array_2->data[gc_i]);
    for (gc_i = 0; gc_i < (match2 ? match2->size : 0); gc_i++) free((void*)match2->data[gc_i]);
    for (gc_i = 0; gc_i < (match_array_3 ? match_array_3->size : 0); gc_i++) free((void*)match_array_3->data[gc_i]);
    for (gc_i = 0; gc_i < (match_array_4 ? match_array_4->size : 0); gc_i++) free((void*)match_array_4->data[gc_i]);
    for (gc_i = 0; gc_i < (match_array_5 ? match_array_5->size : 0); gc_i++) free((void*)match_array_5->data[gc_i]);
    for (gc_i = 0; gc_i < (match_array_6 ? match_array_6->size : 0); gc_i++) free((void*)match_array_6->data[gc_i]);
    free(match_array ? match_array->data : NULL);
    free(match_array);
    free(match_array_2 ? match_array_2->data : NULL);
    free(match_array_2);
    free(match2 ? match2->data : NULL);
    free(match2);
    free(match_array_3 ? match_array_3->data : NULL);
    free(match_array_3);
    free(match_array_4 ? match_array_4->data : NULL);
    free(match_array_4);
    free((char *)substr);
    free(match_array_5 ? match_array_5->data : NULL);
    free(match_array_5);
    free(match_array_6 ? match_array_6->data : NULL);
    free(match_array_6);
    for (gc_i = 0; gc_i < gc_main_arrays_c->size; gc_i++) {
        for (gc_j = 0; gc_j < (gc_main_arrays_c->data[gc_i] ? gc_main_arrays_c->data[gc_i]->size : 0); gc_j++)
            free((void*)gc_main_arrays_c->data[gc_i]->data[gc_j]);
        free(gc_main_arrays_c->data[gc_i] ? gc_main_arrays_c->data[gc_i]->data : NULL);
        free(gc_main_arrays_c->data[gc_i]);
    }
    free(gc_main_arrays_c->data);
    free(gc_main_arrays_c);

    return 0;
}
