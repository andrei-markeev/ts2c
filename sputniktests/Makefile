SPUTNIK = /mnt/c/my/Projects/sputniktests/Conformance/11_Expressions

TS = $(shell find $(SPUTNIK) -type f -name '*.js' ! -name 'S12.10*.js' ! -name 'S12.12*.js' ! -name 'S12.13*.js' ! -name 'S12.14*.js')
C = $(TS:.js=.c)
RES = $(TS:.js=.res)

.PHONY: all init clean

%.c: %.js
	./run_test $< >> results.txt

all: init $(C)
	@printf "Sputnik tests passed: "
	@grep ^PASS results.txt | wc -l | tr -d '\\n'
	@printf "/"
	@find $(SPUTNIK) -type f -name '*.js' | wc -l

init:
	> results.txt
	find . -name "*.c" -type f -delete
	find . -name "*.elf" -type f -delete
	find . -name "*.res" -type f -delete

clean: 
	rm -f **/*.elf
	rm -f **/*.c
