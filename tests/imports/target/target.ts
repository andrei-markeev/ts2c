import { abs, srand, rand, RAND_MAX } from "ts2c-target-test/stdlib.h";
import { strftime } from "ts2c-target-test/time.h";

console.log(abs(-5));
console.log(abs(10));

srand(123);
var x = rand();
var y = rand();

console.log(x === y);
console.log(x <= RAND_MAX);

var my_time = {
    tm_year: 112, // = year 2012
    tm_mon: 9,    // = 10th month
    tm_mday: 9,   // = 9th day
    tm_hour: 8,   // = 8 hours
    tm_min: 10,   // = 10 minutes
    tm_sec: 20,   // = 20 secs
    tm_yday: 0,
    tm_wday: 0,
    tm_isdst: 0
};

var buff = new Uint8Array(70);
if (strftime(buff, 70, "%A %c", my_time))
    console.log(buff)
else
    console.log("strftime failed!");