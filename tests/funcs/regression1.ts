// regression test for #74
function return_from_obj() {
    let obj = { key: 1 };
    return obj.key;
}

console.log(return_from_obj());
