var str = "17";
var num = 9;
var arr0 = [];
var arr1 = [33];
var arr2 = [10, {test: "hello!"}];
var obj = { some: 12 };

console.log(str << 1);
console.log(str >> 2);
console.log(str >>> 3);

console.log(arr0 | 22);
console.log(arr1 & 3);
console.log(arr2 | 2);
console.log(obj & 31);
console.log(obj.some & 31);