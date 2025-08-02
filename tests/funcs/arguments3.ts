function testArgs3(firstString) {
    console.log(firstString);
    for (let i = 1; i < arguments.length; i++)
        console.log(arguments[i]);
}

testArgs3("123");
testArgs3(123, "world");
testArgs3(true, "here", "we", "go");
