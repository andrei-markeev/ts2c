import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory } from '../../template';
import { StandardCallResolver, IResolver } from '../../resolver';
import { ArrayType, StringVarType, NumberVarType, TypeHelper } from '../../types';
import { IScope } from '../../program';
import { CVariable } from '../../nodes/variable';
import { CExpression } from '../../nodes/expressions';
import { CElementAccess } from '../../nodes/elementaccess';
import { RegexCompiler, RegexState } from '../../regex';

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
    {regexFuncName}({argAccess})
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
                    scope.root.functions.splice(scope.parent ? -2 : -1, 0, new CRegexSearch(scope, call, regexLiteralFuncNames[template]));
                }
                this.regexFuncName = regexLiteralFuncNames[template];
                this.argAccess = new CElementAccess(scope, propAccess.expression);
            } else
                console.log("Unsupported parameter type in " + call.getText() + ". Expected regular expression literal.");
        }
    }
}

@CodeTemplate(`
int {regexFunctionName}(const char *str) {
    state = 0;
    index = 0;
    next = -1;
    len = strlen(str);
    for (iterator = 0; iterator < len; iterator++) {
        ch = str[iterator];

        {stateTransitionBlocks {        }=> {this}}

        if (next == -1) {
            {continueBlock}
        } else {
            state = next;
            next = -1;
        }
    }
{#if fixedEnd}
        if (state < {final} || iterator != len)
            index = -1;
{#else}
        if (state < {final})
            index = -1;
{/if}
}`)
class CRegexSearch {
    public topExpressionOfStatement: boolean;
    public stateTransitionBlocks: CStateTransitionsBlock[] = [];
    public final: string;
    public fixedEnd: boolean;
    public continueBlock: ContinueBlock;
    constructor(scope: IScope, call: ts.CallExpression, public regexFunctionName: string) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;

        if (call.arguments.length < 1 || call.arguments[0].kind != ts.SyntaxKind.RegularExpressionLiteral)
            console.log("Unsupported parameter type in " + call.getText() + ". Expected regular expression literal.");

        let template = (<ts.RegularExpressionLiteral>call.arguments[0]).text;
        let compiler = new RegexCompiler();
        let compiledRegex = compiler.compile(template.slice(1, -1));
        if (compiledRegex.variants.length >= 1) {
            for (let s = 0; s < compiledRegex.variants[0].states.length; s++) {
                this.stateTransitionBlocks.push(new CStateTransitionsBlock(
                    scope,
                    s,
                    compiledRegex.variants[0].states[s]
                ));
            }
            this.final = compiledRegex.variants[0].final+"";
            this.fixedEnd = compiledRegex.fixedEnd;
            this.continueBlock = new ContinueBlock(scope, 
                compiledRegex.fixedStart,
                this.fixedEnd,
                this.final
            );
        }
        scope.root.headerFlags.strings = true;
    }

}

@CodeTemplate(`if (state == {stateNumber}) {
            {charConditions {\n            }=> if (ch == '{ch}') next = {next};}
{#if anyChar && exceptConditions.length}
                if ({exceptConditions { && }=> (ch != '{ch}')} && next == -1)
                    next = {anyChar};
{#elseif anyChar}
                if (next == -1) next = {anyChar};
{/if}
        }
`)
class CStateTransitionsBlock {
    public charConditions: CharCondition[] = [];
    public exceptConditions: CharCondition[] = [];
    public anyChar: string = '';
    constructor(scope: IScope, public stateNumber: number, state: RegexState) {
        for (let ch in state.chars)
            this.charConditions.push(new CharCondition(ch.replace('\\','\\\\'), state.chars[ch]));
        for (let ch in state.except)
            this.exceptConditions.push(new CharCondition(ch.replace('\\','\\\\'), -1));
        if (state.anyChar)
            this.anyChar = state.anyChar+"";
    }
}

@CodeTemplate(`
{#if !fixedStart && !fixedEnd}
    if (state >= {final})
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
        public final: string) { }
}

class CharCondition {
    constructor(public ch: string, public next: number) {}
}