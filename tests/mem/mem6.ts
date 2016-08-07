function indirect_recurse(arr)
{
    console.log(arr);
    recurse(arr);
}

function recurse(incoming_arr)
{
    var counter = incoming_arr.pop();
    counter--;
    var new_arr = [];
    new_arr.push(counter);
    if (counter > 0)
        indirect_recurse(new_arr);
}

var init_arr = [];
init_arr.push(5);
recurse(init_arr);
