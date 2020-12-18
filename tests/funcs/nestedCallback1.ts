function something() {
    function innerFunc(callback) {
        return callback("something from inner function");
    }
    const callback = function (theThingToGiveBack: string) {
        return "deepest inside " + theThingToGiveBack;
    };
    return "Something " + innerFunc(callback);
}

console.log(something());