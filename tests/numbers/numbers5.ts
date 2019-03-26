var x = Number("10");
var y = Number(10);
console.log(x == y);
if (Number.NaN != NaN)
    console.log("Number.NaN != NaN, that's fine.");
var z = Number.NaN;
console.log(z == x + y);
console.log(z * 10)
z = x * y;
if (z === 100)
    console.log("good!");
