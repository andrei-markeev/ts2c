var x: any = 0;
var y: string | number[] = [5];

console.log(x);
console.log(+y);

x = y[x];
if (x)
    x = [1, 2, 3, x];

console.log(x);

y = "hello";

console.log(y);