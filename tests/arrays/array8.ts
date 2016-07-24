// Test deeply nested element accessors

let array1 = [];
let array2 = [];
let obj1 = {};
let obj2 = {};

// array1 -> obj1 -> obj2 -> array2
array1.push(obj1);
obj1["obj2"] = obj2;
obj2["array2"] = array2;
array2.push("Hello");
array2.push("world!");

console.log(array1);
console.log(array1[0]);
console.log(array1[0].obj2);
console.log(array1[0]["obj2"].array2);
console.log(array1[0].obj2["array2"][1]);
