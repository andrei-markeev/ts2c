TS = $(sort $(wildcard *.ts) $(wildcard */*.ts))
C = $(TS:.ts=.c)
ELF = $(TS:.ts=.elf)
RES = $(TS:.ts=.res)
COVER = $(TS:%.ts=coverage/%)

.PHONY: all clean cover

%.c: %.ts
	node ../ts2c.js $<
%.elf: %.c
	gcc $< -ansi -pedantic -Wall -g -o $@
%.res: %.elf
	valgrind --error-exitcode=1 --leak-check=yes --quiet ./$< > $@
	diff $@.expect $@

all: $(RES) $(ELF) $(C)

coverage/%: %.ts
	cd .. && istanbul cover --print none --dir tests/$@ ts2c.js -- tests/$<
coverage/lcov-report/index.html: $(COVER)
	istanbul report

cover: coverage/lcov-report/index.html

clean: 
	rm -f **/*.elf
	rm -f **/*.res
	rm -f **/*.c
	rm -rf coverage
