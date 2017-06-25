export interface RegexMachine {
    states: RegexState[];
}

export interface RegexState {
    transitions: RegexStateTransition[];
    final: boolean;
}

export interface RegexStateTransition {
    condition: any;
    next: number;
    fixedStart: boolean;
    fixedEnd: boolean;
    startGroup: number[];
    endGroup: number[];
}

interface Transition {
    fromState: number;
    token?: RegexToken;
    toState?: number;
    startGroup?: number[];
    endGroup?: number[];
    fixedStart?: boolean;
    fixedEnd?: boolean;
    final?: boolean;
}

type RegexToken = string | ComplexRegexToken;
interface ComplexRegexToken {
    oneOrMore?: boolean;
    anyOf?: boolean;
    anyCharExcept?: boolean;
    nothing?: boolean;
    tokens?: RegexToken[];
    template?: string;
    startGroup?: number;
    endGroup?: number;
    fixedStart?: boolean;
    fixedEnd?: boolean;
}

const NOTHING = { nothing: true };
const FIXED_START = { fixedStart: true };
const FIXED_END = { fixedEnd: true };

Array.prototype["removeDuplicates"] = function () {
    return this.filter(function (item, pos, self) { return self.indexOf(item) == pos; });
}

function isStartGroup(t): t is ComplexRegexToken { return t && !!t.startGroup || false; }
function isEndGroup(t): t is ComplexRegexToken { return t && !!t.endGroup || false; }

class RegexParser {

    static parseEscaped(c) {
        if (c == 'd')
            return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        else if (c == 'w')
            return [
                'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
                'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'W', 'Z',
                'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
                'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'w', 'z',
                '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '_'
            ];
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

    static parse(template, isGroup = false, group = 0) {
        let rootToken: RegexToken = { tokens: [] };
        let tokens: RegexToken[] = [];
        let lastToken = () => tokens.slice(-1)[0];
        let tok: RegexToken = null;
        let i = 0;
        while (i < template.length) {
            let last = lastToken();
            if (template[i] == '^' && tokens.length == 0)
                tokens.push(FIXED_START);
            else if (template[i] == '$' && i == template.length - 1 || template.slice(i, i + 2) == '$)' || template.slice(i, i + 2) == '$|')
                tokens.push(FIXED_END);
            else if (template[i] == '\\')
                i++ , tokens.push({ anyOf: true, tokens: this.parseEscaped(template[i]) });
            else if (template[i] == '.')
                tokens.push({ anyCharExcept: true, tokens: [] });
            else if (template[i] == '*') {
                tokens.pop();
                if (typeof last === "string")
                    tokens.push({ anyOf: true, tokens: [NOTHING, { tokens: [last], oneOrMore: true }] });
                else
                    tokens.push({ anyOf: true, tokens: [NOTHING, { ...last, oneOrMore: true }] });
            }
            else if (template[i] == '?')
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
                i += 3, ({ group, tokenTree: tok } = this.parse(template.slice(i), true, group)) && tok && tokens.push(tok) && (i += tok.template.length);
            else if (template[i] == '(') {
                let nextGroup;
                i++ , group++;
                ({ group: nextGroup, tokenTree: tok } = this.parse(template.slice(i), true, group));
                tok && tokens.push({ tokens: [{ startGroup: group }, tok, { endGroup: group }] }) && (i += tok.template.length);
                group = nextGroup;
            } else if (template[i] == ')' && isGroup)
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
        return {group: group, tokenTree: isGroup && rootToken.tokens.length == 0 ? null : rootToken};
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
            if (token.tokens.indexOf(NOTHING) > -1)
                nextFromState = [firstFromState];
            else
                nextFromState = [];
            for (let tok of token.tokens.filter(t => t != NOTHING && t != FIXED_START && t != FIXED_END && !isStartGroup(t) && !isEndGroup(t))) {
                let l = transitions.length;
                let result = this.convert(tok, transitions, firstFromState, finalState);
                finalState = result.finalState;
                if (result.nextFromState.length > 1)
                    nextFromState = nextFromState.concat(result.nextFromState.filter(n => n != finalState));
                lastTransitions = lastTransitions.concat(transitions.slice(l).filter(t => t.toState == finalState));
            }
            nextFromState = (<any>nextFromState.concat(finalState)).removeDuplicates();
            lastTransitions.forEach(ls => ls.toState = finalState);
        } else {
            for (let tok of token.tokens.filter(t => t != FIXED_START && t != FIXED_END && !isStartGroup(t) && !isEndGroup(t))) {
                let results = [];
                let lastTransitions: Transition[] = [];
                for (let fromState of nextFromState) {
                    let l = transitions.length;
                    let result = this.convert(tok, transitions, fromState, finalState);
                    lastTransitions = lastTransitions.concat(transitions.slice(l).filter(t => t.toState == result.finalState));
                    results.push(result);
                }
                nextFromState = [].concat.apply([], results.map(r => r.nextFromState)).removeDuplicates();
                finalState = results.map(r => r.finalState).reduce((a, b) => Math.max(a, b), 0);
            }
        }
        if (typeof token != "string" && token.oneOrMore) {
            for (let tr of transitions.filter(t => t.toState == finalState))
                transitions.push({ ...tr, toState: firstFromState });
        }
        if (typeof token != "string" && token.tokens[0] == FIXED_START) {
            transitions.filter(t => t.fromState == firstFromState).forEach(t => t.fixedStart = true)
        }
        if (typeof token != "string" && token.tokens[token.tokens.length - 1] == FIXED_END) {
            transitions.filter(t => t.toState == finalState).forEach(t => t.fixedEnd = true)
        }
        let groupTok;
        if (typeof token != "string" && isStartGroup(groupTok = token.tokens[0])) {
            transitions.filter(t => t.fromState == firstFromState).forEach(t => { 
                t.startGroup = t.startGroup || [];
                if (t.startGroup.indexOf(groupTok.startGroup) == -1) 
                    t.startGroup.push(groupTok.startGroup); 
            });
        }
        if (typeof token != "string" && isEndGroup(groupTok = token.tokens[token.tokens.length - 1])) {
            transitions.filter(t => t.toState == finalState).forEach(t => { 
                t.endGroup = t.endGroup || []; 
                if (t.endGroup.indexOf(groupTok.endGroup) == -1) 
                    t.endGroup.push(groupTok.endGroup); 
            });
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

        // split anyChar transitions
        var addedTransitions = [];
        var charTransitions = transitions.filter(t => typeof t.token == "string");
        var anyCharTransitions = transitions.filter(t => typeof t.token != "string" && t.token != null);
        for (let anyCharT of anyCharTransitions) {
            for (let charT of charTransitions) {
                let anyCharT_token = <ComplexRegexToken>anyCharT.token;
                if (charT.fromState == anyCharT.fromState && anyCharT.toState != charT.toState && anyCharT_token.tokens.indexOf(charT.token) == -1) {
                    if (transitions.filter(t => t.fromState == anyCharT.fromState && t.toState == anyCharT.toState && t.token == charT.token).length == 0)
                        addedTransitions.push({ fromState: anyCharT.fromState, toState: anyCharT.toState, token: charT.token, startGroup: anyCharT.startGroup, endGroup: anyCharT.endGroup });
                }
            }
        }
        transitions = transitions.concat(addedTransitions);

        let stateIndices = {};
        let processed = {};
        let ensureId = tt => {
            let id = tt.map(t => t.fromState).removeDuplicates().sort().join(",");
            if (stateIndices[id] == null) {
                stateIndices[id] = Object.keys(stateIndices).length;
            }
            return stateIndices[id];
        };
        let queue = [transitions.filter(t => t.fromState == 0)];
        while (queue.length) {
            let trgroup = queue.pop();
            let id = ensureId(trgroup);

            if (processed[id])
                continue;
            states.push({ transitions: [] });
            if (trgroup.filter(t => t.final).length > 0)
                states[states.length - 1].final = true;

            processed[id] = true;

            let processedTr = [];
            for (let tr of trgroup.filter(t => !!t.token)) {
                let group = trgroup.filter(t => JSON.stringify(tr.token) === JSON.stringify(t.token) && processedTr.indexOf(t) == -1);
                if (!group.length)
                    continue;
                group.forEach(g => processedTr.push(g));
                let reachableStates = group.map(g => g.toState);
                let closure = transitions.filter(t => reachableStates.indexOf(t.fromState) > -1);
                let closureId = ensureId(closure);
                let sameTokenTransactions = trgroup.filter(t => JSON.stringify(tr.token) === JSON.stringify(t.token));
                let startGr = sameTokenTransactions.map(t => t.startGroup).reduce((a,c) => c == null ? a : a.concat(c),[]).reduce((a,c) => { a.indexOf(c) == -1 && a.push(c); return a; }, []);
                let endGr = sameTokenTransactions.map(t => t.endGroup).reduce((a,c) => c == null ? a : a.concat(c),[]).reduce((a,c) => { a.indexOf(c) == -1 && a.push(c); return a; }, []);
                states[id].transitions.push({ condition: tr.token, next: closureId, fixedStart: tr.fixedStart, fixedEnd: tr.fixedEnd, startGroup: startGr, endGroup: endGr });
                //console.log("FROM: ", id, "----", tr.fixedStart ? "(start of line)" : "", tr.token, tr.fixedEnd ? "(end of line)" : "", "---> ", closureId);
                queue.unshift(closure);
            }

        }
        for (let state of states) {
            let charTransitions = state.transitions.filter(t => typeof t.condition == "string").sort((a, b) => a.condition > b.condition ? 1 : -1);
            if (charTransitions.length > 1) {
                let classTransitions = [];
                let condition = { fromChar: charTransitions[0].condition, toChar: charTransitions[0].condition };
                for (let i = 1; i <= charTransitions.length; i++) {
                    if (i < charTransitions.length
                        && charTransitions[i].condition.charCodeAt(0) == charTransitions[i - 1].condition.charCodeAt(0) + 1
                        && charTransitions[i].next == charTransitions[i - 1].next
                        && charTransitions[i].fixedStart == charTransitions[i - 1].fixedStart
                        && charTransitions[i].fixedEnd == charTransitions[i - 1].fixedEnd
                        && charTransitions[i].final == charTransitions[i - 1].final
                        && JSON.stringify(charTransitions[i].startGroup) == JSON.stringify(charTransitions[i - 1].startGroup)
                        && JSON.stringify(charTransitions[i].endGroup) == JSON.stringify(charTransitions[i - 1].endGroup)) {
                        condition.toChar = charTransitions[i].condition;
                    } else {
                        if (condition.fromChar == condition.toChar) {
                            classTransitions.push(charTransitions[i - 1]);
                        } else {
                            classTransitions.push({ ...charTransitions[i - 1], condition });
                        }
                        if (i < charTransitions.length)
                            condition = { fromChar: charTransitions[i].condition, toChar: charTransitions[i].condition };
                    }
                }
                state.transitions = classTransitions.concat(state.transitions.filter(t => typeof t.condition != "string"));
            }
        }
        return states;
    }

    static build(template): RegexMachine {
        let { tokenTree } = RegexParser.parse(template);
        let { transitions, nextFromState } = this.convert(tokenTree);
        let states = this.normalize(transitions, nextFromState);
        return { states: states };
    }

}
