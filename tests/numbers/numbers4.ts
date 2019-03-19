var number;

number = 3072;
console.log("Positive:", number);
console.log(">>", number >> 3);
number >>= 3;
console.log(">>=", number);

number = 3072;
console.log(">>>", number >>> 3);
number >>>= 3;
console.log(">>>=", number);

number = 3072;
console.log("<<", number << 2);
number <<= 2;
console.log("<<=", number);

number = -2;
console.log("Negative:", number);
console.log(">>", number >> 1);
number >>= 1;
console.log(">>=", number);

number = -2;
console.log(">>>", number >>> 1);
number >>>= 1;
console.log(">>>=", number);