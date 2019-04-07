
function print(p) {
    try {
        if (p === 3)
            throw "Parameter cannot be 3!";
        console.log(p);
    } catch(e) {
        console.log(e);
    }
}

try {
    for (var i=0; i<5; i++)
        print(i);
} catch {
    console.log("Something went wrong!");
}
