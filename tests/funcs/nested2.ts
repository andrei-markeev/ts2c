function one(i) {
    return two();

    function two() {
        return 2 * i;
    }
}

console.log(one(3));