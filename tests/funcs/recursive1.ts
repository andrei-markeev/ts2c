function f(){
    console.log('f');
    return f;
}

function g(){
    console.log('g');
    return m;
}
function m(){
    return g;
}

let pf = f();
pf();

let pg = m();
pg();
