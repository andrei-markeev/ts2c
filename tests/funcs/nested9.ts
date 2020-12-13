var makeCounter = function () {
    var privateCounter = 0;
    function changeBy(val) {
        privateCounter += val;
    }
    return {
        increment: function () {
            changeBy(1);
        },
        decrement: function () {
            changeBy(-1);
        },
        value: function () {
            return privateCounter;
        }
    }
};

var counter1 = makeCounter();
var counter2 = makeCounter();
console.log(counter1.value()); /* 0 */
console.log(counter2.value()); /* 0 */
counter1.increment();
counter1.increment();
console.log(counter1.value()); /* 2 */
console.log(counter2.value()); /* 0 */
counter1.decrement();
counter2.decrement();
console.log(counter1.value()); /* 1 */
console.log(counter2.value()); /* -1 */
