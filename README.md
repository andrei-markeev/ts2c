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

No excessive code that is not actually needed is ever generated.

The output is as readable as possible and mostly maps well to the original code.

Another example:

```javascript
var obj = { key: "hello" };
obj["newKey"] = "test";
console.log(obj);
```

transpiles to the following C code:

```c
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

struct obj_t {
    const char * key;
    const char * newKey;
};

static struct obj_t * obj;
int main(void) {

    obj = malloc(sizeof(*obj));
    assert(obj != NULL);
    obj->key = "hello";
    obj->newKey = "test";

    printf("{ ");
    printf("key: \"%s\"", obj->key);
    printf(", ");
    printf("newKey: \"%s\"", obj->newKey);
    printf(" }\n");

    free(obj);

    return 0;
}
```


Project status
--------------

__**Work in progress:**__ it works, but only about 44% of ES3 syntax is currently supported.

Overview of currently supported language features (compared to ES3 Standard):

 - statements [76%]: `var`, `if`-`else`, `do`-`while`, `while`, `for`, `for`-`of`, `for`-`in`, `continue`, `break`, `return`, `function`, block, empty statement, expression statement
 - expressions [47%]:
    - primary expressions [81%]: variables; number, string, regex and boolean literals; array and object initializers; grouping operator
    - left-hand-side expressions [60%]: property accessors, function calls
    - postfix expressions [100%]: `++`, `--`
    - unary operators [44%]: `++`, `--`, `+`, `!`
    - multiplicative operators [16%]: `*`
    - additive operators [50%]: `+`, `-`
    - bitwise shift operators [0%]
    - relational operators [33%]: `<`, `>`, `<=`, `>=`
    - equality operators [50%]: `==`, `!=`, `===`, `!==`
    - binary bitwise operators [0%]
    - binary logical operators [100%]: `&&`, `||`
    - conditional operator [100%]: `?`-`:`
    - assignment operators [25%]: `=`
    - comma operator [0%]
 - built-in objects [11%]:
    - Global [0%]
    - Object [0%]
    - Function [0%]
    - Array [78%]: `push()`, `pop()`, `shift()`, `unshift()`, `splice()`, `slice()`, `concat()`, `join()`, `toString()`, `sort()`, `reverse()`, `indexOf()`, `lastIndexOf()`, `length`
    - String [37%]: `indexOf()`, `lastIndexOf()`, `search()`, `charCodeAt()`, `concat()`, `substring()`, `slice()`, `length`
    - Boolean [0%]
    - Number [0%]
    - Math [0%]
    - Date [0%]
    - RegExp [0%]

Note: some of these features supported only partially.
Detailed information about supported and planned features can be found in [COVERAGE.md](https://github.com/andrei-markeev/ts2c/blob/master/COVERAGE.md).

Memory management is done via [escape analysis](https://en.wikipedia.org/wiki/Escape_analysis).

Live demo
---------

You can try it out yourself online:

 - https://andrei-markeev.github.io/ts2c/

Rationale
---------

The main motivation behind this project was to solve problem that IoT and wearables cannot be currently efficiently
programmed with JavaScript.

The thing is, for sustainable IoT devices that can work for a *long time* on single battery, things like
Raspberry Pi won't do. You'll have to use low-power microcontrollers, which usually have very little memory available.

RAM ranges literally **from 512 bytes** to 120KB, and ROM/Flash **from 1KB** to 4MB. In such conditions, even
optimized JS interpreters like [JerryScript](https://github.com/Samsung/jerryscript),
[Espruino](https://github.com/espruino/Espruino) or [V7](https://github.com/cesanta/v7) are sometimes too
much of an overhead and usually lead to the increased battery drain and/or don't leave a lot of system
resources to your program.

Of course, transpiler cannot map 100% of the JavaScript language and some things are have to be left out,
for example `eval` and `try`-`catch`. Still, current conclusion is, that it is possible to transpile most of the
language.

These are some examples of planned target platforms for using with TS2C:
 - [ESP8266](https://en.wikipedia.org/wiki/ESP8266)
 - [Pebble watch](https://en.wikipedia.org/wiki/Pebble_(watch))
 - [Atmel AVR](https://en.wikipedia.org/wiki/Atmel_AVR#Basic_families) family (used in Arduino boards)
 - [TI MSP430](https://en.wikipedia.org/wiki/TI_MSP430) family


Usage
-----

Syntax:
```sh
ts2c <files to transpile>
```

In browser (also see **index.html** file):
```html
<script src="https://unpkg.com/typescript"></script>
<script src="ts2c.bundle.js"></script>
<script>
    var cCode = ts2c.transpile("console.log('Hello world!')");
    alert(cCode);
</script>
```
