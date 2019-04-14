function do_stuff() {
    var sum = 0;
    var k = 2;
    function add(n) {
        sum += n * k;
        console.log(sum);
    }
    add(10);
    add(30);
    add(5);
}
do_stuff();
