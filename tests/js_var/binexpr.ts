function add_and_substract(x, y, z) {
    var res = x + y - z;
    return res;
}

var a = 10;

var r1 = add_and_substract("10", 11, "Hello")
var r2 = add_and_substract(a, "11", 100)

console.log(r1);
console.log(r2);
console.log(r1 + r2);
console.log(add_and_substract(a, 20, 5));

/*
var a = 10;
var b = 7;
z = a + b + y - x;
console.log(z);

console.log(+s1 + 10);
console.log(+s2 - 5);


console.log(a - b || x + y);
console.log(x + a || y + b);
*/