var a = [123,456];
for (var i = 0;i < a.length;i++)
    console.log(a[i]);
for (let elem of a)
    console.log(elem);
while (a.length > 0)
    console.log(a.pop());