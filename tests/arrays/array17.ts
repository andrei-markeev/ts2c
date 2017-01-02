var arr = ["Hello", "world!"];
var str = arr.join(", ");
console.log(str);

var arr2 = ["something was there, but..."];
arr2.pop();
console.log(arr2.join());

var arr3 = arr.concat("and","hi","there");
console.log(arr3.join());

var arr4 = [1,2,3,7];
console.log(arr4.join("_"));

console.log([1,2,5,2].join());

console.log(["happy","new","year"].toString());
