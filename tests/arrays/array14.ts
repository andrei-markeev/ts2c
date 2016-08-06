var int_arr1 = [ 10, 40, 20, 30, 40, 50 ];
var int_arr2 = [ 1, 2, 3 ];
int_arr2.push(3);
int_arr2.push(4);
int_arr2.push(5);
var str_arr1 = [ "hello", "world", "test", "hello" ];
var str_arr2 = [ "test", "hello" ];
str_arr2.unshift("something");

console.log(int_arr1.lastIndexOf(40));
console.log(int_arr2.lastIndexOf(3));
console.log(str_arr1.lastIndexOf("hello"));
console.log(str_arr2.lastIndexOf("something"));
