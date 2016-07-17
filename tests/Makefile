TS = $(wildcard *.ts)
C = $(TS:.ts=.c)
ELF = $(TS:.ts=.elf)
AVR = $(TS:.ts=.avr)

%.c: %.ts
	node ../ts2c.js $<
%.elf: %.c
	gcc $< -ansi -pedantic -Wall -o $@
%.avr: %.c
	avr-gcc $< -Os -mmcu=atmega8 -o $@

all: $(ELF) $(AVR) $(C)

clean: 
	rm -f *.elf
	rm -f *.avr
	rm -f *.c
