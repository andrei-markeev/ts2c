var i = 0;
var arr1 = [10, 20, 30, 100];
var arr2 = ["hello", "world", "bar", "foo"];
var slice1 = arr1.slice(0, 2);
var slice2 = arr1.slice(i + 2, -1);
slice2.push(33);
var slice3 = arr2.slice(1, i - 1);
slice3.unshift("apple");
var slice4 = arr2.slice(1, 3);
slice4.push("test");
var slice5 = arr2.slice(0, -2);
console.log(slice1);
console.log(slice2);
console.log(slice3);
console.log(slice4);
console.log(slice5);
console.log(arr1.slice(2, -2));
console.log(arr1.slice(-3, 3));
console.log(arr2.slice(3));
console.log(arr1);
console.log(arr2);

// TODO: out of bounds index
