function prepare() {
    var printArr = [];
    for (var x = 0; x < 9; x++) {
        printArr.push(function () {
            return "number " + x;
        });
    }
    return printArr;
}

var arr = prepare();
for (var i = 0; i < arr.length; i++) {
    const getMessage = arr[i];
    console.log(getMessage());
}
