import {IScope} from '../program';
import {CodeTemplate} from '../template';
import {CString} from './literals';
import {RegexBuilder, RegexMachine, RegexState} from '../regex';
import {CExpression} from './expressions';

@CodeTemplate(`
struct regex_match_struct_t {regexName}_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0;
    struct regex_match_struct_t result;
{#if hasChars}
        char ch;
{/if}
{#if groupNumber}
        if (capture) {
            result.matches = malloc({groupNumber} * sizeof(*result.matches));
            assert(result.matches != NULL);
            regex_clear_matches(&result, {groupNumber});
        }
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
{#if groupNumber}
                if (capture)
                    regex_clear_matches(&result, {groupNumber});
{/if}
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && {finals { && }=> state != {this}}) {
            iterator = index;
            index++;
            state = 0;
{#if groupNumber}
                if (capture)
                    regex_clear_matches(&result, {groupNumber});
{/if}
        }
    }
    if ({finals { && }=> state != {this}})
        index = -1;
    result.index = index;
    result.end = iterator;
    result.matches_count = {groupNumber};
    return result;
}
struct regex_struct_t {regexName} = { {templateString}, {regexName}_search };
`)
export class CRegexSearchFunction {
    public hasChars: boolean;
    public finals: string[];
    public templateString: CString;
    public stateBlocks: CStateBlock[] = [];
    public groupNumber: number = 0;
    public gcVarName: string;
    constructor(scope: IScope, template: string, public regexName: string, regexMachine: RegexMachine = null) {
        this.templateString = new CString(scope, template.replace(/\\/g,'\\\\').replace(/"/g, '\\"'));
        if (/\/[a-z]+$/.test(template))
            throw new Error("Flags not supported in regex literals yet (" + template + ").");
        regexMachine = regexMachine || RegexBuilder.build(template.slice(1, -1));
        let max = (arr, func) => arr && arr.reduce((acc, t) => Math.max(acc, func(t), 0), 0) || 0;
        this.groupNumber = max(regexMachine.states, s => max(s.transitions, t => max(t.startGroup, g => g)));
        this.hasChars = regexMachine.states.filter(s => s && s.transitions.filter(c => typeof c.condition == "string" || c.condition.fromChar || c.condition.tokens.length > 0)).length > 0;
        for (let s = 0; s < regexMachine.states.length; s++) {
            if (regexMachine.states[s] == null || regexMachine.states[s].transitions.length == 0 || regexMachine.states[s].final)
                continue;
            this.stateBlocks.push(new CStateBlock(scope, s+"", regexMachine.states[s]));
        }
        this.finals = regexMachine.states.length > 0 ? regexMachine.states.map((s, i) => s.final ? i : -1).filter(f => f > -1).map(f => f+"") : ["-1"];
        if (this.groupNumber > 0)
            scope.root.headerFlags.malloc = true;
        scope.root.headerFlags.strings = true;
        scope.root.headerFlags.bool = true;
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
            this.conditions.push(new CharCondition(tr.condition, tr.next, tr.fixedStart, tr.fixedEnd, tr.startGroup, tr.endGroup));
        }
    }
}

@CodeTemplate(`
{#if anyCharExcept}
                if (next == -1 && {except { && }=> ch != '{this}'}{fixedConditions}) {nextCode}
{#elseif anyChar}
                if (next == -1{fixedConditions}) {nextCode}
{#elseif charClass}
                if (ch >= '{chFrom}' && ch <= '{ch}'{fixedConditions}) {nextCode}
{#else}
                if (ch == '{ch}'{fixedConditions}) {nextCode}
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
    public nextCode;
    constructor(condition: any, public next: number, fixedStart: boolean, fixedEnd: boolean, startGroup: number[], endGroup: number[]) {
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

        let groupCaptureCode = '';
        for (var g of startGroup || [])
            groupCaptureCode += " if (capture && (result.matches[" + (g-1) + "].index == -1 || iterator > result.matches[" + (g-1) + "].end)) result.matches[" + (g-1) + "].index = iterator;";
        for (var g of endGroup || [])
            groupCaptureCode += " if (capture && result.matches[" + (g-1) + "].index != -1) result.matches[" + (g-1) + "].end = iterator + 1;";

        this.nextCode = "next = " + next + ";";
        if (groupCaptureCode)
            this.nextCode = "{ " + this.nextCode + groupCaptureCode + " }";
    }
}

@CodeTemplate(`{expression}.str`)
export class CRegexAsString {
    constructor (public expression: CExpression) { }
}
