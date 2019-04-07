const x = 1;

try {

    if (x)
        throw "test error";
    
    console.log("Unreachable")

} catch {
    console.log("Error occured!");
}