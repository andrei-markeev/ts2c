import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory } from '../../template';
import { StandardCallResolver, IResolver } from '../../resolver';
import { ArrayType, StringVarType, NumberVarType, TypeHelper } from '../../types';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { RegexCompiler, CompiledRegex, RegexMachine, RegexState } from '../../regex';

@StandardCallResolver
class StringSearchResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        if (call.expression.kind != ts.SyntaxKind.PropertyAccessExpression)
            return false;
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        let objType = typeHelper.getCType(propAccess.expression);
        return propAccess.name.getText() == "search" && objType == StringVarType;
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CStringSearch(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
}

var regexLiteralFuncNames = {};

@CodeTemplate(`
{#if !topExpressionOfStatement}
    {regexFuncName}({argAccess}).index
{/if}`)
class CStringSearch
{
    public topExpressionOfStatement: boolean;
    public regexFuncName: string;
    public argAccess: CElementAccess;

    constructor(scope: IScope, call: ts.CallExpression) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            if (call.arguments.length == 1 && call.arguments[0].kind == ts.SyntaxKind.RegularExpressionLiteral) {
                let template = (<ts.RegularExpressionLiteral>call.arguments[0]).text;
                if (!regexLiteralFuncNames[template]) {
                    regexLiteralFuncNames[template] = scope.root.typeHelper.addNewTemporaryVariable(null, "regex_search");
                    scope.root.functions.splice(scope.parent ? -2 : -1, 0, new CRegexSearch(scope, template, regexLiteralFuncNames[template]));
                }
                this.regexFuncName = regexLiteralFuncNames[template];
                this.argAccess = new CElementAccess(scope, propAccess.expression);
            } else
                console.log("Unsupported parameter type in " + call.getText() + ". Expected regular expression literal.");
        }
    }
}

@CodeTemplate(`
struct regex_search_result_t {regexFunctionName}(const char *str) {
    int16_t state, next, len = strlen(str), iterator;
    struct regex_search_result_t result{#if hasNested}, nested_result{/if};
{#if hasChars}
    char ch;
{/if}
{variants}
    result.length = result.index == -1 ? 0 : iterator - result.index;
    return result;
}`)
class CRegexSearch {
    public hasNested: boolean = false;
    public hasChars: boolean = false;
    public variants: CRegexSearchVariant[] = [];
    constructor(scope: IScope, template: string, public regexFunctionName: string, compiledRegex: CompiledRegex = null) {
        let compiler = new RegexCompiler();
        compiledRegex = compiledRegex || compiler.compile(template.slice(1, -1));
        for (let i=0; i<compiledRegex.variants.length; i++) {
            let variant = compiledRegex.variants[i];
            this.hasNested = this.hasNested || variant.states.filter(s => s.stm).length > 0;
            this.hasChars = this.hasChars || variant.states.filter(s => Object.keys(s.chars).length > 0).length > 0;
            this.variants.push(new CRegexSearchVariant(scope, variant, i==0, compiledRegex.fixedStart, compiledRegex.fixedEnd));
        }
        scope.root.headerFlags.strings = true;
        scope.root.headerFlags.regex_search_result_t = true;
    }

}

@CodeTemplate(`
{#if !firstVariant}
        if (result.index == -1) {
{/if}
{TAB}    state = 0;
{TAB}    next = -1;
{TAB}    result.index = 0;
{TAB}    for (iterator = 0; iterator < len; iterator++) {
{#if hasChars}
{TAB}        ch = str[iterator];
{/if}

{TAB}        {stateTransitionBlocks {        }=> {this}}


{TAB}        if (next == -1) {
{TAB}            {continueBlock}
{TAB}        } else {
{TAB}            state = next;
{TAB}            next = -1;
{TAB}        }
{TAB}    }
{#if fixedEnd}
    {TAB}    if (state < {final} || iterator != len)
    {TAB}        result.index = -1;
{#else}
    {TAB}    if (state < {final})
    {TAB}        result.index = -1;
{/if}
{#if !firstVariant}
        }
{/if}
`)
class CRegexSearchVariant {
    public final: string;
    public continueBlock: ContinueBlock;
    public stateTransitionBlocks: CStateTransitionsBlock[] = [];
    public hasChars: boolean;
    public TAB: string;
    constructor(scope: IScope, variant: RegexMachine, public firstVariant: boolean, fixedStart: boolean, public fixedEnd: boolean) {
        this.TAB = this.firstVariant ? "" : "    ";
        this.hasChars = variant.states.filter(s => Object.keys(s.chars).length > 0).length > 0;
        for (let s = 0; s < variant.states.length; s++) {
            this.stateTransitionBlocks.push(new CStateTransitionsBlock(
                scope,
                s+"",
                variant.states[s]
            ));
        }
        this.final = variant.final+"";
        this.continueBlock = new ContinueBlock(scope, 
            fixedStart,
            this.fixedEnd,
            this.final
        );
    }
}

@CodeTemplate(`if (state == {stateNumber}) {
            {charConditions {\n            }=> if (ch == '{ch}') next = {next};}
{#if anyChar && exceptConditions.length}
                if ({exceptConditions { && }=> (ch != '{ch}')} && next == -1)
                    next = {next};
{#elseif anyChar}
                if (next == -1) next = {next};
{#elseif nestedCall}
                nested_result = {nestedCall};
                if (nested_result.index > -1) {
                    next = {next};
                    iterator += nested_result.length-1;
                }
{/if}
        }
`)
class CStateTransitionsBlock {
    public charConditions: CharCondition[] = [];
    public exceptConditions: CharCondition[] = [];
    public anyChar: boolean = false;
    public nestedCall: string = '';
    public next: string;
    constructor(scope: IScope, public stateNumber: string, state: RegexState) {
        for (let ch in state.chars)
            this.charConditions.push(new CharCondition(ch.replace('\\','\\\\'), state.chars[ch]));
        for (let ch in state.except)
            this.exceptConditions.push(new CharCondition(ch.replace('\\','\\\\'), -1));
        for (let stm in state.stm) {
            if (!regexLiteralFuncNames[state.template]) {
                regexLiteralFuncNames[state.template] = scope.root.typeHelper.addNewTemporaryVariable(null, "regex_search");
                let compiledRegex = { fixedStart: true, fixedEnd: false, variants: state.stm };
                let regexSearch = new CRegexSearch(scope, state.template, regexLiteralFuncNames[state.template], compiledRegex);
                scope.root.functions.splice(scope.parent ? -2 : -1, 0, regexSearch);
            }
            this.nestedCall = regexLiteralFuncNames[state.template] + '(str + iterator)';
            this.next = state.next+"";
        }
        if (state.anyChar) {
            this.anyChar = true;
            this.next = state.anyChar+"";
        }
    }
}

@CodeTemplate(`
{#if !fixedStart && !fixedEnd}
    if (state >= {final})
        break;
    iterator = result.index;
    result.index++;
    state = 0;
{#elseif !fixedStart && fixedEnd}
    iterator = result.index;
    result.index++;
    state = 0;
{#else}
    break;
{/if}`)
class ContinueBlock {
    constructor(scope: IScope, 
        public fixedStart: boolean, 
        public fixedEnd: boolean, 
        public final: string) { }
}

class CharCondition {
    constructor(public ch: string, public next: number) {}
}