TS = $(sort $(wildcard *.ts) $(wildcard */*.ts))
C = $(TS:.ts=.c)
ELF = $(TS:.ts=.elf)
RES = $(TS:.ts=.res)
COVER = $(TS:%.ts=coverage/%)

.PHONY: all clean cover

%.c: %.ts
	node ../bin/ts2c $<
%.elf: %.c
	gcc $< -ansi -pedantic -Wall -g -o $@
%.res: %.elf
	./$< > $@
	diff $@.expect $@

all: $(RES) $(ELF) $(C)

coverage/%: %.ts
	cd .. && istanbul cover --print none --report=json --dir tests/$@ ts2c.js -- tests/$<
coverage/coverage-final.json: $(COVER)
	istanbul report json
coverage/html/index.html: coverage/coverage-final.json
	cd .. && ./node_modules/.bin/remap-istanbul -i tests/coverage/coverage-final.json -o tests/coverage/html -t html

cover: coverage/html/index.html

clean: 
	rm -f **/*.elf
	rm -f **/*.res
	rm -f **/*.c
	rm -rf coverage
