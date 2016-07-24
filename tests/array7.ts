var arrOfArrays1 = [];
arrOfArrays1.push([10, 20, 30]);
arrOfArrays1[0].push(100);
arrOfArrays1.push([1, 2]);
console.log(arrOfArrays1);

let ari;
for (ari of arrOfArrays1) {
    console.log(ari);
}
