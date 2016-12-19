import {IScope} from './program';

interface INode { kind: number, getText(): string };

var nodeKindTemplates: { [kind: string]: { new (scope: IScope, node: INode): any } } = {};

export class CodeTemplateFactory {
    public static createForNode(scope: IScope, node: INode) {
        return nodeKindTemplates[node.kind] && new nodeKindTemplates[node.kind](scope, node)
            || "/* Unsupported node: " + node.getText().replace(/[\n\s]+/g, ' ') + " */;\n";
    }
}

export function CodeTemplate(tempString: string, nodeKind?: number | number[]): ClassDecorator {
    return function (target: Function) {
        let newConstructor = function (scope: IScope, ...rest: any[]) {
            let self = this;
            let retValue = target.apply(self, arguments);
            let [code, statements] = processTemplate(tempString, self);
            if (statements)
                scope.statements.push(statements);
            self.resolve = function () {
                return code;
            };
            return retValue;
        };

        if (nodeKind) {
            if (typeof nodeKind === 'number')
                nodeKindTemplates[nodeKind] = <any>newConstructor;
            else
                for (let nk of nodeKind)
                    nodeKindTemplates[nk] = <any>newConstructor;
        }
        return newConstructor;
    };
}

/** Returns: [code, statements] */
function processTemplate(template: string, args: any): [string, string] {

    let statements = "";
    if (template.indexOf("{#statements}") > -1) {
        let statementsStartPos = template.indexOf("{#statements}");
        let statementsBodyStartPos = statementsStartPos + "{#statements}".length;
        let statementsBodyEndPos = template.indexOf("{/statements}");
        let statementsEndPos = statementsBodyEndPos + "{/statements}".length;
        while (statementsStartPos > 0 && (template[statementsStartPos - 1] == ' ' || template[statementsStartPos - 1] == '\n'))
            statementsStartPos--;
        if (statementsBodyEndPos > 0 && template[statementsBodyEndPos - 1] == '\n')
            statementsBodyEndPos--;
        let templateText = template.slice(statementsBodyStartPos, statementsBodyEndPos).replace(/\n    /g, '\n');
        let [c, s] = processTemplate(templateText, args);
        statements += s + c;
        template = template.slice(0, statementsStartPos) + template.slice(statementsEndPos);
    }

    if (typeof args === "string")
        return [template.replace("{this}", args), statements];

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
        if (endIfBodyPos > 0 && template[endIfBodyPos - 1] == '\n')
            endIfBodyPos--;

        let posAfterIf = endIfPos + 5;
        if (endIfPos > 0 && template[endIfPos - 1] == '\n')
            endIfPos--;

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
                let elementsResolved = '';
                for (let element of args[k]) {
                    let [resolvedElement, elementStatements] = processTemplate("{this}", element);
                    statements += elementStatements;
                    elementsResolved += resolvedElement;
                }

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
            let elementsResolved = "";

            for (let element of args[k]) {
                let [resolvedElement, elementStatements] = processTemplate(elementTemplate, element);
                statements += elementStatements;

                if (k == 'statements') {
                    resolvedElement = resolvedElement.replace(/[;\n*]+;/g, ';');
                    if (resolvedElement.search(/\n/) > -1) {
                        for (let line of resolvedElement.split('\n')) {
                            if (line != '') {
                                if (elementsResolved != "")
                                    elementsResolved += separator;
                                elementsResolved += line + '\n';
                            }
                        }
                    }
                    else {
                        if (elementsResolved != "")
                            elementsResolved += separator;
                        if (resolvedElement.search(/^[\n\s]*$/) == -1)
                            elementsResolved += resolvedElement + '\n';
                    }
                }
                else {
                    if (elementsResolved != "")
                        elementsResolved += separator;
                    elementsResolved += resolvedElement;
                } 

            }

            if (args[k].length == 0) {
                while (pos < template.length && template[pos] == ' ')
                    pos++;
                while (pos < template.length && template[pos] == '\n')
                    pos++;
                while (startPos > 0 && template[startPos - 1] == ' ')
                    startPos--;
                while (startPos > 0 && template[startPos - 1] == '\n')
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
    template = template.replace(/^[\n]*/, '').replace(/\n\s*\n[\n\s]*\n/g, '\n\n');
    return [template, statements];
}
