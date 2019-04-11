var a = { "hello": "world" };
var b = 17;
var c = null;

function dec_b() {
    return --b;
}

console.log(a && b);
console.log(a || b);
console.log(a && c);
console.log(a || c);
console.log(b && a);
console.log(b || a);
console.log(b && c);
console.log(b || c);
console.log(c && a);
console.log(c || a);
console.log(c && b);
console.log(c || b);

console.log(a && b || c);
console.log(b - 17 || c);


if (dec_b() || c)
    console.log(b);