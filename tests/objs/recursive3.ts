function create(parent) {
    return { test: true, parent: parent };
}
var obj = create(null);
var child = create(obj);
console.log(child);
