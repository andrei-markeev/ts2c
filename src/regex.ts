export interface RegexMachine {
    states: RegexState[];
    final: number;
    fixedStart: boolean;
    fixedEnd: boolean;
}

export interface RegexState {
    anyChar?: number;
    except?: { [ch: string]: boolean };
    chars: { [ch: string]: number };
}

type RegexToken = string | ComplexRegexToken;
interface ComplexRegexToken {
    zeroOrMore?: boolean;
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
    dummy?: boolean;
}

const NOTHING = { nothing: true };

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
                if (typeof last === "string")
                    tokens.push({ zeroOrMore: true, tokens: [tokens.pop()] });
                else
                    last.zeroOrMore = true
            } else if (template[i] == '?')
                tokens.push({ anyOf: true, tokens: [NOTHING, tokens.pop()] });
            else if (template[i] == '+')
                if (typeof last === "string")
                    tokens.push({ zeroOrMore: true, tokens: [last] });
                else
                    tokens.push({ ...last, zeroOrMore: true });
            else if (template[i] == '|') {
                rootToken.tokens.push({ tokens: tokens });
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
            rootToken.tokens.push({ tokens: tokens });
        else
            rootToken.tokens = tokens;
        rootToken.template = template.slice(0, i);
        return group && rootToken.tokens.length == 0 ? null : rootToken;
    }
}

export class RegexBuilder {

    static convert(token: RegexToken, transitions: Transition[] = [], firstFromState = 0) {
        let finalState = transitions.map(t => t.toState).reduce((a, b) => Math.max(a, b), 0);
        let lastFromState = firstFromState;
        if (typeof token == "string" || token.anyCharExcept)
            transitions.push({ token: token, fromState: firstFromState, toState: ++finalState });
        else if (token.anyOf) {
            let lastTransitions: Transition[] = [];
            for (let tok of token.tokens.filter(t => t != NOTHING)) {
                let l = transitions.length;
                finalState = this.convert(tok, transitions, firstFromState).finalState;
                lastTransitions = lastTransitions.concat(transitions.slice(l).filter(t => t.toState == finalState));
            }
            // update toState of all variants to the finalState of last variant
            if (token.tokens.indexOf(NOTHING) > -1)
                transitions.filter(t => t.toState == firstFromState).forEach(tr => transitions.push({ ...tr, toState: finalState }));
            lastTransitions.filter(ls => ls).forEach(ls => ls.toState = finalState);
        } else {
            let nextStartFrom = firstFromState;
            for (let tok of token.tokens) {
                let result = this.convert(tok, transitions, nextStartFrom);
                finalState = result.finalState;
                if (typeof tok == "string" || !tok.zeroOrMore)
                    nextStartFrom = result.finalState;
            }
        }
        if (typeof token != "string" && token.zeroOrMore) {
            for (let tr of transitions.filter(t => t.toState == finalState))
                transitions.push({ ...tr, toState: firstFromState });
        }
        return { transitions, lastFromState, finalState };
    }

    static normalize(transitions: Transition[], finalState: number) {
        if (!transitions.length)
            return [];
        let states = [];
        Array.prototype["removeDuplicates"] = function () {
            return this.filter(function (item, pos, self) { return self.indexOf(item) == pos; });
        }

        if (transitions.map(t => t.toState).indexOf(finalState) == -1)
            transitions.push({ fromState: finalState, dummy: true });
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
        let { transitions, finalState } = this.convert(tokenTree);
        let states = this.normalize(transitions, finalState);
        return { states: states, final: states.length - 1, fixedStart: tokenTree.fixedStart, fixedEnd: tokenTree.fixedEnd };
    }

}
