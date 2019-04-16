var arr = [1, 2, 3]
console.log(
    (function(arr) {
        for (let i=0; i<arr.length; i++)
            arr[i]++;
        return arr;
    })(arr)
);
