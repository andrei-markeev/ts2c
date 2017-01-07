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

{stateBlocks}

        if (next == -1) {
            if ({finals { || }=> state == {this}})
                break;
            iterator = index;
            index++;
            state = 0;
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && {finals { && }=> state != {this}}) {
            iterator = index;
            index++;
            state = 0;
        }
    }
    if ({finals { && }=> state != {this}})
        index = -1;
    return index;
}
struct regex_struct_t {regexName} = { {templateString}, {regexName}_search };
`)
export class CRegexSearchFunction {
    public hasChars: boolean;
    public finals: string[];
    public templateString: CString;
    public stateBlocks: CStateBlock[] = [];
    constructor(scope: IScope, template: string, public regexName: string, regexMachine: RegexMachine = null) {
        this.templateString = new CString(scope, template.replace(/\\/g,'\\\\').replace(/"/g, '\\"'));
        regexMachine = regexMachine || RegexBuilder.build(template.slice(1, -1));
        this.hasChars = regexMachine.states.filter(s => s && s.transitions.filter(c => typeof c.condition == "string" || c.condition.fromChar || c.condition.tokens.length > 0)).length > 0;
        for (let s = 0; s < regexMachine.states.length - 1; s++) {
            if (regexMachine.states[s] == null)
                continue;
            this.stateBlocks.push(new CStateBlock(scope, s+"", regexMachine.states[s]));
        }
        this.finals = regexMachine.states.length > 0 ? regexMachine.states.map((s, i) => s.final ? i : -1).filter(f => f > -1).map(f => f+"") : ["-1"];
        scope.root.headerFlags.strings = true;
    }

}

@CodeTemplate(`
        if (state == {stateNumber}) {
{conditions}
        }
`)
class CStateBlock {
    public conditions: any[] = [];
    constructor(scope: IScope, public stateNumber: string, state: RegexState) {
        for (let tr of state.transitions) {
            this.conditions.push(new CharCondition(tr.condition, tr.next, tr.fixedStart, tr.fixedEnd));
        }
    }
}

@CodeTemplate(`
{#if anyCharExcept}
                if (next == -1 && {except { && }=> ch != '{this}'}{fixedConditions}) next = {next};
{#elseif anyChar}
                if (next == -1{fixedConditions}) next = {next};
{#elseif charClass}
                if (ch >= '{chFrom}' && ch <= '{ch}'{fixedConditions}) next = {next};
{#else}
                if (ch == '{ch}'{fixedConditions}) next = {next};
{/if}
`)
class CharCondition {
    public anyCharExcept: boolean = false;
    public anyChar: boolean = false;
    public charClass: boolean = false;
    public chFrom: string;
    public ch: string;
    public except: string[];
    public fixedConditions: string = '';
    constructor(condition: any, public next: number, fixedStart: boolean, fixedEnd: boolean) {
        if (fixedStart)
            this.fixedConditions = " && iterator == 0";
        else if (fixedEnd)
            this.fixedConditions = " && iterator == len - 1";
        
        if (typeof condition === "string")
            this.ch = condition.replace('\\','\\\\').replace("'","\\'");
        else if (condition.fromChar) {
            this.charClass = true;
            this.chFrom = condition.fromChar;
            this.ch = condition.toChar;
        }
        else if (condition.tokens.length) {
            this.anyCharExcept = true;
            this.except = condition.tokens.map(ch => ch.replace('\\','\\\\').replace("'","\\'"));
        } else
            this.anyChar = true;
    }
}

@CodeTemplate(`{expression}.str`)
export class CRegexAsString {
    constructor (public expression: CExpression) { }
}
