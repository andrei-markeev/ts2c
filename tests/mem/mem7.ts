function return_from_obj() {
    let obj = { key: { hello: "world" } };
    return obj.key;
}
function return_from_obj2() {
    let obj = { key: 132 };
    return obj.key;
}

console.log(return_from_obj());
console.log(return_from_obj2());