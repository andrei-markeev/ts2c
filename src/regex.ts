export interface RegexMachine {
    states: RegexState[];
    fixedStart: boolean;
    fixedEnd: boolean;
}

export interface RegexState {
    anyChar?: number;
    except?: { [ch: string]: boolean };
    chars: { [ch: string]: number };
    final: boolean;
}

type RegexToken = string | ComplexRegexToken;
interface ComplexRegexToken {
    oneOrMore?: boolean;
    anyOf?: boolean;
    anyCharExcept?: boolean;
    nothing?: boolean;
    tokens?: RegexToken[];
    template?: string;
    fixedStart?: boolean;
    fixedEnd?: boolean;
}

interface Transition {
    fromState: number;
    token?: RegexToken;
    toState?: number;
    final?: boolean;
}

const NOTHING = { nothing: true };

Array.prototype["removeDuplicates"] = function () {
    return this.filter(function (item, pos, self) { return self.indexOf(item) == pos; });
}

class RegexParser {

    static parseEscaped(c) {
        if (c == 'd')
            return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        else if (c == 'n')
            return ['\n'];
        else if (c == 's')
            return ['\t', ' '];
        else
            return [c];
    }

    static parseChars(template, i, mode) {
        let token = { tokens: [] };
        token[mode] = true;
        while (template[i] != ']') {
            if (template[i] == '\\')
                i++ && (token.tokens = token.tokens.concat(this.parseEscaped(template[i])));
            else if (template[i + 1] == '-' && template[i + 2] != ']') {
                let ch = template[i];
                i++; i++;
                while (ch.charCodeAt(0) <= template[i].charCodeAt(0)) {
                    token.tokens.push(ch);
                    ch = String.fromCharCode(ch.charCodeAt(0) + 1);
                }
            } else
                token.tokens.push(template[i]);
            i++;
        }
        return [token.tokens.length ? token : null, i];
    }

    static parse(template, group = false): ComplexRegexToken {
        let fixedStart = template[0] == '^' && !!(template = template.slice(1));
        let fixedEnd = template[template.length - 1] == '$' && (template = template.slice(0, -1));
        let rootToken: RegexToken = { tokens: [], fixedStart, fixedEnd };
        let tokens: RegexToken[] = [];
        let lastToken = () => tokens.slice(-1)[0];
        let tok: RegexToken = null;
        let i = 0;
        while (i < template.length) {
            let last = lastToken();
            if (template[i] == '\\')
                i++ , tokens.push({ anyOf: true, tokens: this.parseEscaped(template[i]) });
            else if (template[i] == '.')
                tokens.push({ anyCharExcept: true, tokens: [] });
            else if (template[i] == '*') {
                tokens.pop();
                if (typeof last === "string")
                    tokens.push({ anyOf: true, tokens: [NOTHING, { tokens: [last], oneOrMore: true }] });
                else
                    tokens.push({ anyOf: true, tokens: [NOTHING, { ...last, oneOrMore: true }] });
            } else if (template[i] == '?')
                tokens.push({ anyOf: true, tokens: [NOTHING, tokens.pop()] });
            else if (template[i] == '+')
                if (typeof last === "string")
                    tokens.push({ oneOrMore: true, tokens: [tokens.pop()] });
                else
                    last.oneOrMore = true
            else if (template[i] == '|') {
                rootToken.tokens.push(tokens.length ? { tokens: tokens } : NOTHING);
                rootToken.anyOf = true;
                tokens = [];
            } else if (template.slice(i, i + 3) == '(?:')
                i += 3, (tok = this.parse(template.slice(i), true)) && tok && tokens.push(tok);
            else if (template[i] == '(')
                i++ , (tok = this.parse(template.slice(i), true)) && tok && tokens.push(tok) && (i += tok.template.length);
            else if (template[i] == ')' && group)
                break;
            else if (template.slice(i, i + 2) == '[^')
                i += 2, ([tok, i] = this.parseChars(template, i, 'anyCharExcept')) && tok && tokens.push(tok);
            else if (template[i] == '[')
                i++ , ([tok, i] = this.parseChars(template, i, 'anyOf')) && tok && tokens.push(tok);
            else
                tokens.push(template[i]);

            i++;
        }
        if (rootToken.anyOf)
            rootToken.tokens.push(tokens.length ? { tokens: tokens } : NOTHING);
        else
            rootToken.tokens = tokens;
        rootToken.template = template.slice(0, i);
        return group && rootToken.tokens.length == 0 ? null : rootToken;
    }
}

export class RegexBuilder {

    static convert(token: RegexToken, transitions: Transition[] = [], firstFromState = 0, finalState = 0) {
        let nextFromState = [firstFromState];
        if (typeof token == "string" || token.anyCharExcept) {
            transitions.push({ token: token, fromState: firstFromState, toState: ++finalState });
            nextFromState = [finalState];
        } else if (token.anyOf) {
            let lastTransitions: Transition[] = [];
            for (let tok of token.tokens.filter(t => t != NOTHING)) {
                let l = transitions.length;
                let result = this.convert(tok, transitions, firstFromState, finalState);
                finalState = result.finalState;
                lastTransitions = lastTransitions.concat(transitions.slice(l).filter(t => t.toState == finalState));
            }
            if (token.tokens.indexOf(NOTHING) > -1)
                nextFromState = [firstFromState, finalState];
            else
                nextFromState = [finalState];
            lastTransitions.forEach(ls => ls.toState = finalState);
        } else {
            for (let tok of token.tokens) {
                let results = [];
                let lastTransitions: Transition[] = [];
                for (let fromState of nextFromState) {
                    let l = transitions.length;
                    let result = this.convert(tok, transitions, fromState, finalState);
                    lastTransitions = lastTransitions.concat(transitions.slice(l).filter(t => t.toState == result.finalState));
                    results.push(result);
                }
                nextFromState = [].concat.apply([], results.map(r => r.nextFromState)).removeDuplicates();
                finalState = results.map(r => r.finalState).reduce((a,b) => Math.max(a, b), 0);
            }
        }
        if (typeof token != "string" && token.oneOrMore) {
            for (let tr of transitions.filter(t => t.toState == finalState))
                transitions.push({ ...tr, toState: firstFromState });
        }
        return { transitions, nextFromState, finalState };
    }

    static normalize(transitions: Transition[], finalStates: number[]) {
        if (!transitions.length)
            return [];
        let states = [];

        for (let finalState of finalStates) {
            if (transitions.map(t => t.fromState).indexOf(finalState) == -1) {
                transitions.push({ fromState: finalState, final: true })
            } else
                transitions.filter(t => t.fromState == finalState).forEach(t => t.final = true);
        }

        let stateIndices = {};
        let queue = [transitions.filter(t => t.fromState == 0)];
        let processed = {};
        let tokenMoreOrEqual = (token: RegexToken, other: RegexToken) => {
            return JSON.stringify(token) === JSON.stringify(other);
        };
        let ensureId = tt => {
            let id = tt.map(t => t.fromState).removeDuplicates().sort().join(",");
            if (stateIndices[id] == null) {
                stateIndices[id] = Object.keys(stateIndices).length;
            }
            return stateIndices[id];
        };
        while (queue.length) {
            let trgroup = queue.pop();
            let id = ensureId(trgroup);

            if (processed[id])
                continue;
            states.push({ chars: {} });
            if (trgroup.filter(t => t.final).length > 0)
                states[states.length - 1].final = true;

            processed[id] = true;

            let processedTr = [];
            for (let tr of trgroup.filter(t => !!t.token)) {
                let group = trgroup.filter(t => tokenMoreOrEqual(tr.token, t.token) && processedTr.indexOf(t) == -1);
                if (!group.length)
                    continue;
                group.forEach(g => processedTr.push(g));
                let reachableStates = group.map(g => g.toState);
                let closure = transitions.filter(t => reachableStates.indexOf(t.fromState) > -1);
                let closureId = ensureId(closure);
                if (typeof tr.token == "string")
                    states[id].chars[tr.token] = closureId;
                else {
                    states[id].anyChar = closureId;
                    states[id].except = {};
                    for (let ch of (<string[]>tr.token.tokens))
                        states[id].except[ch] = true;
                }
                console.log("FROM: ", id, "----", tr.token, "---> ", closureId);
                queue.unshift(closure);
            }

        }
        return states;
    }

    static build(template): RegexMachine {
        let tokenTree = RegexParser.parse(template);
        let { transitions, nextFromState } = this.convert(tokenTree);
        let states = this.normalize(transitions, nextFromState);
        return { states: states, fixedStart: tokenTree.fixedStart, fixedEnd: tokenTree.fixedEnd };
    }

}
