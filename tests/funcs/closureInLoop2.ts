function countTheNumber() {
    var arrToStore = {};
    for (var x = 0; x < 9; x++) {
        arrToStore["func" + x] = function () {
            return x;
        };
    }
    return arrToStore;
}

const callInnerFunctions = countTheNumber();
const inner0 = callInnerFunctions["func0"];
const inner1 = callInnerFunctions["func1"];
console.log(inner0()); // 9
console.log(inner1()); // 9
