function tail(arr, pos, max): number {
    if (pos === arr.length - 1) {
        return arr[pos] > arr[max] ? arr[pos] : arr[max];
    }
    max = arr[pos] > arr[max] ? pos : max;
    pos++;
    return tail(arr, pos, max);
}

var res = tail([10, 20, 60, 30, 20, 60], 0, 0);
console.log(res);
