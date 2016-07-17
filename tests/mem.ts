var state: { prop: string } = { prop: 'hi'};
function print() {
    console.log(state);
}
function saveState(newState) {
    state = newState;
}
function generateState() {
    var obj = { prop: 'I don\'t believe "transpiling" from TS to C is possible!' };
    var x = obj;
    saveState(x);
}

generateState();
print();
