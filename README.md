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
    printf("%s", "Hello world!\n");
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

    printf("%s", "{ ");
    printf("key: \"%s\"", obj->key);
    printf("%s", ", ");
    printf("newKey: \"%s\"", obj->newKey);
    printf("%s", " }\n");

    free(obj);

    return 0;
}
```


Project status
--------------

__**Work in progress:**__ it works, but only about **60% of ES3** specification is currently supported: statements and expressions - 84%, built-in objects - 16%.

Notable NOT supported features include, for example: float and big numbers (all numbers are `int16_t` currently), `function` inside expression or passing functions by reference, `eval`, `Date`, `Math`, etc.

Detailed information about supported and planned features can be found in [COVERAGE.md](https://github.com/andrei-markeev/ts2c/blob/master/COVERAGE.md).

Contributions are welcome! See [src/README.md](https://github.com/andrei-markeev/ts2c/blob/master/src/README.md)


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
notably `eval`. Still, current conclusion is, that it is possible to transpile most of the language.

Targets
-------

Planned transpilation targets:

 - [ESP32](https://en.wikipedia.org/wiki/ESP32) - work in progress, see project [ESP-IDF target for TS2C](https://github.com/andrei-markeev/ts2c-target-esp-idf)
 - [ESP8266](https://en.wikipedia.org/wiki/ESP8266)
 - [Atmel AVR](https://en.wikipedia.org/wiki/Atmel_AVR#Basic_families) family (used in Arduino boards)
 - [TI MSP430](https://en.wikipedia.org/wiki/TI_MSP430) family


Usage
-----

**Command line:**
```
npm install -g ts2c
```

Syntax:
```sh
ts2c <files to transpile>
```

**Node.js:**
```
npm install ts2c
```

```javascript
const ts2c = require("ts2c");
const cCode = ts2c.transpile("console.log('Hello world!')");
console.log(cCode);
```

**In browser:**
```html
<script src="https://unpkg.com/typescript"></script>
<script src="ts2c.bundle.js"></script>
<script>
    var cCode = ts2c.transpile("console.log('Hello world!')");
    alert(cCode);
</script>
```

