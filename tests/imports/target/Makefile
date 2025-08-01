
all:
	node ../../../bin/ts2c target.ts
	gcc target.c -ansi -pedantic -Wall -g -o target.elf
	valgrind --error-exitcode=1 --leak-check=yes --quiet ./target.elf > target.res
	diff target.res.expect target.res
