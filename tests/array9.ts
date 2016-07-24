function tail(arr, pos, max) {
    if (pos === arr.length - 1) {
        return arr[pos] > arr[max] ? arr[pos] : arr[max];
    }
    max = arr[pos] > arr[max] ? pos : max;
    pos++;
    return tail(arr, pos, max);
}

console.log(tail([10, 20, 60, 30, 20, 60], 0, 0));
