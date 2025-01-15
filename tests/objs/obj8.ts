var indices = [1, 2, 3];
var values = ["11", "22", "33"];
var obj = { };
for(var x = 0; x < indices.length; x++) {
    obj[indices[x]] = values[x];
}

for(var y = 0; y < indices.length; y++) {
    console.log(obj[indices[y]]);
}