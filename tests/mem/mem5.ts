function alloc()
{
    let obj = { key1: "hello!", key2: "something"}
    return obj;
}
function f2_wrap()
{
    let a = alloc();
    return a;
}
function f2()
{
    let b = f2_wrap();
    console.log("f2: ", b);
}
function f1()
{
    let a = alloc();
    a.key1 = "changed";
    console.log("f1: ", a);
}

f1();
f2();