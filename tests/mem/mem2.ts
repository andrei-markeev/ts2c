function testInNestedFunc()
{
    var obj = [];
    obj.push(200);
    obj[0] = 100;
    console.log(obj);
}

testInNestedFunc();
