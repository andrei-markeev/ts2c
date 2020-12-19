var x = "global x";
(function(){
    var x = "inside ffe";
    console.log(x);
})()
console.log(x);
