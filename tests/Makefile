TS = $(sort $(wildcard *.ts) $(wildcard */*.ts))
C = $(TS:.ts=.c)
ELF = $(TS:.ts=.elf)
RES = $(TS:.ts=.res)
COVER = $(TS:%.ts=coverage/%)

.PHONY: all clean

%.c: %.ts
	node ../ts2c.js $<
%.elf: %.c
	gcc $< -ansi -pedantic -Wall -g -o $@
%.res: %.elf
	valgrind --error-exitcode=1 --leak-check=yes --quiet ./$< > $@
	diff $@.expect $@
coverage/%: %.ts
	cd .. && istanbul cover --dir tests/$@ ts2c.js -- tests/$<
coverage/lcov-report/index.html: $(COVER)
	istanbul report

cover: coverage/lcov-report/index.html

all: $(RES) $(ELF) $(C)

clean: 
	rm -f *.elf
	rm -f *.res
	rm -f *.c
	rm -rf coverage
