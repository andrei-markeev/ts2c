var s1 = "simple test";
var s2 = 'áäöß€𐍈';

console.log(s1.substring(1, 5));
console.log(s2.substring(-1, 2));
console.log(s2.substring(9, 3));
console.log((s1+s2).substring(15));
console.log('test €€€ hello'.substring(10));
console.log(s2.slice(-1, 2));
console.log(s2.slice(-100, 2));
console.log(s2.slice(1, -1));
console.log(("test €€€ " + s1).slice(10));
