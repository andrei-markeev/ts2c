var obj1 = {};
var obj2 = {};

obj1["o2"] = obj2;
obj2["o1"] = obj1;

console.log(obj1);
console.log(obj2);