var arr = ["some","test","string","values","go","here"];
arr.splice(0,0);
console.log(arr);
arr.splice(0,1);
console.log(arr);
arr.splice(1,1);
console.log(arr);
arr.splice(1,0,"new1","new2");
console.log(arr);
arr.splice(2,2,"new3","new4");
console.log(arr);
console.log(arr.splice(3,1));
console.log(arr.splice(3,2,"new5"));
console.log(arr);
// TODO: negative index
// TODO: out of bounds index
// TODO: too many elements to delete
