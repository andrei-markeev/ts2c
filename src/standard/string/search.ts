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

@CodeTemplate(`
{#statements}
    {#if !topExpressionOfStatement}
        {stateVarName} = 0;
        {indexVarName} = 0;
        {nextVarName} = -1;
        {lenVarName} = strlen({varAccess});
        for ({iteratorVarName} = 0; {iteratorVarName} < {lenVarName}; {iteratorVarName}++) {
            {chVarName} = {varAccess}[{iteratorVarName}];

            {stateTransitionBlocks {    }=> {this}}

            if ({nextVarName} == -1) {
                if ({stateVarName} >= {final})
                    break;
                {iteratorVarName} = {indexVarName};
                {indexVarName}++;
                {stateVarName} = 0;
            } else {
                {stateVarName} = {nextVarName};
                {nextVarName} = -1;
            }
        }
        if ({stateVarName} < {final})
            {indexVarName} = -1;
    {/if}
{/statements}
{#if !topExpressionOfStatement}
    {indexVarName}
{/if}`)
class CStringSearch {
    public topExpressionOfStatement: boolean;
    public stateVarName: string;
    public nextVarName: string;
    public chVarName: string;
    public iteratorVarName: string;
    public indexVarName: string;
    public lenVarName: string;
    public varAccess: CElementAccess;
    public stateTransitionBlocks: CStateTransitionsBlock[] = [];
    public final: string;
    constructor(scope: IScope, call: ts.CallExpression) {
        let propAccess = <ts.PropertyAccessExpression>call.expression;
        this.topExpressionOfStatement = call.parent.kind == ts.SyntaxKind.ExpressionStatement;
        if (!this.topExpressionOfStatement) {
            this.varAccess = new CElementAccess(scope, propAccess.expression);

            this.stateVarName = scope.root.typeHelper.addNewTemporaryVariable(call, "state");
            this.nextVarName = scope.root.typeHelper.addNewTemporaryVariable(call, "next");
            this.chVarName = scope.root.typeHelper.addNewTemporaryVariable(call, "ch");
            this.indexVarName = scope.root.typeHelper.addNewTemporaryVariable(call, "index");
            this.lenVarName = scope.root.typeHelper.addNewTemporaryVariable(call, "len");
            this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(call);

            scope.variables.push(new CVariable(scope, this.stateVarName, NumberVarType));
            scope.variables.push(new CVariable(scope, this.nextVarName, NumberVarType));
            scope.variables.push(new CVariable(scope, this.chVarName, NumberVarType));
            scope.variables.push(new CVariable(scope, this.indexVarName, NumberVarType));
            scope.variables.push(new CVariable(scope, this.lenVarName, NumberVarType));
            scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));

            if (call.arguments.length < 1 || call.arguments[0].kind != ts.SyntaxKind.RegularExpressionLiteral)
                console.log("Unsupported parameter type in " + call.getText() + ". Expected regular expression literal.");

            let template = (<ts.RegularExpressionLiteral>call.arguments[0]).text;
            let compiler = new RegexCompiler();
            let stms = compiler.compile(template.slice(1, -1));
            if (stms.length >= 1) {
                for (let s = 0; s < stms[0].states.length; s++) {
                    this.stateTransitionBlocks.push(new CStateTransitionsBlock(
                        scope,
                        this.chVarName,
                        this.stateVarName,
                        this.nextVarName,
                        s,
                        stms[0].states[s]
                    ));
                }
                this.final = stms[0].final+"";
            }
            scope.root.headerFlags.strings = true;
        }
    }

}

@CodeTemplate(`if ({stateVarName} == {stateNumber}) {
        {charConditions {\n        }=> if ({chVarName} == '{ch}') {nextVarName} = {next};}
{#if anyChar && exceptConditions.length}
            if ({exceptConditions { && }=> ({chVarName} != '{ch}')} && {nextVarName} == -1)
                {nextVarName} = {anyChar};
{#elseif anyChar}
            if ({nextVarName} == -1) {nextVarName} = {anyChar};
{/if}
    }
`)
class CStateTransitionsBlock {
    public charConditions: CharCondition[] = [];
    public exceptConditions: CharCondition[] = [];
    public anyChar: string = '';
    constructor(scope: IScope, public chVarName: string, public stateVarName: string, public nextVarName: string, public stateNumber: number, state: RegexState) {
        for (let ch in state.chars)
            this.charConditions.push(new CharCondition(ch.replace('\\','\\\\'), state.chars[ch], this.chVarName, this.nextVarName));
        for (let ch in state.except)
            this.exceptConditions.push(new CharCondition(ch.replace('\\','\\\\'), -1, this.chVarName, this.nextVarName));
        if (state.anyChar)
            this.anyChar = state.anyChar+"";
            // 'if (' + this.nextVarName + ' == -1) ' + this.nextVarName + ' = ' + state.anyChar + ';';
    }
}

class CharCondition {
    constructor(public ch: string, public next: number, public chVarName: string, public nextVarName: string) {}
}