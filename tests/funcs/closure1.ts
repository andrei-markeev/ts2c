function test() {
    var a = 10;
    function iife() {
        var b = 20;
        function sum() {
            return a + b;
        }
        return sum;
    }
    return iife();
}

var func = test();
console.log(func());