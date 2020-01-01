var num = 1;

var dict = {};
dict["value" + num] = 4;
--dict["value1"];
dict["value1"]--;
++dict["value1"];
dict["value1"]++;
console.log(dict["value1"]);
console.log(10 + --dict["value1"], dict["value1"]);
console.log(10 + dict["value1"]--, dict["value1"]);
console.log(10 + ++dict["value1"], dict["value1"]);
console.log(10 + dict["value1"]++, dict["value1"]);
