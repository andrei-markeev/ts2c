import {IScope} from '../program';
import {CodeTemplate, CTemplateBase} from '../template';
import {CString} from './literals';
import {RegexBuilder, RegexMachine, RegexState, RegexStateTransition, isRangeCondition} from '../regex';
import {CExpression} from './expressions';

@CodeTemplate(`
struct regex_match_struct_t {regexName}_search(const char *str, int16_t capture) {
    int16_t state = 0, next = -1, iterator, len = strlen(str), index = 0, end = -1;
    struct regex_match_struct_t result;
{#if hasChars}
        char ch;
{/if}
{#if groupNumber}
        int16_t started[{groupNumber}];
        if (capture) {
            result.matches = malloc({groupNumber} * sizeof(*result.matches));
            assert(result.matches != NULL);
            regex_clear_matches(&result, {groupNumber});
            memset(started, 0, sizeof started);
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
            end = -1;
{#if groupNumber}
                if (capture) {
                    regex_clear_matches(&result, {groupNumber});
                    memset(started, 0, sizeof started);
                }
{/if}
        } else {
            state = next;
            next = -1;
        }

        if (iterator == len-1 && index < len-1 && {finals { && }=> state != {this}}) {
            if (end > -1)
                break;
            iterator = index;
            index++;
            state = 0;
{#if groupNumber}
                if (capture) {
                    regex_clear_matches(&result, {groupNumber});
                    memset(started, 0, sizeof started);
                }
{/if}
        }
    }
    if (end == -1 && {finals { && }=> state != {this}})
        index = -1;
    result.index = index;
    result.end = end == -1 ? iterator : end;
    result.matches_count = {groupNumber};
    return result;
}
struct regex_struct_t {regexName} = { {templateString}, {regexName}_search };
`)
export class CRegexSearchFunction extends CTemplateBase {
    public hasChars: boolean;
    public finals: string[];
    public templateString: CString;
    public stateBlocks: CStateBlock[] = [];
    public groupNumber: number = 0;
    public gcVarName: string;
    constructor(scope: IScope, template: string, public regexName: string, regexMachine: RegexMachine = null) {
        super();
        this.templateString = new CString(scope, template.replace(/\\/g,'\\\\').replace(/"/g, '\\"'));
        if (/\/[a-z]+$/.test(template))
            throw new Error("Flags not supported in regex literals yet (" + template + ").");
        regexMachine = regexMachine || RegexBuilder.build(template.slice(1, -1));
        let max = (arr, func) => arr && arr.reduce((acc, t) => Math.max(acc, func(t), 0), 0) || 0;
        this.groupNumber = max(regexMachine.states, s => max(s.transitions, t => max(t.startGroup, g => g)));
        this.hasChars = regexMachine.states.filter(s => s && s.transitions.filter(c => typeof c.condition == "string" || isRangeCondition(c.condition) || c.condition.tokens.length > 0)).length > 0;
        for (let s = 0; s < regexMachine.states.length; s++) {
            if (regexMachine.states[s] == null || regexMachine.states[s].transitions.length == 0)
                continue;
            this.stateBlocks.push(new CStateBlock(scope, s+"", regexMachine.states[s], this.groupNumber));
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
{#if final}
                end = iterator;
{/if}
{conditions {\n}=> {this}}
{#if groupNumber && groupsToReset.length}
                if (capture && next == -1) {
                    {groupsToReset {\n                    }=> started[{this}] = 0;}
                }
{/if}
        }
`)
class CStateBlock extends CTemplateBase {
    public conditions: CharCondition[] = [];
    public groupsToReset: string[] = [];
    public final: boolean;
    constructor(scope: IScope, public stateNumber: string, state: RegexState, public groupNumber: number) {
        super();
        this.final = state.final;
        let allGroups = [];
        state.transitions.forEach(t => allGroups = allGroups.concat(t.startGroup || []).concat(t.endGroup || []));
        for (var i = 0; i < groupNumber; i++)
            if (allGroups.indexOf(i+1) == -1)
                this.groupsToReset.push(i+"");
        for (let tr of state.transitions) {
            this.conditions.push(new CharCondition(tr, groupNumber));
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
{/if}`)
class CharCondition extends CTemplateBase {
    public anyCharExcept: boolean = false;
    public anyChar: boolean = false;
    public charClass: boolean = false;
    public chFrom: string;
    public ch: string;
    public except: string[];
    public fixedConditions: string = '';
    public nextCode;
    constructor(tr: RegexStateTransition, groupN: number) {
        super();
        if (tr.fixedStart)
            this.fixedConditions = " && iterator == 0";
        else if (tr.fixedEnd)
            this.fixedConditions = " && iterator == len - 1";
        
        if (typeof tr.condition === "string")
            this.ch = tr.condition.replace('\\','\\\\').replace("'","\\'");
        else if (isRangeCondition(tr.condition)) {
            this.charClass = true;
            this.chFrom = tr.condition.fromChar;
            this.ch = tr.condition.toChar;
        }
        else if (tr.condition.tokens.length) {
            this.anyCharExcept = true;
            this.except = tr.condition.tokens.map(ch => (<string>ch).replace('\\','\\\\').replace("'","\\'"));
        } else
            this.anyChar = true;

        let groupCaptureCode = '';
        for (var g of tr.startGroup || [])
            groupCaptureCode += " if (capture && (!started[" + (g-1) + "] || iterator > result.matches[" + (g-1) + "].end)) { started[" + (g-1) + "] = 1; result.matches[" + (g-1) + "].index = iterator; }";
        for (var g of tr.endGroup || [])
            groupCaptureCode += " if (capture && started[" + (g-1) + "]) result.matches[" + (g-1) + "].end = iterator + 1;";

        this.nextCode = "next = " + tr.next + ";";
        if (groupCaptureCode)
            this.nextCode = "{ " + this.nextCode + groupCaptureCode + " }";
    }
}

@CodeTemplate(`{expression}.str`)
export class CRegexAsString extends CTemplateBase {
    constructor (public expression: CExpression) { super(); }
}
