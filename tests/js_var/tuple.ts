var tuple = [1, "hello", true];

console.log(tuple);

tuple[1] = "test";

console.log(tuple);

tuple[0] = 12 + +tuple[1];
tuple[2] = false;

console.log(tuple);