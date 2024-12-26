#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
typedef short int16_t;

struct int16_t__t {
    const char * main;
    const char * ARRAY;
};

static struct int16_t__t * int16_t_;
void main_()
{
    int16_t TRUE_;
    TRUE_ = 11;
    printf("%d\n", TRUE_);

}

int main(void) {
    int16_t_ = malloc(sizeof(*int16_t_));
    assert(int16_t_ != NULL);
    int16_t_->main = "hello";
    int16_t_->ARRAY = "FALSE";
    main_();
    free(int16_t_);

    return 0;
}
