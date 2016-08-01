var obj = {};
for (var x = 5;x > 0; x--) {
    obj["k" + x] = x * 2;
}

obj["a"] = 50;
obj["k3"] = 99;
obj["z"] = 100;

console.log(obj["k2"]);
console.log(obj);

for (var k in obj) {
    console.log(k + ": " + obj[k]);
}
