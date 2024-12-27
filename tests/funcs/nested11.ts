function foo() {
    var s = "a";
    function bar(a) {
        s += " hello " + a;
    }
    bar(5);
    return s;
}
console.log(foo());