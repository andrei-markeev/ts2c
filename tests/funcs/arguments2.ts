function testArgs2(firstString) {
    console.log(firstString);
    for (let i = 1; i < arguments.length; i++)
        console.log(arguments[i]);
}

testArgs2("123");
testArgs2("hello", "world");
testArgs2("too","many","params");
