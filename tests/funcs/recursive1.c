#include <stdio.h>

static void (*pf)();
static void (*(*pg)())();

void (*m())();

void (*f())()
{
    printf("f\n");
    return f;
}
void (*g())()
{
    printf("g\n");
    return m;
}
void (*m())()
{
    return g;
}

int main(void) {
    pf = f();
    pf();
    pg = m();
    pg();

    return 0;
}
