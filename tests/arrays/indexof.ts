var arr1 = [1, 2, 3];
console.log(arr1.indexOf(2));
console.log(arr1.indexOf(4));

var arr2 = [10, 20, 30, 40];
arr2.push(60);

console.log(arr2.indexOf(10));
console.log(arr2.indexOf(50));
console.log(arr2.indexOf(60));

arr2.pop();

console.log(arr2.indexOf(60));
