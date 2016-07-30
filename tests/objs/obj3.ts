var obj1 = {};
obj1["obj2"] = { key1: "blablabla", key2: 10, key3: [1, 2, 3], key4: { test: "something" } };
obj1.obj2.key2 = 20;
obj1["obj2"]["key3"][2] = 123;
console.log(obj1);
