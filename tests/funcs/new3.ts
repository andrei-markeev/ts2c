function Dict(obj) {
    for (var k in obj)
        this[k] = obj[k];
}

var d = new Dict({ hello: "World", test: 2 });
console.log(d);

var d2 = new Dict(d);
console.log(d2);