var match = "something here".match(/thing/);
console.log(match[0]);
match = "Matching string".match(/t[es]+t/);
if (match[0])
    console.log('Incorrect!');
console.log("Hello world!".match(/lo.*l/)[0]);
