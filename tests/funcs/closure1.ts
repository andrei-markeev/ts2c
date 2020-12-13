function test() {
    var a = 10;
    return (function() {
        var b = 20;
        function sum() {
            return a + b;
        }
        return sum;
    })();
}

var func = test();
console.log(func());