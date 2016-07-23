export interface IResolvable {
    resolve: () => string;
}

export function CodeTemplate(tempString: string): ClassDecorator {
    return function (target: Function) {
        return function () {
            let self = this;
            self.resolve = function () {
                return processTemplate(tempString, self);
            };
            return target.apply(self, arguments);
        }
    };
}

function processTemplate(template: string, args: any) {
    if (typeof args === "string")
        return template.replace("{this}", args);;

    let ifPos;
    while ((ifPos = template.indexOf("{#if ")) > -1) {
        let posBeforeIf = ifPos;
        while (posBeforeIf > 0 && (template[posBeforeIf - 1] == ' ' || template[posBeforeIf - 1] == '\n'))
            posBeforeIf--;
        ifPos += 5;
        let conditionStartPos = ifPos;
        while (template[ifPos] != "}")
            ifPos++;

        let endIfPos = template.indexOf("{/if}", ifPos);
        let elseIfPos = template.indexOf("{#elseif ", ifPos);
        let elsePos = template.indexOf("{#else}", ifPos);
        let endIfBodyPos = endIfPos;
        if (elseIfPos != -1 && elseIfPos < endIfBodyPos)
            endIfBodyPos = elseIfPos;
        if (elsePos != -1 && elsePos < endIfBodyPos)
            endIfBodyPos = elsePos;
        if (endIfBodyPos > 0 && template[endIfBodyPos-1] == '\n')
            endIfBodyPos--;
            
        let posAfterIf = endIfPos + 5;

        let evalText = template.slice(conditionStartPos, ifPos);
        for (let k in args)
            evalText = evalText.replace(new RegExp("\\b" + k + "\\b", "g"), function (m) { return "args." + m; });
        let evalResult: boolean = eval(evalText);
        if (evalResult)
            template = template.slice(0, posBeforeIf) + template.slice(ifPos + 1, endIfBodyPos).replace(/\n    /g, '\n') + template.slice(posAfterIf);
        else if (elseIfPos > -1)
            template = template.slice(0, posBeforeIf) + "{#" + template.slice(elseIfPos + 6);
        else if (elsePos > -1)
            template = template.slice(0, posBeforeIf) + template.slice(elsePos + 7, endIfPos).replace(/\n    /g, '\n') + template.slice(posAfterIf);
        else
            template = template.slice(0, posBeforeIf) + template.slice(posAfterIf);
        
    }

    let replaced = false;
    for (var k in args) {
        if (k == "resolve")
            continue;
        if (args[k] && args[k].push) {
            let pos = template.indexOf("{" + k + '}');
            if (pos == -1)
                pos = template.indexOf("{" + k + ' ');
            else {
                let elementsResolved = args[k].map(e => processTemplate("{this}", e)).join('');

                template = template.slice(0, pos) + elementsResolved + template.slice(pos + k.length + 2);
                replaced = true;
                continue;
            }
            if (pos == -1)
                pos = template.indexOf("{" + k + '=');
            if (pos == -1)
                pos = template.indexOf("{" + k + '{');
            if (pos == -1)
                continue;
            let startPos = pos;
            pos += k.length + 1;
            while (template[pos] == ' ')
                pos++;
            let separator = '';

            if (template[pos] == '{') {
                pos++;
                while (template[pos] != '}' && pos < template.length) {
                    separator += template[pos]
                    pos++;
                }
                pos++;
            }
            if (pos >= template.length - 2 || template[pos] !== "=" || template[pos + 1] !== ">")
                throw new Error("Internal error: incorrect template format for array " + k + ".");

            pos += 2;
            if (template[pos] == ' ' && template[pos + 1] != ' ')
                pos++;

            let curlyBracketCounter = 1;
            let elementTemplateStart = pos;
            while (curlyBracketCounter > 0) {
                if (pos == template.length)
                    throw new Error("Internal error: incorrect template format for array " + k + ".");
                if (template[pos] == '{')
                    curlyBracketCounter++;
                if (template[pos] == '}')
                    curlyBracketCounter--;
                pos++;
            }
            let elementTemplate = template.slice(elementTemplateStart, pos - 1);
            let elementsResolved;
            elementsResolved = args[k].map(e => processTemplate(elementTemplate, e)).join(separator);

            if (args[k].length == 0) {
                while (pos < template.length && template[pos] == ' ')
                    pos++;
                while (pos < template.length && template[pos] == '\n')
                    pos++;
                while (startPos > 0 && template[startPos-1] == ' ')
                    startPos--;
                while (startPos > 0 && template[startPos-1] == '\n')
                    startPos--;
                if (template[startPos] == '\n')
                    startPos++;
            }
            template = template.slice(0, startPos) + elementsResolved + template.slice(pos);
            replaced = true;
        }
        else
            while (template.indexOf("{" + k + "}") > -1) {
                let value = args[k];
                if (value && value.resolve)
                    value = value.resolve();
                template = template.replace("{" + k + "}", value);
                replaced = true;
            }
    }
    if (args["resolve"] && !replaced && template.indexOf("{this}") > -1) {
        template = template.replace("{this}", args["resolve"]());
    }
    return template.replace(/^[\n\s]*/,'').replace(/\n\s*\n[\n\s]*\n/g, '\n\n');
}
