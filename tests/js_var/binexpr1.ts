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
