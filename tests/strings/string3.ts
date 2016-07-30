let s1 = "simple test";
console.log(s1.length);

let s2 = "áäöß€𐍈";
console.log(s2.length);

let s3 = "\u20AC";
console.log(s3.length);

let s4 = "\xe4\xbd\xa0\xe5\xa5\xbd\xe4\xb8\x96\xe7\x95\x8c";
console.log(s4.length);

if (s3.length > 1 || s2.length != 7 || s1.length < s2.length)
    console.log("ERROR!");
