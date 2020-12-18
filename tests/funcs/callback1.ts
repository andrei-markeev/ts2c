function something(callback) {
    return callback("something");
}
const callback1 = function(value: string) {
    return "first callback " + value;
}
const callback2 = function(value: string) {
    return "second callback " + value;
}
console.log(something(callback1));
console.log(something(callback2));
