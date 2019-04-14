function do_stuff(arr) {
    function add(i) {
        arr[i]++;
    }
    for (let i = 0; i < arr.length; i++) {
        add(i);
    }
}

var a = [1,2,3,4];
do_stuff(a);
console.log(a);