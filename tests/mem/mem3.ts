function nested()
{
    var obj = { key: "something" };
    return obj;
}

function func()
{
    var x = nested();
    console.log(x);
}

func();