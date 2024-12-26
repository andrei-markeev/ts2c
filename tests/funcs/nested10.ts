function func1(arg1, arg2) {
    return function nestedfunc() {
        return arg1 + arg2;
    };
}

console.log(func1(1, 2)());