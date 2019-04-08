console.log("Empty", "" < "");
console.log("EmptyLeft", "" < "1");
console.log("EmptyRight", "1" < "");
console.log("Same", "year 2019" < "year 2019");
console.log("LeftIsPrefix", "12" < "123");
console.log("RightIsPrefix", "123" < "12");
console.log("Different", "abcd" < "abdd");

var arr = [1,2,3];
console.log("ArrayVsString1", arr > "1,3,2");
console.log("ArrayVsString2", arr < "1,3,2");
console.log("ArrayVsString3", arr >= "1,3,2");
console.log("ArrayVsString3", arr <= "1,3,2");

console.log("ArrayVsNumber1", arr > 123);
console.log("ArrayVsNumber2", arr < 123);
console.log("ArrayVsNumber3", arr >= 123);
console.log("ArrayVsNumber4", arr <= 123);

console.log("StringVsNumber1", "abc" > 65);
console.log("StringVsNumber2", "abc" < 65);
console.log("StringVsNumber3", "abc" >= 65);
console.log("StringVsNumber4", "abc" <= 65);

console.log("StringVsNumber5", "655" > 65);
console.log("StringVsNumber6", "655" < 65);
console.log("StringVsNumber7", "655" >= 65);
console.log("StringVsNumber8", "655" <= 65);

var obj = { test: "hello" };
console.log("StringVsObject1", "[obj" > obj);
console.log("StringVsObject2", "[obj" < obj);
console.log("StringVsObject3", "[obj" >= obj);
console.log("StringVsObject4", "[obj" <= obj);

console.log("Null1", null > 100);
console.log("Null2", null < 100);
console.log("Null3", null >= 100);
console.log("Null4", null <= 100);

console.log("Undefined1", "undefined" > undefined);
console.log("Undefined2", "undefined" < undefined);
console.log("Undefined3", "undefined" >= undefined);
console.log("Undefined4", "undefined" <= undefined);

console.log("NullVsUndefined1", null > undefined);
console.log("NullVsUndefined2", null < undefined);
console.log("NullVsUndefined3", null >= undefined);
console.log("NullVsUndefined4", null <= undefined);
