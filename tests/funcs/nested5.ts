function do_stuff()
{
    var obj = { a: 10, b: "something" };

    function inc_obj_a() {
        obj.a++;
    }

    for (var i = 0; i < obj.b.length; i++)
        inc_obj_a();

    console.log(obj);
}

do_stuff();
