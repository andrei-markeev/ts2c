var u1 = "123";
var u2 = "abc";
var u3 = [12];
u3.push("15");
console.log(10 - u1++, u1);
console.log(10 - u1--, u1);
console.log(10 - u2++, u2);
console.log(10 - u2--, u2);
console.log(10 - u3[1]++, u3[1]);
console.log(10 - u3[1]--, u3[1]);
