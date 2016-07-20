TS = $(wildcard *.ts)
C = $(TS:.ts=.c)
ELF = $(TS:.ts=.elf)
RES = $(TS:.ts=.res)

.PHONY: all clean

%.c: %.ts
	node ../ts2c.js $<
%.elf: %.c
	gcc $< -ansi -pedantic -Wall -o $@
%.res: %.elf
	./$< > $@
	diff $@ $@.expect

all: $(RES) $(ELF) $(C)

clean: 
	rm -f *.elf
	rm -f *.res
	rm -f *.c
