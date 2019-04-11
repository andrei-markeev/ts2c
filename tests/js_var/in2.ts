var x = "test";
var y = { "test": true, "other": false };
var arr = [ "some", "thing" ];
arr.push("hello");

console.log(x in y);
console.log("length" in arr);
console.log("indexOf" in arr);
console.log(y in arr);
