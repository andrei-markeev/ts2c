var match = "something here".match(/thing/);
console.log(match[0]);
match = "Matching string".match(/t[es]+t/);
if (match)
    console.log('Incorrect!');
console.log("Hello world!".match(/lo.*l/)[0]);

var startTagRegex = /^<(!?[-A-Za-z0-9_]+)((?:\s+[\w\-\:]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
    endTagRegex = /^<\/([-A-Za-z0-9_]+)[^>]*>/;

var html = '<html lang="en"><body></body></html>';
var match2 = html.match(startTagRegex);
console.log(match2);
console.log(html.slice(22).match(endTagRegex));
