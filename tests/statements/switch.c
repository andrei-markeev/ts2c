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
void showMessage(int16_t message)
{
    switch (message) {
        case 1:
            printf("message 1\n");
            break;
        case 2:
            printf("message 2\n");
            break;
        default:
            printf("default message\n");
            break;
    }

}
void isGood(int16_t number)
{
    switch (number) {
        case 3:
            printf("3 is a good number\n");
            break;
        case 7:
            printf("7 is a good number\n");
            break;
    }

}
void howMuch(const char * fruit)
{
    int16_t tmp_switch;
    tmp_switch = !strcmp(fruit, "banana") ? 0
        : !strcmp(fruit, "apple") ? 1
        : -1;
    switch (tmp_switch) {
        case 0:
            printf("banana - 1 euro\n");
            break;
        case 1:
            printf("apple - 2 euro\n");
            break;
        default:
            printf("not in stock\n");
            break;
    }

}
void onlyFish(const char * request)
{
    int16_t tmp_switch;
    tmp_switch = !strcmp(request, "fish") ? 0
        : -1;
    switch (tmp_switch) {
        case 0:
            printf("FISH!\n");
    }

}
void ask(int16_t n)
{
    const char * output;
    char * tmp_result = NULL;
    char * tmp_result_2 = NULL;
    char * tmp_result_3 = NULL;
    char * tmp_result_4 = NULL;
    char * tmp_result_5 = NULL;
    char * tmp_result_6 = NULL;
    char * tmp_result_7 = NULL;
    output = "";
    switch (n) {
        case 0:
            tmp_result = malloc(strlen(output) + strlen("So ") + 1);
            assert(tmp_result != NULL);
            tmp_result[0] = '\0';
            strcat(tmp_result, output);
            strcat(tmp_result, "So ");
            (output = tmp_result);
        case 1:
            tmp_result_2 = malloc(strlen(output) + strlen("What ") + 1);
            assert(tmp_result_2 != NULL);
            tmp_result_2[0] = '\0';
            strcat(tmp_result_2, output);
            strcat(tmp_result_2, "What ");
            (output = tmp_result_2);
            tmp_result_3 = malloc(strlen(output) + strlen("Is ") + 1);
            assert(tmp_result_3 != NULL);
            tmp_result_3[0] = '\0';
            strcat(tmp_result_3, output);
            strcat(tmp_result_3, "Is ");
            (output = tmp_result_3);
        case 2:
            tmp_result_4 = malloc(strlen(output) + strlen("Your ") + 1);
            assert(tmp_result_4 != NULL);
            tmp_result_4[0] = '\0';
            strcat(tmp_result_4, output);
            strcat(tmp_result_4, "Your ");
            (output = tmp_result_4);
        case 3:
            tmp_result_5 = malloc(strlen(output) + strlen("Name") + 1);
            assert(tmp_result_5 != NULL);
            tmp_result_5[0] = '\0';
            strcat(tmp_result_5, output);
            strcat(tmp_result_5, "Name");
            (output = tmp_result_5);
        case 4:
            tmp_result_6 = malloc(strlen(output) + strlen("?") + 1);
            assert(tmp_result_6 != NULL);
            tmp_result_6[0] = '\0';
            strcat(tmp_result_6, output);
            strcat(tmp_result_6, "?");
            (output = tmp_result_6);
            printf("%s\n", output);
            break;
        case 5:
            tmp_result_7 = malloc(strlen(output) + strlen("!") + 1);
            assert(tmp_result_7 != NULL);
            tmp_result_7[0] = '\0';
            strcat(tmp_result_7, output);
            strcat(tmp_result_7, "!");
            (output = tmp_result_7);
            printf("%s\n", output);
            break;
        default:
            printf("Please pick a number from 0 to 5!\n");
    }
    free((char *)tmp_result);
    free((char *)tmp_result_2);
    free((char *)tmp_result_3);
    free((char *)tmp_result_4);
    free((char *)tmp_result_5);
    free((char *)tmp_result_6);
    free((char *)tmp_result_7);

}
void isExtinct(const char * animal)
{
    int16_t tmp_switch;
    tmp_switch = !strcmp(animal, "cow") ? 0
        : !strcmp(animal, "giraffe") ? 1
        : !strcmp(animal, "dog") ? 2
        : !strcmp(animal, "pig") ? 3
        : !strcmp(animal, "dinosaur") ? 4
        : -1;
    switch (tmp_switch) {
        case 0:
        case 1:
        case 2:
        case 3:
            printf("%s", animal);
            printf(" is not extinct.\n");
            break;
        case 4:
        default:
            printf("%s", animal);
            printf(" is extinct.\n");
    }

}

int main(void) {
    showMessage(1);
    showMessage(2);
    showMessage(3);
    showMessage(-1);
    showMessage(1);
    showMessage(7);
    howMuch("test");
    howMuch("apple");
    howMuch("banana");
    onlyFish("test");
    onlyFish("fish");
    onlyFish("apple");
    ask(0);
    ask(1);
    ask(2);
    ask(3);
    ask(4);
    ask(5);
    ask(6);
    isExtinct("pig");
    isExtinct("giraffe");
    isExtinct("dinosaur");
    isExtinct("archeopterix");

    return 0;
}
