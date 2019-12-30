var obj = { test: {} };
var temp = obj;

obj.test = { nested: temp };

console.log(obj);
