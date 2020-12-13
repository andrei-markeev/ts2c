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
void regex_clear_matches(struct regex_match_struct_t *match_info, int16_t groupN) {
    int16_t i;
    for (i = 0; i < groupN; i++) {
        match_info->matches[i].index = -1;
        match_info->matches[i].end = -1;
    }
}

static int16_t matched;
static int16_t count;
struct regex_match_struct_t regex_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'n') next = 1;
            if (next == -1) next = 2;
        }
        if (state == 1) {
            if (ch == 'a') next = 3;
            if (ch == 'n') next = 1;
            if (next == -1) next = 2;
        }
        if (state == 2) {
            if (ch == 'a') next = 3;
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
struct regex_struct_t regex = { "/n*.a/", regex_search };

struct regex_match_struct_t regex_2_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 2;
            if (ch == 'n') next = 1;
        }
        if (state == 1) {
            if (ch == 'a') next = 2;
            if (ch == 'n') next = 1;
        }

        if (next == -1) {
            if (state == 2)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 2) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_2 = { "/n*a/", regex_2_search };

struct regex_match_struct_t regex_3_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'n') next = 1;
        }
        if (state == 1) {
            if (next == -1) next = 2;
            if (ch == 'a') next = 3;
        }
        if (state == 2) {
            if (next == -1) next = 2;
            if (ch == 'a') next = 3;
        }
        if (state == 3) {
            end = iterator;
            if (next == -1) next = 2;
            if (ch == 'a') next = 3;
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
struct regex_struct_t regex_3 = { "/n.*a/", regex_3_search };

struct regex_match_struct_t regex_4_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'n') next = 1;
        }
        if (state == 1) {
            if (next == -1) next = 2;
        }
        if (state == 2) {
            if (ch == 'a') next = 3;
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
struct regex_struct_t regex_4 = { "/n.a/", regex_4_search };

struct regex_match_struct_t regex_5_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 2;
            if (ch == 'd') next = 3;
            if (ch == 'n') next = 1;
        }
        if (state == 1) {
            if (ch == 'a') next = 2;
            if (ch == 'd') next = 3;
            if (ch == 'n') next = 1;
        }
        if (state == 2) {
            if (ch == 'a') next = 2;
            if (ch == 'd') next = 3;
            if (ch == 'n') next = 1;
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
struct regex_struct_t regex_5 = { "/n*a*d/", regex_5_search };

struct regex_match_struct_t regex_6_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'n') next = 1;
        }
        if (state == 1) {
            if (ch == 'a') next = 3;
            if (ch == 'd') next = 4;
            if (ch == 'n') next = 2;
        }
        if (state == 2) {
            if (ch == 'a') next = 3;
            if (ch == 'd') next = 4;
            if (ch == 'n') next = 2;
        }
        if (state == 3) {
            if (ch == 'a') next = 3;
            if (ch == 'd') next = 4;
            if (ch == 'n') next = 2;
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
struct regex_struct_t regex_6 = { "/nn*a*d/", regex_6_search };

struct regex_match_struct_t regex_7_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (next == -1) next = 1;
            if (ch == 'a') next = 2;
        }
        if (state == 1) {
            if (next == -1) next = 1;
            if (ch == 'a') next = 2;
        }
        if (state == 2) {
            if (ch == 'a') next = 2;
            if (ch == 'f') next = 4;
            if (next == -1) next = 3;
        }
        if (state == 3) {
            if (ch == 'a') next = 2;
            if (ch == 'f') next = 4;
            if (next == -1) next = 3;
        }
        if (state == 4) {
            if (ch == '2') next = 7;
            if (ch == 'f') next = 6;
            if (next == -1) next = 5;
        }
        if (state == 5) {
            if (next == -1) next = 5;
            if (ch == 'f') next = 4;
        }
        if (state == 6) {
            if (ch == '2') next = 7;
            if (ch == 'f') next = 6;
            if (next == -1) next = 5;
        }
        if (state == 7) {
            if (ch == '3') next = 8;
        }
        if (state == 8) {
            if (ch == '3') next = 9;
        }
        if (state == 9) {
            if (ch == '3') next = 10;
        }
        if (state == 10) {
            if (ch == '4') next = 12;
            if (ch == '5') next = 11;
        }
        if (state == 11) {
            if (ch == '4') next = 12;
            if (ch == '5') next = 11;
        }

        if (next == -1) {
            if (state == 12)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 12) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 12)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_7 = { "/.*a.*ff*23335*4/", regex_7_search };

struct regex_match_struct_t regex_8_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'f') next = 1;
        }
        if (state == 1) {
            if (ch == '2') next = 3;
            if (ch == 'f') next = 2;
        }
        if (state == 2) {
            if (ch == '2') next = 3;
            if (ch == 'f') next = 2;
        }
        if (state == 3) {
            if (ch == '3') next = 4;
        }
        if (state == 4) {
            if (ch == '3') next = 5;
        }
        if (state == 5) {
            if (ch == '3') next = 6;
        }
        if (state == 6) {
            end = iterator;
            if (ch == '5') next = 7;
        }
        if (state == 7) {
            end = iterator;
            if (ch == '5') next = 7;
        }

        if (next == -1) {
            if (state == 6 || state == 7)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 6 && state != 7) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 6 && state != 7)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_8 = { "/ff*23335*/", regex_8_search };

struct regex_match_struct_t regex_9_search(const char *str, int16_t capture) {
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
            if (ch == 'x') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
        }
        if (state == 1) {
            if (ch == 'x') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 2) {
            if (ch == 'x') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'y') next = 3;
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
struct regex_struct_t regex_9 = { "/(x+x+)+y/", regex_9_search };

struct regex_match_struct_t regex_10_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (next == -1) next = 2;
        }
        if (state == 2) {
            if (ch == 'b') next = 3;
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
struct regex_struct_t regex_10 = { "/a.b/", regex_10_search };

struct regex_match_struct_t regex_11_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_11 = { "/abc/", regex_11_search };

struct regex_match_struct_t regex_12_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 3;
        }
        if (state == 2) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_12 = { "/ab*c/", regex_12_search };

struct regex_match_struct_t regex_13_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_13 = { "/ab*bc/", regex_13_search };

struct regex_match_struct_t regex_14_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            if (ch == 'b') next = 3;
        }
        if (state == 3) {
            if (ch == 'b') next = 3;
            if (ch == 'c') next = 4;
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
struct regex_struct_t regex_14 = { "/ab+bc/", regex_14_search };

struct regex_match_struct_t regex_15_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            if (ch == 'b') next = 3;
            if (ch == 'c') next = 4;
        }
        if (state == 3) {
            if (ch == 'c') next = 4;
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
struct regex_struct_t regex_15 = { "/ab?bc/", regex_15_search };

struct regex_match_struct_t regex_16_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 3;
        }
        if (state == 2) {
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_16 = { "/ab?c/", regex_16_search };

struct regex_match_struct_t regex_17_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a' && iterator == 0) next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            if (ch == 'c' && iterator == len - 1) next = 3;
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
struct regex_struct_t regex_17 = { "/^abc$/", regex_17_search };

struct regex_match_struct_t regex_18_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a' && iterator == 0) next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_18 = { "/^abc/", regex_18_search };

struct regex_match_struct_t regex_19_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            if (ch == 'c' && iterator == len - 1) next = 3;
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
struct regex_struct_t regex_19 = { "/abc$/", regex_19_search };

struct regex_match_struct_t regex_20_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (next == -1) next = 2;
        }
        if (state == 2) {
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_20 = { "/a.c/", regex_20_search };

struct regex_match_struct_t regex_21_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (next == -1) next = 2;
            if (ch == 'c') next = 3;
        }
        if (state == 2) {
            if (next == -1) next = 2;
            if (ch == 'c') next = 3;
        }
        if (state == 3) {
            end = iterator;
            if (next == -1) next = 2;
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_21 = { "/a.*c/", regex_21_search };

struct regex_match_struct_t regex_22_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch >= 'b' && ch <= 'c') next = 2;
        }
        if (state == 2) {
            if (ch == 'd') next = 3;
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
struct regex_struct_t regex_22 = { "/a[bc]d/", regex_22_search };

struct regex_match_struct_t regex_23_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch >= 'b' && ch <= 'd') next = 2;
        }
        if (state == 2) {
            if (ch == 'e') next = 3;
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
struct regex_struct_t regex_23 = { "/a[b-d]e/", regex_23_search };

struct regex_match_struct_t regex_24_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch >= 'b' && ch <= 'd') next = 2;
        }

        if (next == -1) {
            if (state == 2)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 2) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_24 = { "/a[b-d]/", regex_24_search };

struct regex_match_struct_t regex_25_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == '-') next = 2;
            if (ch == 'b') next = 2;
        }

        if (next == -1) {
            if (state == 2)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 2) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_25 = { "/a[-b]/", regex_25_search };

struct regex_match_struct_t regex_26_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == '-') next = 2;
            if (ch == 'b') next = 2;
        }

        if (next == -1) {
            if (state == 2)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 2) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_26 = { "/a[\\-b]/", regex_26_search };

struct regex_match_struct_t regex_27_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == ']') next = 2;
        }

        if (next == -1) {
            if (state == 2)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 2) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_27 = { "/a]/", regex_27_search };

struct regex_match_struct_t regex_28_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (next == -1 && ch != 'b' && ch != 'c') next = 2;
        }
        if (state == 2) {
            if (ch == 'd') next = 3;
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
struct regex_struct_t regex_28 = { "/a[^bc]d/", regex_28_search };

struct regex_match_struct_t regex_29_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (next == -1 && ch != '-' && ch != 'b') next = 2;
        }
        if (state == 2) {
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_29 = { "/a[^-b]c/", regex_29_search };

struct regex_match_struct_t regex_30_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            if (ch == ']') next = 3;
        }
        if (state == 3) {
            if (ch == 'c') next = 4;
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
struct regex_struct_t regex_30 = { "/a[^]b]c/", regex_30_search };

struct regex_match_struct_t regex_31_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
            if (ch == 'c') next = 2;
        }
        if (state == 1) {
            if (ch == 'b') next = 3;
        }
        if (state == 2) {
            if (ch == 'd') next = 3;
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
struct regex_struct_t regex_31 = { "/ab|cd/", regex_31_search };

struct regex_match_struct_t regex_32_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'e') next = 1;
        }
        if (state == 1) {
            if (ch == 'f') next = 2;
        }

        if (next == -1) {
            if (state == 2)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 2) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_32 = { "/()ef/", regex_32_search };

struct regex_match_struct_t regex_33_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == '$') next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
        }

        if (next == -1) {
            if (state == 2)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 2) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_33 = { "/$b/", regex_33_search };

struct regex_match_struct_t regex_34_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == '(') next = 2;
        }
        if (state == 2) {
            if (ch == 'b') next = 3;
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
struct regex_struct_t regex_34 = { "/a\\(b/", regex_34_search };

struct regex_match_struct_t regex_35_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == '(') next = 2;
            if (ch == 'b') next = 3;
        }
        if (state == 2) {
            if (ch == '(') next = 2;
            if (ch == 'b') next = 3;
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
struct regex_struct_t regex_35 = { "/a\\(*b/", regex_35_search };

struct regex_match_struct_t regex_36_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == '\\') next = 2;
        }
        if (state == 2) {
            if (ch == 'b') next = 3;
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
struct regex_struct_t regex_36 = { "/a\\\\b/", regex_36_search };

struct regex_match_struct_t regex_37_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[2];
    if (capture) {
        result.matches = malloc(2 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 2);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') { next = 1; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 1)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 1) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 1)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 2;
    return result;
}
struct regex_struct_t regex_37 = { "/((a))/", regex_37_search };

struct regex_match_struct_t regex_38_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[2];
    if (capture) {
        result.matches = malloc(2 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 2);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 2) {
            if (ch == 'c') { next = 3; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
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
                regex_clear_matches(&result, 2);
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
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 3)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 2;
    return result;
}
struct regex_struct_t regex_38 = { "/(a)b(c)/", regex_38_search };

struct regex_match_struct_t regex_39_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == 'a') next = 1;
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_39 = { "/a+b+c/", regex_39_search };

struct regex_match_struct_t regex_40_search(const char *str, int16_t capture) {
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
            end = iterator;
            if (ch >= 'a' && ch <= 'b') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            end = iterator;
            if (ch >= 'a' && ch <= 'b') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 0 || state == 1)
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

        if (iterator == len-1 && index < len-1 && state != 0 && state != 1) {
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
    if (end == -1 && state != 0 && state != 1)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_40 = { "/(a+|b)*/", regex_40_search };

struct regex_match_struct_t regex_41_search(const char *str, int16_t capture) {
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
            if (ch >= 'a' && ch <= 'b') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            end = iterator;
            if (ch >= 'a' && ch <= 'b') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 1)
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

        if (iterator == len-1 && index < len-1 && state != 1) {
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
    if (end == -1 && state != 1)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_41 = { "/(a+|b)+/", regex_41_search };

struct regex_match_struct_t regex_42_search(const char *str, int16_t capture) {
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
            end = iterator;
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            end = iterator;
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 0 || state == 1 || state == 2)
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

        if (iterator == len-1 && index < len-1 && state != 0 && state != 1 && state != 2) {
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
    if (end == -1 && state != 0 && state != 1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_42 = { "/(a+|b)?/", regex_42_search };

struct regex_match_struct_t regex_43_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            end = iterator;
            if (next == -1 && ch != 'a' && ch != 'b') next = 1;
        }
        if (state == 1) {
            end = iterator;
            if (next == -1 && ch != 'a' && ch != 'b') next = 1;
        }

        if (next == -1) {
            if (state == 0 || state == 1)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 0 && state != 1) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 0 && state != 1)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_43 = { "/[^ab]*/", regex_43_search };

struct regex_match_struct_t regex_44_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            end = iterator;
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            end = iterator;
            if (ch == 'a') next = 1;
        }

        if (next == -1) {
            if (state == 0 || state == 1)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 0 && state != 1) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 0 && state != 1)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_44 = { "/a*/", regex_44_search };

struct regex_match_struct_t regex_45_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch >= 'a' && ch <= 'e') next = 1;
        }

        if (next == -1) {
            if (state == 1)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 1) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 1)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_45 = { "/a|b|c|d|e/", regex_45_search };

struct regex_match_struct_t regex_46_search(const char *str, int16_t capture) {
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
            if (ch >= 'a' && ch <= 'e') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            if (ch == 'f') next = 2;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 2)
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

        if (iterator == len-1 && index < len-1 && state != 2) {
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
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_46 = { "/(a|b|c|d|e)f/", regex_46_search };

struct regex_match_struct_t regex_47_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            if (ch == 'c') next = 3;
        }
        if (state == 3) {
            if (ch == 'd') next = 4;
            if (ch == 'e') next = 5;
        }
        if (state == 4) {
            if (ch == 'd') next = 4;
            if (ch == 'e') next = 5;
        }
        if (state == 5) {
            if (ch == 'f') next = 6;
        }
        if (state == 6) {
            if (ch == 'g') next = 7;
        }

        if (next == -1) {
            if (state == 7)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
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
        }
    }
    if (end == -1 && state != 7)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_47 = { "/abcd*efg/", regex_47_search };

struct regex_match_struct_t regex_48_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            end = iterator;
            if (ch == 'b') next = 2;
        }
        if (state == 2) {
            end = iterator;
            if (ch == 'b') next = 2;
        }

        if (next == -1) {
            if (state == 1 || state == 2)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 1 && state != 2) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_48 = { "/ab*/", regex_48_search };

struct regex_match_struct_t regex_49_search(const char *str, int16_t capture) {
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
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'c') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
        }
        if (state == 1) {
            if (ch == 'b') { next = 3; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 2) {
            if (ch == 'd') { next = 3; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 3) {
            if (ch == 'e') next = 4;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 4)
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

        if (iterator == len-1 && index < len-1 && state != 4) {
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
    if (end == -1 && state != 4)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_49 = { "/(ab|cd)e/", regex_49_search };

struct regex_match_struct_t regex_50_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch >= 'a' && ch <= 'h') next = 1;
        }
        if (state == 1) {
            if (ch == 'i') next = 2;
        }
        if (state == 2) {
            if (ch == 'j') next = 3;
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
struct regex_struct_t regex_50 = { "/[abhgefdc]ij/", regex_50_search };

struct regex_match_struct_t regex_51_search(const char *str, int16_t capture) {
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
            if (ch == 'a' && iterator == 0) { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'c' && iterator == 0) { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
        }
        if (state == 1) {
            if (ch == 'b') { next = 3; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 2) {
            if (ch == 'd') { next = 3; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 3) {
            if (ch == 'e') next = 4;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 4)
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

        if (iterator == len-1 && index < len-1 && state != 4) {
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
    if (end == -1 && state != 4)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_51 = { "/^(ab|cd)e/", regex_51_search };

struct regex_match_struct_t regex_52_search(const char *str, int16_t capture) {
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
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'e') next = 2;
        }
        if (state == 1) {
            if (ch == 'b') next = 3;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 2) {
            if (ch == 'f') next = 4;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 3) {
            if (ch == 'c') { next = 5; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 5) {
            if (ch == 'e') next = 2;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 4)
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

        if (iterator == len-1 && index < len-1 && state != 4) {
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
    if (end == -1 && state != 4)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_52 = { "/(abc|)ef/", regex_52_search };

struct regex_match_struct_t regex_53_search(const char *str, int16_t capture) {
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
            if (ch >= 'a' && ch <= 'b') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            if (ch == 'c') next = 2;
            if (ch == 'd') next = 3;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 2) {
            if (ch == 'c') next = 2;
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
struct regex_struct_t regex_53 = { "/(a|b)c*d/", regex_53_search };

struct regex_match_struct_t regex_54_search(const char *str, int16_t capture) {
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
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
        }
        if (state == 1) {
            if (ch == 'b') { next = 2; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 2) {
            if (ch == 'b') { next = 2; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_54 = { "/(ab|ab*)bc/", regex_54_search };

struct regex_match_struct_t regex_55_search(const char *str, int16_t capture) {
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
            if (ch == 'a') next = 1;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 1) {
            end = iterator;
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 2) {
            end = iterator;
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 3) {
            end = iterator;
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 1 || state == 2 || state == 3)
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

        if (iterator == len-1 && index < len-1 && state != 1 && state != 2 && state != 3) {
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
    if (end == -1 && state != 1 && state != 2 && state != 3)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_55 = { "/a([bc]*)c*/", regex_55_search };

struct regex_match_struct_t regex_56_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[2];
    if (capture) {
        result.matches = malloc(2 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 2);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 1) {
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'd') { next = 4; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
        }
        if (state == 2) {
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'd') { next = 4; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
        }
        if (state == 3) {
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'd') { next = 4; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 4)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
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
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 4)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 2;
    return result;
}
struct regex_struct_t regex_56 = { "/a([bc]*)(c*d)/", regex_56_search };

struct regex_match_struct_t regex_57_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[2];
    if (capture) {
        result.matches = malloc(2 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 2);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 1) {
            if (ch >= 'b' && ch <= 'c') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }
        if (state == 2) {
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'd') { next = 4; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
        }
        if (state == 3) {
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'd') { next = 4; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 4)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
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
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 4)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 2;
    return result;
}
struct regex_struct_t regex_57 = { "/a([bc]+)(c*d)/", regex_57_search };

struct regex_match_struct_t regex_58_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[2];
    if (capture) {
        result.matches = malloc(2 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 2);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 1) {
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 2) {
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 3) {
            if (ch == 'b') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'd') { next = 4; if (capture && started[1]) result.matches[1].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 4)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
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
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 4)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 2;
    return result;
}
struct regex_struct_t regex_58 = { "/a([bc]*)(c+d)/", regex_58_search };

struct regex_match_struct_t regex_59_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch >= 'b' && ch <= 'c') next = 2;
            if (ch == 'd') next = 3;
        }
        if (state == 2) {
            if (ch >= 'b' && ch <= 'c') next = 2;
            if (ch == 'd') next = 3;
        }
        if (state == 3) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 4;
            if (ch == 'd') next = 3;
        }
        if (state == 4) {
            if (ch >= 'b' && ch <= 'c') next = 2;
            if (ch == 'd') next = 5;
        }
        if (state == 5) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 6;
            if (ch == 'd') next = 3;
        }
        if (state == 6) {
            if (ch >= 'b' && ch <= 'c') next = 2;
            if (ch == 'd') next = 7;
        }
        if (state == 7) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 6;
            if (ch == 'd') next = 3;
            if (ch == 'e') next = 8;
        }

        if (next == -1) {
            if (state == 8)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 8) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 8)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_59 = { "/a[bcd]*dcdcde/", regex_59_search };

struct regex_match_struct_t regex_60_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch >= 'b' && ch <= 'd') next = 2;
        }
        if (state == 2) {
            if (ch >= 'b' && ch <= 'c') next = 2;
            if (ch == 'd') next = 3;
        }
        if (state == 3) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 4;
            if (ch == 'd') next = 3;
        }
        if (state == 4) {
            if (ch >= 'b' && ch <= 'c') next = 2;
            if (ch == 'd') next = 5;
        }
        if (state == 5) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 6;
            if (ch == 'd') next = 3;
        }
        if (state == 6) {
            if (ch >= 'b' && ch <= 'c') next = 2;
            if (ch == 'd') next = 7;
        }
        if (state == 7) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 6;
            if (ch == 'd') next = 3;
            if (ch == 'e') next = 8;
        }

        if (next == -1) {
            if (state == 8)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 8) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 8)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_60 = { "/a[bcd]+dcdcde/", regex_60_search };

struct regex_match_struct_t regex_61_search(const char *str, int16_t capture) {
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
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            if (ch == 'b') { next = 2; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') next = 3;
        }
        if (state == 2) {
            if (ch == 'b') next = 2;
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_61 = { "/(ab|a)b*c/", regex_61_search };

struct regex_match_struct_t regex_62_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[4];
    if (capture) {
        result.matches = malloc(4 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 4);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') { next = 1; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[2] = 0;
                started[3] = 0;
            }
        }
        if (state == 1) {
            if (ch == 'b') { next = 2; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
                started[3] = 0;
            }
        }
        if (state == 2) {
            if (ch == 'c') { next = 3; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
                started[2] = 0;
                started[3] = 0;
            }
        }
        if (state == 3) {
            if (ch == 'd') { next = 4; if (capture && (!started[3] || iterator > result.matches[3].end)) { started[3] = 1; result.matches[3].index = iterator; } if (capture && started[3]) result.matches[3].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
                started[2] = 0;
            }
        }

        if (next == -1) {
            if (state == 4)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 4);
                memset(started, 0, sizeof started);
            }
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
            if (capture) {
                regex_clear_matches(&result, 4);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 4)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 4;
    return result;
}
struct regex_struct_t regex_62 = { "/((a)(b)c)(d)/", regex_62_search };

struct regex_match_struct_t regex_63_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch >= 'A' && ch <= 'Z') next = 1;
            if (ch == '_') next = 1;
            if (ch >= 'a' && ch <= 'z') next = 1;
        }
        if (state == 1) {
            end = iterator;
            if (ch >= '0' && ch <= '9') next = 2;
            if (ch >= 'A' && ch <= 'Z') next = 2;
            if (ch == '_') next = 2;
            if (ch >= 'a' && ch <= 'z') next = 2;
        }
        if (state == 2) {
            end = iterator;
            if (ch >= '0' && ch <= '9') next = 2;
            if (ch >= 'A' && ch <= 'Z') next = 2;
            if (ch == '_') next = 2;
            if (ch >= 'a' && ch <= 'z') next = 2;
        }

        if (next == -1) {
            if (state == 1 || state == 2)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 1 && state != 2) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_63 = { "/[a-zA-Z_][a-zA-Z0-9_]*/", regex_63_search };

struct regex_match_struct_t regex_64_search(const char *str, int16_t capture) {
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
            if (ch == 'a' && iterator == 0) next = 1;
            if (next == -1) next = 2;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 1) {
            if (ch == 'b') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'h' && iterator == len - 1) next = 4;
        }
        if (state == 2) {
            if (ch == 'h' && iterator == len - 1) next = 4;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 3) {
            if (ch == 'c') { next = 5; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'e') { next = 6; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'h') { next = 6; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 5) {
            if (ch == 'c') { next = 5; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'g') next = 4;
        }
        if (state == 6) {
            if (ch == 'g') next = 4;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 4)
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

        if (iterator == len-1 && index < len-1 && state != 4) {
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
    if (end == -1 && state != 4)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_64 = { "/^a(bc+|b[eh])g|.h$/", regex_64_search };

struct regex_match_struct_t regex_65_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[2];
    if (capture) {
        result.matches = malloc(2 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 2);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'b') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'e') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'h') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'i') { next = 4; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }
        if (state == 1) {
            if (ch == 'c') next = 5;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 2) {
            if (ch == 'f') next = 6;
            if (ch == 'g') next = 7;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 3) {
            if (ch == 'i') next = 4;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 4) {
            if (ch >= 'j' && ch <= 'k') { next = 8; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 5) {
            if (ch == 'c') next = 5;
            if (ch == 'd' && iterator == len - 1) { next = 8; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }
        if (state == 6) {
            if (ch == 'f') next = 6;
            if (ch == 'g') next = 7;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 7) {
            if (next == -1) { next = 8; if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }

        if (next == -1) {
            if (state == 8)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 8) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 8)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 2;
    return result;
}
struct regex_struct_t regex_65 = { "/(bc+d$|ef*g.|h?i(j|k))/", regex_65_search };

struct regex_match_struct_t regex_66_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[9];
    if (capture) {
        result.matches = malloc(9 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 9);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') { next = 1; if (capture && (!started[8] || iterator > result.matches[8].end)) { started[8] = 1; result.matches[8].index = iterator; } if (capture && (!started[7] || iterator > result.matches[7].end)) { started[7] = 1; result.matches[7].index = iterator; } if (capture && (!started[6] || iterator > result.matches[6].end)) { started[6] = 1; result.matches[6].index = iterator; } if (capture && (!started[5] || iterator > result.matches[5].end)) { started[5] = 1; result.matches[5].index = iterator; } if (capture && (!started[4] || iterator > result.matches[4].end)) { started[4] = 1; result.matches[4].index = iterator; } if (capture && (!started[3] || iterator > result.matches[3].end)) { started[3] = 1; result.matches[3].index = iterator; } if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[8]) result.matches[8].end = iterator + 1; if (capture && started[7]) result.matches[7].end = iterator + 1; if (capture && started[6]) result.matches[6].end = iterator + 1; if (capture && started[5]) result.matches[5].end = iterator + 1; if (capture && started[4]) result.matches[4].end = iterator + 1; if (capture && started[3]) result.matches[3].end = iterator + 1; if (capture && started[2]) result.matches[2].end = iterator + 1; if (capture && started[1]) result.matches[1].end = iterator + 1; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 1)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 9);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 1) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 9);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 1)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 9;
    return result;
}
struct regex_struct_t regex_66 = { "/(((((((((a)))))))))/", regex_66_search };

struct regex_match_struct_t regex_67_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'm') next = 1;
        }
        if (state == 1) {
            if (ch == 'u') next = 2;
        }
        if (state == 2) {
            if (ch == 'l') next = 3;
        }
        if (state == 3) {
            if (ch == 't') next = 4;
        }
        if (state == 4) {
            if (ch == 'i') next = 5;
        }
        if (state == 5) {
            if (ch == 'p') next = 6;
        }
        if (state == 6) {
            if (ch == 'l') next = 7;
        }
        if (state == 7) {
            if (ch == 'e') next = 8;
        }
        if (state == 8) {
            if (ch == ' ') next = 9;
        }
        if (state == 9) {
            if (ch == 'w') next = 10;
        }
        if (state == 10) {
            if (ch == 'o') next = 11;
        }
        if (state == 11) {
            if (ch == 'r') next = 12;
        }
        if (state == 12) {
            if (ch == 'd') next = 13;
        }
        if (state == 13) {
            if (ch == 's') next = 14;
        }
        if (state == 14) {
            if (ch == ' ') next = 15;
        }
        if (state == 15) {
            if (ch == 'o') next = 16;
        }
        if (state == 16) {
            if (ch == 'f') next = 17;
        }
        if (state == 17) {
            if (ch == ' ') next = 18;
        }
        if (state == 18) {
            if (ch == 't') next = 19;
        }
        if (state == 19) {
            if (ch == 'e') next = 20;
        }
        if (state == 20) {
            if (ch == 'x') next = 21;
        }
        if (state == 21) {
            if (ch == 't') next = 22;
        }

        if (next == -1) {
            if (state == 22)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 22) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 22)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_67 = { "/multiple words of text/", regex_67_search };

struct regex_match_struct_t regex_68_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'm') next = 1;
        }
        if (state == 1) {
            if (ch == 'u') next = 2;
        }
        if (state == 2) {
            if (ch == 'l') next = 3;
        }
        if (state == 3) {
            if (ch == 't') next = 4;
        }
        if (state == 4) {
            if (ch == 'i') next = 5;
        }
        if (state == 5) {
            if (ch == 'p') next = 6;
        }
        if (state == 6) {
            if (ch == 'l') next = 7;
        }
        if (state == 7) {
            if (ch == 'e') next = 8;
        }
        if (state == 8) {
            if (ch == ' ') next = 9;
        }
        if (state == 9) {
            if (ch == 'w') next = 10;
        }
        if (state == 10) {
            if (ch == 'o') next = 11;
        }
        if (state == 11) {
            if (ch == 'r') next = 12;
        }
        if (state == 12) {
            if (ch == 'd') next = 13;
        }
        if (state == 13) {
            if (ch == 's') next = 14;
        }

        if (next == -1) {
            if (state == 14)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 14) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 14)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_68 = { "/multiple words/", regex_68_search };

struct regex_match_struct_t regex_69_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[2];
    if (capture) {
        result.matches = malloc(2 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 2);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (next == -1) { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }
        if (state == 1) {
            if (next == -1) { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }
        if (state == 2) {
            end = iterator;
            if (next == -1) { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == 'c') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 3) {
            end = iterator;
            if (next == -1) { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == 'c') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 2 || state == 3)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 2 && state != 3) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 2 && state != 3)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 2;
    return result;
}
struct regex_struct_t regex_69 = { "/(.*)c(.*)/", regex_69_search };

struct regex_match_struct_t regex_70_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[2];
    if (capture) {
        result.matches = malloc(2 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 2);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == '(') next = 1;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 1) {
            if (next == -1) { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == ';') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }
        if (state == 2) {
            if (next == -1) { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == ';') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }
        if (state == 3) {
            if (ch == ' ') next = 4;
            if (ch == ';') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (next == -1) { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }
        if (state == 4) {
            if (next == -1) { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == ')') { next = 6; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 5) {
            if (next == -1) { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == ')') { next = 6; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 6) {
            end = iterator;
            if (next == -1) { next = 5; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == ')') { next = 6; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }

        if (next == -1) {
            if (state == 6)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 6) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 6)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 2;
    return result;
}
struct regex_struct_t regex_70 = { "/\\((.*); (.*)\\)/", regex_70_search };

struct regex_match_struct_t regex_71_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'k') next = 1;
        }

        if (next == -1) {
            if (state == 1)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 1) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
        }
    }
    if (end == -1 && state != 1)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 0;
    return result;
}
struct regex_struct_t regex_71 = { "/[k]/", regex_71_search };

struct regex_match_struct_t regex_72_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') next = 1;
        }
        if (state == 1) {
            if (ch == '-') next = 2;
            if (ch == 'c') next = 3;
        }
        if (state == 2) {
            if (ch == 'c') next = 3;
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
struct regex_struct_t regex_72 = { "/a[-]?c/", regex_72_search };

struct regex_match_struct_t regex_73_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
    char ch;
    int16_t started[2];
    if (capture) {
        result.matches = malloc(2 * sizeof(*result.matches));
        assert(result.matches != NULL);
        regex_clear_matches(&result, 2);
        memset(started, 0, sizeof started);
    }
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        if (state == 0) {
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (capture && next == -1) {
                started[1] = 0;
            }
        }
        if (state == 1) {
            if (ch == 'b') { next = 2; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 2) {
            end = iterator;
            if (ch == 'c') next = 3;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }

        if (next == -1) {
            if (state == 2 || state == 3)
                break;
            iterator = index;
            index++;
            state = 0;
            end = -1;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && state != 2 && state != 3) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
            if (capture) {
                regex_clear_matches(&result, 2);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 2 && state != 3)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 2;
    return result;
}
struct regex_struct_t regex_73 = { "/(a)(b)c|ab/", regex_73_search };

struct regex_match_struct_t regex_74_search(const char *str, int16_t capture) {
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
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'x') next = 2;
        }

        if (next == -1) {
            if (state == 2)
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

        if (iterator == len-1 && index < len-1 && state != 2) {
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
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_74 = { "/(a)+x/", regex_74_search };

struct regex_match_struct_t regex_75_search(const char *str, int16_t capture) {
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
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'c') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'x') next = 2;
        }

        if (next == -1) {
            if (state == 2)
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

        if (iterator == len-1 && index < len-1 && state != 2) {
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
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_75 = { "/([ac])+x/", regex_75_search };

struct regex_match_struct_t regex_76_search(const char *str, int16_t capture) {
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
            if (ch == '/') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 's') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (next == -1 && ch != '/') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
        }
        if (state == 1) {
            if (ch == '/') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 's') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (next == -1 && ch != '/') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
        }
        if (state == 2) {
            if (ch == '/') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 's') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (next == -1 && ch != '/') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
        }
        if (state == 3) {
            if (ch == '/') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 's') { next = 3; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'u') next = 4;
            if (next == -1 && ch != '/') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
        }
        if (state == 4) {
            if (ch == 'b') next = 5;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 5) {
            if (ch == '1') next = 6;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 6) {
            if (ch == '/') next = 7;
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
                regex_clear_matches(&result, 1);
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
                regex_clear_matches(&result, 1);
                memset(started, 0, sizeof started);
            }
        }
    }
    if (end == -1 && state != 7)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_76 = { "/([^\\/]*\\/)*sub1\\//", regex_76_search };

struct regex_match_struct_t regex_77_search(const char *str, int16_t capture) {
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
            if (next == -1 && ch != '.') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '.') next = 2;
            if (capture && next == -1) {
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 1) {
            if (next == -1 && ch != '.') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == '.') next = 2;
            if (capture && next == -1) {
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 2) {
            if (next == -1 && ch != ':') { next = 3; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == ':') next = 4;
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 3) {
            if (next == -1 && ch != ':') { next = 3; if (capture && (!started[1] || iterator > result.matches[1].end)) { started[1] = 1; result.matches[1].index = iterator; } if (capture && started[1]) result.matches[1].end = iterator + 1; }
            if (ch == ':') next = 4;
            if (capture && next == -1) {
                started[0] = 0;
                started[2] = 0;
            }
        }
        if (state == 4) {
            if (ch == ' ') next = 5;
            if (ch == 'T') next = 5;
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
                started[2] = 0;
            }
        }
        if (state == 5) {
            end = iterator;
            if (ch == ' ') next = 5;
            if (ch == 'T') next = 5;
            if (next == -1) { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }
        if (state == 6) {
            end = iterator;
            if (next == -1) { next = 6; if (capture && (!started[2] || iterator > result.matches[2].end)) { started[2] = 1; result.matches[2].index = iterator; } if (capture && started[2]) result.matches[2].end = iterator + 1; }
            if (capture && next == -1) {
                started[0] = 0;
                started[1] = 0;
            }
        }

        if (next == -1) {
            if (state == 5 || state == 6)
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

        if (iterator == len-1 && index < len-1 && state != 5 && state != 6) {
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
    if (end == -1 && state != 5 && state != 6)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 3;
    return result;
}
struct regex_struct_t regex_77 = { "/([^.]*)\\.([^:]*):[T ]+(.*)/", regex_77_search };

struct regex_match_struct_t regex_78_search(const char *str, int16_t capture) {
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
            if (next == -1 && ch != 'N') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'N') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            if (next == -1 && ch != 'N') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'N') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 2) {
            end = iterator;
            if (next == -1 && ch != 'N') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'N') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 2)
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

        if (iterator == len-1 && index < len-1 && state != 2) {
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
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_78 = { "/([^N]*N)+/", regex_78_search };

struct regex_match_struct_t regex_79_search(const char *str, int16_t capture) {
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
            if (ch >= 'a' && ch <= 'c') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'x') next = 2;
        }
        if (state == 1) {
            if (ch >= 'a' && ch <= 'c') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'x') next = 2;
        }

        if (next == -1) {
            if (state == 2)
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

        if (iterator == len-1 && index < len-1 && state != 2) {
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
    if (end == -1 && state != 2)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_79 = { "/([abc]*)x/", regex_79_search };

struct regex_match_struct_t regex_80_search(const char *str, int16_t capture) {
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
            if (ch == 'x') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'y' && ch <= 'z') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            end = iterator;
            if (ch == 'x') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'y' && ch <= 'z') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 2) {
            if (ch == 'x') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'y' && ch <= 'z') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }

        if (next == -1) {
            if (state == 1)
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

        if (iterator == len-1 && index < len-1 && state != 1) {
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
    if (end == -1 && state != 1)
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = 1;
    return result;
}
struct regex_struct_t regex_80 = { "/([xyz]*)x/", regex_80_search };

struct regex_match_struct_t regex_81_search(const char *str, int16_t capture) {
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
            if (ch == 'a') { next = 1; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 1) {
            if (ch == 'a') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch == 'b') next = 3;
        }
        if (state == 2) {
            if (ch == 'a') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } if (capture && started[0]) result.matches[0].end = iterator + 1; }
            if (ch >= 'b' && ch <= 'c') next = 3;
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
struct regex_struct_t regex_81 = { "/(a)+b|aac/", regex_81_search };

struct regex_match_struct_t regex_82_search(const char *str, int16_t capture) {
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
            if (ch == '<') next = 1;
            if (capture && next == -1) {
                started[0] = 0;
            }
        }
        if (state == 1) {
            if (ch == 'h') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'm') next = 3;
        }
        if (state == 2) {
            if (ch == 't') { next = 4; if (capture && started[0]) result.matches[0].end = iterator + 1; }
        }
        if (state == 4) {
            if (ch == 'h') { next = 2; if (capture && (!started[0] || iterator > result.matches[0].end)) { started[0] = 1; result.matches[0].index = iterator; } }
            if (ch == 'm') next = 3;
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
struct regex_struct_t regex_82 = { "/<(ht)*m/", regex_82_search };

void print(const char * string, struct regex_struct_t regex, int16_t expect)
{
    int16_t pos;
    count++;
    pos = regex.func(string, FALSE).index;
    if (pos != expect)
    {
        printf("\"%s", string);
        printf("\".search(%s", regex.str);
        printf(") -> FAIL, returned %d", pos);
        printf(", expected %d\n", expect);
    }
    else
        matched++;

}

int main(void) {
    matched = 0;
    count = 0;
    print("nnda", regex, 0);
    print("nna", regex_2, 0);
    print("a", regex_2, 0);
    print("a", regex_3, -1);
    print("nda", regex_3, 0);
    print("naa", regex_3, 0);
    print("ana", regex_3, 1);
    print("nddna", regex_4, -1);
    print("nnada", regex_5, 0);
    print("naaada", regex_5, 0);
    print("d", regex_5, 0);
    print("x", regex_5, -1);
    print("nnaed", regex_6, -1);
    print("abcdefff23334", regex_7, 0);
    print("abcdefff23334", regex_8, 5);
    print("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxy", regex_9, 0);
    print("acb", regex_10, 0);
    print("abc", regex_11, 0);
    print("xbc", regex_11, -1);
    print("axc", regex_11, -1);
    print("abx", regex_11, -1);
    print("xabcy", regex_11, 1);
    print("ababc", regex_11, 2);
    print("abc", regex_12, 0);
    print("abc", regex_13, 0);
    print("abbc", regex_13, 0);
    print("abbbbc", regex_13, 0);
    print("abbc", regex_14, 0);
    print("abc", regex_14, -1);
    print("abq", regex_14, -1);
    print("abbbbc", regex_14, 0);
    print("abbc", regex_15, 0);
    print("abc", regex_15, 0);
    print("abbbbc", regex_15, -1);
    print("abc", regex_16, 0);
    print("abc", regex_17, 0);
    print("abcc", regex_17, -1);
    print("abcc", regex_18, 0);
    print("aabc", regex_17, -1);
    print("aabc", regex_19, 1);
    print("ababcabc", regex_19, 5);
    print("abc", regex_20, 0);
    print("axc", regex_20, 0);
    print("axyzc", regex_21, 0);
    print("axyzd", regex_21, -1);
    print("abc", regex_22, -1);
    print("abd", regex_22, 0);
    print("abd", regex_23, -1);
    print("ace", regex_23, 0);
    print("aac", regex_24, 1);
    print("a-", regex_25, 0);
    print("a-", regex_26, 0);
    print("a]", regex_27, 0);
    print("aed", regex_28, 0);
    print("abd", regex_28, -1);
    print("adc", regex_29, 0);
    print("a-c", regex_29, -1);
    print("a]c", regex_30, -1);
    print("adc", regex_30, -1);
    print("abc", regex_31, 0);
    print("abcd", regex_31, 0);
    print("def", regex_32, 1);
    print("b", regex_33, -1);
    print("a(b", regex_34, 0);
    print("ab", regex_35, 0);
    print("a((b", regex_35, 0);
    print("a\\b", regex_36, 0);
    print("abc", regex_37, 0);
    print("abc", regex_38, 0);
    print("aabbabc", regex_39, 4);
    print("ab", regex_40, 0);
    print("ab", regex_41, 0);
    print("ab", regex_42, 0);
    print("cde", regex_43, 0);
    print("", regex_11, -1);
    print("", regex_44, 0);
    print("e", regex_45, 0);
    print("ef", regex_46, 0);
    print("abcdefg", regex_47, 0);
    print("xabyabbbz", regex_48, 1);
    print("xayabbbz", regex_48, 1);
    print("abcde", regex_49, 2);
    print("hij", regex_50, 0);
    print("abcde", regex_51, -1);
    print("abcdef", regex_52, 4);
    print("abcd", regex_53, 1);
    print("abc", regex_54, 0);
    print("abc", regex_55, 0);
    print("abcd", regex_56, 0);
    print("abcd", regex_57, 0);
    print("abcd", regex_58, 0);
    print("adcdcde", regex_59, 0);
    print("adcdcde", regex_60, -1);
    print("abc", regex_61, 0);
    print("abcd", regex_62, 0);
    print("alpha", regex_63, 0);
    print("abh", regex_64, 1);
    print("effgz", regex_65, 0);
    print("ij", regex_65, 0);
    print("effg", regex_65, -1);
    print("bcdd", regex_65, -1);
    print("reffgz", regex_65, 1);
    print("a", regex_66, 0);
    print("uh-uh", regex_67, -1);
    print("multiple words, yeah", regex_68, 0);
    print("abcde", regex_69, 0);
    print("(a, b)", regex_70, -1);
    print("ab", regex_71, -1);
    print("ac", regex_72, 0);
    print("ab", regex_73, 0);
    print("aaax", regex_74, 0);
    print("aacx", regex_75, 0);
    print("d:msgs/tdir/sub1/trial/away.cpp", regex_76, 0);
    print("sub1/trial/away.cpp", regex_76, 0);
    print("some/things/sub2/sub1.cpp", regex_76, -1);
    print("track1.title:TBlah blah blah", regex_77, 0);
    print("abNNxyzN", regex_78, 0);
    print("abNNxyz", regex_78, 0);
    print("abcx", regex_79, 0);
    print("abc", regex_79, -1);
    print("abcx", regex_80, 3);
    print("aac", regex_81, 0);
    print("<html>", regex_82, 0);
    printf("Passed:");
    printf(" %d", matched);
    printf(" /");
    printf(" %d\n", count);

    return 0;
}
