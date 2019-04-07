function test() {
    throw "Error thrown from function";
}

try {
    test();
} catch(e) {
    console.log(e);
}
