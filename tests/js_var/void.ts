function voidify(x) {
    return void(x);
}

function log(message) {
    console.log("Logged:", message);
}

var a = 10;
console.log(voidify(a + "test"))
console.log(void 0);
console.log(void log("Hello world"));