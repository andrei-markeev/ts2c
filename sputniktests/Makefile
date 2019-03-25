SPUTNIK = ../../sputniktests/Conformance
TS2C = ../bin/ts2c

TS = $(shell find $(SPUTNIK) -type f -name '*.js' ! -name 'S12.10*.js' ! -name 'S12.12*.js' ! -name 'S12.13*.js' ! -name 'S12.14*.js')
C = $(TS:.js=.c)
RES = $(TS:.js=.res)

.PHONY: all init clean

%.c: %.js
	$(TS2C) --sputnik $< || echo "ERROR: $< did not transpile" >> results.txt
%.elf: %.c
	[ -f $< ] && { gcc $< -ansi -pedantic -Wall -g -o $@ || echo "ERROR: $< did not compile" >> results.txt ; } || echo "skip"
%.res: %.elf
	[ -f $< ] && { ./$< > $@ || echo "ERROR: $< did not run correctly" >> results.txt ; } || echo "skip"
	[ -f $< ] && { [ -s $@ ] && echo "ERROR: $@ results validation failed" >> results.txt || echo "PASS: $<" >> results.txt ; } || echo "skip"

all: init $(RES) $(C)

init:
	> results.txt
	find . -name "*.c" -type f -delete
	find . -name "*.elf" -type f -delete
	find . -name "*.res" -type f -delete

clean: 
	rm -f **/*.elf
	rm -f **/*.c
