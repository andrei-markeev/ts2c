function newNode(tagName, attrs, parent) {
    return {
        tagName: tagName,
        attrs: attrs,
        childNodes: [],
        parentNode: parent,
        innerHTML: ""
    };
}
function appendChild(node, tagName, attrs) {
    var n = newNode(tagName, attrs, node);
    node.childNodes.push(n);
    return n;
}
function appendInnerHTML(node, html) {
    var n = node;
    while (n) {
        n.innerHTML += html;
        n = n.parentNode;
    }
}

function parseHtml(html) {
    var startTagRegex = /^<(!?[-A-Za-z0-9_]+)((?:\s+[\w\-\:]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
        endTagRegex = /^<\/([-A-Za-z0-9_]+)[^>]*>/;
    var special = { script: 1, style: 1 };
    var index, chars, match, last = html;
    var currentNode = newNode('', '{}', null);
    var rootNode = currentNode;

    while (html.length) {
        chars = true;
        console.log("1");

        // Make sure we're not in a script or style element
        if (!special[currentNode.tagName]) {

            // Comment
            if (html.indexOf("<!--") == 0) {
                console.log("comment");
                index = html.indexOf("-->");

                if (index >= 0) {
                    html = html.substring(index + 3);
                    chars = false;
                }

                // end tag
            } else if (html.indexOf("</") == 0) {
                console.log("end_tag");
                match = html.match(endTagRegex);

                if (match) {
                    html = html.substring(match[0].length);
                    currentNode = currentNode.parentNode;
                    appendInnerHTML(currentNode, match[0]);
                    chars = false;
                }

                // start tag
            } else if (html.indexOf("<") == 0) {
                console.log("start_tag");
                match = html.match(startTagRegex);

                if (match) {
                    console.log("matched");
                    html = html.substring(match[0].length);
                    //var attrs = {};
                    //for (var i = 2;i<match.length-1; i++)
                    //    attrs[match[i].replace(/=.*/,'').replace(/^\s+/,'')] = match[i].replace(/^[^=]+=/,'').slice(1,-1);
                    appendInnerHTML(currentNode, match[0]);
                    currentNode = appendChild(currentNode, match[1], "attrs");
                    if (match[match.length-1] == "/")
                        currentNode = currentNode.parentNode;
                    chars = false;
                }
            }

            if (chars) {
                console.log("chars");
                index = html.indexOf("<");

                var text = index < 0 ? html : html.substring(0, index);
                html = index < 0 ? "" : html.substring(index);

                appendChild(currentNode, "#text", "{}");
                appendInnerHTML(currentNode, text);
            }

        } else {
            html = html.substring(html.indexOf("</" + currentNode.tagName + ">"));
        }

        console.log("html==last...");
        if (html == last) {
            console.log("Parse Error: " + html);
            return rootNode;
        }
        console.log("last=html");
        last = html+"";
    }

    return rootNode;

}

var result = parseHtml("<html><body></body></html>");
console.log(result);
