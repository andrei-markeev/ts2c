import {IScope} from '../program';
import {CodeTemplate} from '../template';
import {CString} from './literals';
import {RegexBuilder, RegexMachine, RegexState} from '../regex';
import {CExpression} from './expressions';

@CodeTemplate(`
int16_t {regexName}_search(const char *str) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0;
{#if hasChars}
        char ch;
{/if}
    for (iterator = 0; iterator < len; iterator++) {
{#if hasChars}
            ch = str[iterator];
{/if}

        {stateTransitionBlocks {        }=> {this}}

        if (next == -1) {
            {continueBlock}
        } else {
            state = next;
            next = -1;
        }
    }
{#if fixedEnd}
        if (({finals { && }=> state != {this}}) || iterator != len)
            index = -1;
{#else}
        if ({finals { && }=> state != {this}})
            index = -1;
{/if}
    return index;
}
struct regex_struct_t {regexName} = { {templateString}, {regexName}_search };
`)
export class CRegexSearchFunction {
    public hasChars: boolean;
    public finals: string[];
    public fixedEnd: boolean;
    public continueBlock: ContinueBlock;
    public templateString: CString;
    public stateTransitionBlocks: CStateTransitionsBlock[] = [];
    constructor(scope: IScope, template: string, public regexName: string, regexMachine: RegexMachine = null) {
        this.templateString = new CString(scope, template.replace(/\\/g,'\\\\'));
        regexMachine = regexMachine || RegexBuilder.build(template.slice(1, -1));
        this.hasChars = regexMachine.states.filter(s => s && (Object.keys(s.chars).length > 0 || s.except && Object.keys(s.except).length > 0)).length > 0;
        for (let s = 0; s < regexMachine.states.length - 1; s++) {
            if (regexMachine.states[s] == null)
                continue;
            this.stateTransitionBlocks.push(new CStateTransitionsBlock(
                scope,
                s+"",
                regexMachine.states[s]
            ));
        }
        this.finals = regexMachine.states.length > 0 ? regexMachine.states.map((s, i) => s.final ? i : -1).filter(f => f > -1).map(f => f+"") : ["-1"];
        this.fixedEnd = regexMachine.fixedEnd;
        this.continueBlock = new ContinueBlock(scope, 
            regexMachine.fixedStart,
            this.fixedEnd,
            this.finals
        );
        scope.root.headerFlags.strings = true;
    }

}

@CodeTemplate(`if (state == {stateNumber}) {
            {charConditions {\n            }=> if (ch == '{ch}') next = {next};}
{#if anyChar && exceptConditions.length}
                if ({exceptConditions { && }=> (ch != '{ch}')} && next == -1)
                    next = {next};
{#elseif anyChar}
                if (next == -1) next = {next};
{/if}
        }
`)
class CStateTransitionsBlock {
    public charConditions: CharCondition[] = [];
    public exceptConditions: CharCondition[] = [];
    public anyChar: boolean = false;
    public next: string;
    constructor(scope: IScope, public stateNumber: string, state: RegexState) {
        for (let ch in state.chars)
            this.charConditions.push(new CharCondition(ch.replace('\\','\\\\'), state.chars[ch]));
        for (let ch in state.except)
            this.exceptConditions.push(new CharCondition(ch.replace('\\','\\\\'), -1));
        if (state.anyChar != null) {
            this.anyChar = true;
            this.next = state.anyChar+"";
        }
    }
}

@CodeTemplate(`
{#if !fixedStart && !fixedEnd}
    if ({finals { || }=> state == {this}})
        break;
    iterator = index;
    index++;
    state = 0;
{#elseif !fixedStart && fixedEnd}
    iterator = index;
    index++;
    state = 0;
{#else}
    break;
{/if}`)
class ContinueBlock {
    constructor(scope: IScope, 
        public fixedStart: boolean, 
        public fixedEnd: boolean, 
        public finals: string[]) { }
}

class CharCondition {
    constructor(public ch: string, public next: number) {}
}

@CodeTemplate(`{expression}.str`)
export class CRegexAsString {
    constructor (public expression: CExpression) { }
}
