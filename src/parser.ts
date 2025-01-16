import { parseModule } from "@andrei-markeev/kataw";

export function parse(fileName: string, sourceCode: string, options?: { useColors?: boolean }) {
    let fatalErrors = [];
    var rootNode = parseModule(sourceCode, { impliedStrict: true }, (_, kind, message, start, end) => {
        const formatted = getFormattedMessage(sourceCode, fileName, kind, message, start, end, options?.useColors);
        if (kind === 16) {
            console.error(formatted);
            fatalErrors.push(formatted);
        } else
            console.warn(formatted)
    });
    (rootNode as any).fileName = fileName;
    return { rootNode, fatalErrors };
}

function getFormattedMessage(sourceCode, fileName, kind, message, start, end, useColors) {
    const relativePos = getLinePos(sourceCode, start, end);
    let output = fileName + ":";
    output += getLineNumber(sourceCode, start).toString() + ":";
    output += relativePos.pos + ":";
    if (useColors)
        output += kind === 16 ? " \x1b[31merror:\x1b[0m" : " warning:";
    else
        output += kind === 16 ? " error:" : " warning:";

    output += " " + message;
    return output;
}

function getLinePos(src: string, pos: number, end: number): any {
    const lastLine = src.lastIndexOf('\n', pos) + 1; // cut off the \n
    return {
        pos: pos - lastLine,
        end: end - lastLine
    };
}

function getLineNumber(src: string, pos: number) {
    let lineCount = 1;
    let currentIdx = 0;
    while (true) {
        const next = src.indexOf('\n', currentIdx + 1);
        if (next === -1) {
            return lineCount + 1;
        }
        if (pos >= currentIdx && pos <= next) {
            return lineCount;
        }
        lineCount++;
        currentIdx = next;
    }
}
