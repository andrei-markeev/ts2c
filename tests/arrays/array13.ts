var arr = ["some","test","string","values","go","here"];

// void splice
arr.splice(0,0);
console.log(arr);

// without adding new values
arr.splice(0,1);
console.log(arr);
arr.splice(1,1);
console.log(arr);

// with adding new values
arr.splice(1,0,"new1","new2");
console.log(arr);
arr.splice(2,2,"new3","new4");
console.log(arr);

// as part of expression
console.log(arr.splice(3,1));
console.log(arr.splice(3,2,"new5"));
console.log(arr);

// negative index
console.log(arr.splice(-3,1));
arr.splice(-3,1);
console.log(arr);

// TODO: out of bounds index
// TODO: too many elements to delete
