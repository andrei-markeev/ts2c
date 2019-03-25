SPUTNIK = ../../sputniktests/Conformance

TS = $(shell find $(SPUTNIK) -type f -name '*.js' ! -name 'S12.10*.js' ! -name 'S12.12*.js' ! -name 'S12.13*.js' ! -name 'S12.14*.js')
C = $(TS:.js=.c)
RES = $(TS:.js=.res)

.PHONY: all init clean

%.c: %.js
	./run_test $< >> results.txt

all: init $(C)

init:
	> results.txt
	find . -name "*.c" -type f -delete
	find . -name "*.elf" -type f -delete
	find . -name "*.res" -type f -delete

clean: 
	rm -f **/*.elf
	rm -f **/*.c
