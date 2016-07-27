let variants = ["banana", "kiwi", "pear", "plum"];

function alloc(n)
{
    if (n < variants.length - 1) {
        let s = variants[n] + "," + variants[n+1];
        return s;
    }
    else
        return "";
}

function use(index, search)
{
    let value = alloc(index);
    if (value.indexOf(search) > -1)
        console.log(value);
    else
        console.log(search + " not found!");
}

use(0, "banana");
use(1, "plum");
use(2, "plum");
use(3, "pear");
use(4, "kiwi");
