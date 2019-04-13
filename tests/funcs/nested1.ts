function func() {
    function nested() {
        return 10;
    }
    return nested();
}

console.log(func());