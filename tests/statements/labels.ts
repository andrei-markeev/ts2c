var i, j;

l1:
{
    console.log("---1");
    break l1;
    console.log("---2");
}

loop1:
for (i = 0; i < 3; i++) {
   loop2:
   for (j = 0; j < 3; j++) {
      if (i === 1 && j === 1) {
         continue loop1;
      }
      console.log('continue i = ' + i + ', j = ' + j);
   }
}

loop3:
for (i = 0; i < 3; i++) {
   loop4:
   for (j = 0; j < 3; j++) {
      if (i === 1 && j === 1) {
         break loop3;
      }
      console.log('break i = ' + i + ', j = ' + j);
   }
}

var arr = [1, 10, 2, 6];
loop5:
for (var el of arr) {
    for (i = 0; i < el; i++) {
        if (i > 3)
            continue loop5;
        console.log("for of", i);
    }
}

j = 0;
loop6:
while (j < arr.length) {
    j++;
    for (i = 0; i < arr[j]; i++) {
        if (i > 1)
            continue loop6;
        console.log("while", i);
    }
}

j = 0;
loop7:
do {
    j++;
    for (i = 0; i < arr[j]; i++) {
        if (i > 1)
            continue loop7;
        console.log("do while", i);
    }
} while (j < arr.length);

var obj = { "egg": 1, "ham": 2, "pizza": 3, "banana": 4 };
loop8:
for (var k in obj) {
    do {
        if (k.length > 3)
            continue loop8;
        console.log("for in", k);
    } while(false);
}
