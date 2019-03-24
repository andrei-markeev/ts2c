var x = typeof true;
var y = [1, 2, 3];
var z = { prop1: "test" }

if (x === typeof false)
    console.log("typeof true === typeof false");
if (typeof "test" !== "string")
    console.log("typeof test !== \"string\"");
if (typeof null === "object")
    console.log("typeof null === \"object\"");

console.log(typeof undefined);
console.log(typeof { some: 123 } + " something");
console.log("typeof y:", typeof y);
console.log("typeof z:", typeof z);
console.log("typeof z.prop1:", typeof z.prop1);
