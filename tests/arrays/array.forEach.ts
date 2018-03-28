const int_array = [10, 20, 30];
let summ = 0;

function printItem(item = 0) {
	summ = summ + item;
};

int_array.forEach(printItem);

console.log(summ);