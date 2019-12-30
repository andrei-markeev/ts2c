var obj = { };
obj["test"] = { hello: "world" };
obj["test"]["test2"] = obj;
console.log(obj);
