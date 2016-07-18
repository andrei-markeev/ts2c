JavaScript/TypeScript to C transpiler
=====================================

Produces readable C code from JS/TS code, with as little overhead as possible.

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
 
__**Work in progress:**__ it works, but very small part of JS/TS syntax is currently supported.


Usage
-----

Primary use case is creating solutions for microcontrollers, especially IoT and wearables.

Syntax:
```
node ts2c.js <files to transpile>
```

In browser:
```
<script src="ts2c.bundle.js" />
<script>
    var cCode = ts2c.transpile("console.log('Hello world!')");
    alert(cCode);
</script>
```
