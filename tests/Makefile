ifeq ($(OS),Windows_NT)
    target := Windows
else
    target := Linux
endif

TS := $(sort $(wildcard *.ts) $(wildcard */*.ts))
TS := $(filter-out realworld/parseHtml.ts, $(TS)) # not passing yet
TS := $(filter-out $(wildcard imports/*.ts), $(TS)) # can't handle multi-file tests via Makefile yet
C = $(TS:.ts=.c)
ifeq ($(target), Windows)
    ELF = $(TS:.ts=.exe)
else
    ELF = $(TS:.ts=.elf)
endif
RES = $(TS:.ts=.res)
COVER = $(TS:%.ts=coverage/%)

.PHONY: all clean cover

%.c: %.ts
	node ../bin/ts2c $<

ifeq ($(target), Windows)
    %.exe: %.c
		gcc $< -ansi -pedantic -Wall -g -o $@
else
    %.elf: %.c
		gcc $< -ansi -pedantic -Wall -g -o $@
endif

ifeq ($(VALGRIND),skip)

ifeq ($(target), Windows)
%.res: %.exe
	"./$<" > $@
	diff --strip-trailing-cr $@.expect $@
else
%.res: %.elf
	./$< > $@
	diff --strip-trailing-cr $@.expect $@
endif

else

%.res: %.elf
	valgrind --error-exitcode=1 --leak-check=yes --quiet ./$< > $@
	diff $@.expect $@

endif

all: $(RES) $(ELF) $(C)

clean:
ifeq ($(target), Windows)
	del /s *.exe
	del /s *.res
	del /s *.c
else
	rm -f **/*.elf
	rm -f **/*.res
	rm -f **/*.c
endif