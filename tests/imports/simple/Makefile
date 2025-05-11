.PHONY: all

all:
	node ../../../bin/ts2c simple.ts
	gcc simple.c files/simple-test.c -I. -ansi -pedantic -Wall -g -o simple.elf
	valgrind --error-exitcode=1 --leak-check=yes --quiet ./simple.elf > simple.res
	diff simple.res.expect simple.res
