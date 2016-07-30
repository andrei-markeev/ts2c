let s1 = "simple test";
let s2 = 'áäöß€𐍈';

console.log(s1.indexOf("test"));
console.log(s1.indexOf(s2));
console.log(s2.indexOf("test"));
console.log(s2.indexOf("á"));
console.log(s2.indexOf('ß€'));
console.log(s2.indexOf("\u20AC"))
console.log(s2.indexOf("𐍈"));
