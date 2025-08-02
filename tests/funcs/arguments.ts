function testArgs() {
    console.log(arguments.length);
    console.log(arguments[0]);
}

testArgs("string");
testArgs("hello", "world");
