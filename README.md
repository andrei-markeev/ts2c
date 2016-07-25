JavaScript/TypeScript to C transpiler
=====================================

Produces readable C89 code from JS/TS code.

For example, this JavaScript:

```javascript
console.log("Hello world!");
```

transpiles to the following C code:

```c
#include <stdio.h>

int main() {
    printf("Hello world!\n");
    return 0;
}
```

No excessive code that you don't actually need is ever generated. The output is as readable as possible and maps well to the original code.

Other examples can be found in **tests** folder.

Live demo:

 - https://andrei-markeev.github.io/ts2c/

__**Work in progress:**__ it works, but only a tiny fraction of JS/TS syntax is currently supported.

Use cases
---------

Use cases for TS2C include, but not limited to:
 - Rapid prototyping of IoT software
 - Porting existing libraries from JavaScript to C 
 - Creating simple solutions for microcontrollers 

Examples of target platforms include:
 - [ESP8266](https://en.wikipedia.org/wiki/ESP8266)
 - [Pebble watch](https://en.wikipedia.org/wiki/Pebble_(watch))
 - [Atmel AVR](https://en.wikipedia.org/wiki/Atmel_AVR#Basic_families) family (used in Arduino boards)   
 - [TI MSP430](https://en.wikipedia.org/wiki/TI_MSP430) family

Rationale
---------

For sustainable IoT devices that can work for a long time on single battery, things like Raspberry Pi won't do.
You'll have to use low-power microcontrollers, which usually have very little memory available.

RAM ranges literally **from 512 bytes** to 120KB, and ROM/Flash **from 1KB** to 4MB. In such conditions, even
optimized interpreters like JerryScript, Espruino an V7 are sometimes too much of an overhead and usually lead
to the increased battery drain and/or don't leave a lot of system resources to your program.

Of course, transpiler cannot map 100% of the JavaScript language and some things are have to be left out, `eval`
being first of them. Still, current conclusion is, that it is possible to transpile most of the language. 

Usage
-----

Syntax:
```sh
node ts2c.js <files to transpile>
```

In browser:
```html
<script src="https://npmcdn.com/typescript"></script>
<script src="ts2c.bundle.js"></script>
<script>
    var cCode = ts2c.transpile("console.log('Hello world!')");
    alert(cCode);
</script>
```
