
var match = "something here".match(/thing/);
console.log(match[0]);
match = "Matching string".match(/t[es]+t/);
if (match)
    console.log('Incorrect!');

console.log("Hello world world!".match(/lo.*l/)[0]);
console.log("Hello world!".match(/lo.*l/)[0]);


var html = '<html lang="en"><body></body></html>';

var startTagRegex = /^<(!?[-A-Za-z0-9_]+)((?:\s+[\w\-\:]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/;

var match2 = html.match(startTagRegex);
if (match2)
    console.log(match2);

console.log('<img src="test.png" />'.match(startTagRegex));

var endTagRegex = /^<\/([-A-Za-z0-9_]+)[^>]*>/;
console.log(html.slice(22).match(endTagRegex));

console.log("abababc".match(/(a(ba)b+)+(c)/));

// TODO: not working
// console.log("xxxxxy".match(/(x+x+)+y/));

console.log("a cd".match(/[a ]*(c)?d/));
