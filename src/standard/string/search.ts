import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory } from '../../template';
import { StandardCallResolver, IResolver } from '../../resolver';
import { ArrayType, StringVarType, NumberVarType, TypeHelper } from '../../types';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { RegexBuilder, RegexMachine, RegexState } from '../../regex';

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
    int16_t state = 0, next = -1, iterator, len = strlen(str);
    struct regex_search_result_t result;
{#if hasChars}
        char ch;
{/if}
    result.index = 0;
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
        if (state != {final} || iterator != len)
            result.index = -1;
{#else}
        if (state != {final})
            result.index = -1;
{/if}
    result.length = result.index == -1 ? 0 : iterator - result.index;
    return result;
}`)
class CRegexSearch {
    public hasChars: boolean;
    public final: string;
    public fixedEnd: boolean;
    public continueBlock: ContinueBlock;
    public stateTransitionBlocks: CStateTransitionsBlock[] = [];
    constructor(scope: IScope, template: string, public regexFunctionName: string, regexMachine: RegexMachine = null) {
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
        this.final = regexMachine.final+"";
        this.fixedEnd = regexMachine.fixedEnd;
        this.continueBlock = new ContinueBlock(scope, 
            regexMachine.fixedStart,
            this.fixedEnd,
            this.final
        );
        scope.root.headerFlags.strings = true;
        scope.root.headerFlags.regex_search_result_t = true;
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
    if (state == {final})
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