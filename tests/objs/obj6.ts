var dict = { x: 2, y: 3, "test": 3 };
console.log(delete dict.x);
var i = 10;
dict[i + ""] = 1;
delete dict["y"];
console.log(delete dict["test2"]);
console.log(dict);
delete dict[10];
console.log(dict);
