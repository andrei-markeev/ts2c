var e = 10;
function sum(a){
  return function(b){
    return function(c){
      return function(d){
        return a + b + c + d + e;
      }
    }
  }
}

var f1 = sum(1);
var f2 = f1(2);
var f3 = f2(3);
var f4 = f3(4);
console.log(f4);