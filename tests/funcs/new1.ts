function func1() {
    this.test = 10;
    this.hello = 20;
}

var x = new func1();

console.log(x.test);