var n = NaN;
var x = 5;

console.log(n);
console.log(isNaN(n));
console.log(x);
console.log(isNaN(x));

console.log(isNaN(""));
console.log(isNaN("31415"));
console.log(isNaN("python"));
console.log(isNaN([1, 2, 3]));
console.log(isNaN({}));
console.log(isNaN(true));
console.log(isNaN(undefined));