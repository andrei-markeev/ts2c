export interface RegexMachine {
    states: RegexState[];
    fixedStart: boolean;
    fixedEnd: boolean;
    final: number;
}

export interface RegexState {
    anyChar?: number;
    except?: { [ch: string]: boolean };
    chars: { [ch: string]: number };

    stm?: RegexMachine[];
    group?: number;
    next?: number;
}

export class RegexCompiler {

    private optimizeTokens(variants) {

        for (var tokens of variants) {
            for (var i = 0; i < tokens.length - 1; i++) {
                if (tokens[i].chars
                    && tokens[i + 1].chars
                    && tokens[i].chars.length == tokens[i + 1].chars.length
                    && tokens[i].chars.every(v => tokens[i + 1].chars.indexOf(v) != -1)
                    && tokens[i].wildCard
                    && !tokens[i + 1].wildCard) {
                    let t = tokens[i + 1];
                    tokens[i + 1] = tokens[i];
                    tokens[i] = t;
                }
            }
        }
        return variants;

    }

    private tokenize(template, nested) {

        template += ' '; // add dummy to the end so less checks in tokenize loop

        var i = 0;
        var variants = [];
        var tokens = [];
        var group = 0;
        variants.push(tokens);
        var getCharsMode = null;
        var getCharsToken = null;
        while (i < template.length - 1) {
            if (getCharsMode) {

                if (template[i] == '\\') {
                    i++;
                    if (template[i] == 'd')
                        getCharsToken[getCharsMode].push(0, 1, 2, 3, 4, 5, 6, 7, 8, 9);
                    else if (template[i] == 'n')
                        getCharsToken[getCharsMode].push('\n');
                    else if (template[i] == 's')
                        getCharsToken[getCharsMode].push('\t', ' ');
                    else
                        getCharsToken[getCharsMode].push(template[i]);
                } else if (template[i] == ']') {
                    getCharsMode = null;
                } else if (template[i + 1] == '-') {
                    let ch = template[i];
                    i++; i++;
                    while (ch.charCodeAt(0) <= template[i].charCodeAt(0)) {
                        getCharsToken[getCharsMode].push(ch);
                        ch = String.fromCharCode(ch.charCodeAt(0) + 1);
                    }
                } else
                    getCharsToken[getCharsMode].push(template[i]);

            } else if (template[i] == '\\') {
                i++;
                if (template[i] == 'd')
                    tokens.push({ chars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
                else if (template[i] == 'n')
                    tokens.push({ chars: ['\n'] });
                else if (template[i] == 's')
                    tokens.push({ chars: ['\t', ' '] });
                else
                    tokens.push({ chars: [template[i]] });
            } else if (template[i] == '*') {
                let lastToken = tokens[tokens.length - 1];
                lastToken.zeroOrMore = true;
                lastToken.wildCard = true;
            } else if (template[i] == '+') {
                let lastToken = tokens[tokens.length - 1];
                let newToken = {
                    zeroOrMore: true,
                    wildCard: true,
                    chars: lastToken.chars,
                    anyChar: lastToken.anyChar,
                    tokens: lastToken.tokens,
                    group: lastToken.group
                };
                tokens.push(newToken);
            } else if (template[i] == '?') {
                let lastToken = tokens[tokens.length - 1];
                lastToken.zeroOrOne = true;
                lastToken.wildCard = true;
            } else if (template[i] == '.') {
                tokens.push({ anyChar: true, except: [], wildCard: true });
            } else if (template[i] == '[' && template[i + 1] == '^') {
                i++;
                tokens.push({ anyChar: true, except: [] });
                getCharsMode = 'except';
                getCharsToken = tokens[tokens.length - 1];
            } else if (template[i] == '[') {
                tokens.push({ chars: [] });
                getCharsMode = 'chars';
                getCharsToken = tokens[tokens.length - 1];
            } else if (template[i] == '|') {
                tokens = [];
                group = 0;
                variants.push(tokens);
            } else if (template[i] == '(') {
                let [last_i, nested_variants] = this.tokenize(template.slice(i + 1), true);
                tokens.push({ tokens: nested_variants, group: group++ });
                i = i + 1 + last_i;
            } else if (nested && template[i] == ')') {
                return [i, this.optimizeTokens(variants)];
            } else
                tokens.push({ chars: [template[i]] });
            i++;
        }
        return this.optimizeTokens(variants);
    }

    private preprocessRegex(template) {
        var fixedStart = false;
        var fixedEnd = false;

        if (template[0] == '^') {
            fixedStart = true;
            template = template.slice(1);
        }
        if (template[template.length - 1] == '$') {
            fixedEnd = true;
            template = template.slice(0, -1);
        }

        var variants = this.tokenize(template, false);

        return [fixedStart, fixedEnd, variants];

    }

    private setupNextStep(stmNode: RegexState, token, nextPos) {
        if (!token)
            return;
        if (token.chars) {
            for (let ch of token.chars)
                stmNode.chars[ch] = nextPos;
        } else if (token.anyChar) {
            stmNode.anyChar = nextPos;
            stmNode.except = {};
            for (let ch of token.except)
                stmNode.except[ch] = true;
        } else if (token.tokens) {
            stmNode.stm = this.generateRegexMachines(true, false, token.tokens).variants;
            stmNode.group = token.group;
            stmNode.next = nextPos;
        }
    }

    private generateRegexMachines(fixedStart, fixedEnd, variants) {
        let stm_variants: RegexMachine[] = [];
        for (let tokens of variants) {

            var stm = <RegexMachine>{ 
                states: [],
                fixedStart: fixedStart, 
                fixedEnd: fixedEnd, 
                final: 0
            };
            for (var i = 0; i < tokens.length; i++) {
                stm.states.push({ chars: {} });
                if (tokens[i].zeroOrMore) {
                    this.setupNextStep(stm.states[i], tokens[i], i);
                    var n = i + 1;
                    // jump to one of next wildCards if match
                    while (tokens[n] && tokens[n].wildCard) {
                        this.setupNextStep(stm.states[i], tokens[n], tokens[n].zeroOrMore ? n : n + 1);
                        n++;
                    }
                    this.setupNextStep(stm.states[i], tokens[n], n + 1);
                } else if (tokens[i].zeroOrOne) {
                    this.setupNextStep(stm.states[i], tokens[i], i + 1);
                    var n = i + 1;
                    // jump to one of next wildCards if match
                    while (tokens[n] && tokens[n].wildCard) {
                        this.setupNextStep(stm.states[i], tokens[n], tokens[n].zeroOrMore ? n : n + 1);
                        n++;
                    }
                    this.setupNextStep(stm.states[i], tokens[n], n + 1);
                } else
                    this.setupNextStep(stm.states[i], tokens[i], i + 1);
            }

            stm.final = tokens.length;
            while (tokens[stm.final - 1] && tokens[stm.final - 1].wildCard)
                stm.final--;

            stm_variants.push(stm);

        }

        return { fixedStart: fixedStart, fixedEnd: fixedEnd, variants: stm_variants };

    }

    public compile(template)
    {
        var [fixedStart, fixedEnd, variants] = this.preprocessRegex(template);
        return this.generateRegexMachines(fixedStart, fixedEnd, variants);
    }

}
