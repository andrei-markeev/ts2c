import * as ts from 'typescript';
import {CodeTemplate, IResolvable} from '../template';
import {CProgram, IScope} from '../program';
import {ArrayType} from '../types';
import {CFunction} from './function';
import {CVariable, CVariableDeclaration, CVariableDestructors} from './variable';
import {ExpressionHelper, CExpression, CElementAccess} from './expressions';

@CodeTemplate(`
{#if needBlock}
    {
        {destructors}
        return {expression};
    }
{/if}
{#if !needBlock}
    {destructors}
    return {expression};
{/if}
`)
export class CReturnStatement
{
    public expression: CExpression;
    public needBlock: boolean;
    public destructors: CVariableDestructors;
    constructor(scope: IScope, node: ts.ReturnStatement)
    {
        this.expression = ExpressionHelper.create(scope, node.expression);
        this.destructors = new CVariableDestructors(scope, node);
        this.needBlock = node.parent && (
            node.parent.kind == ts.SyntaxKind.IfStatement
            || node.parent.kind == ts.SyntaxKind.ForStatement
            || node.parent.kind == ts.SyntaxKind.WhileStatement); 
    }
}

@CodeTemplate(`
if ({condition})
{thenBlock}
{#if hasElseBlock}
    else
    {elseBlock}
{/if}
`)
export class CIfStatement
{
    public condition: CExpression;
    public thenBlock: CBlock;
    public elseBlock: CBlock;
    public hasElseBlock: boolean;
    constructor(scope: IScope, node: ts.IfStatement)
    {
        this.thenBlock = new CBlock(scope);
        this.elseBlock = new CBlock(scope);
        this.hasElseBlock = !!node.elseStatement;
        this.condition = ExpressionHelper.create(scope, node.expression);
        StatementProcessor.process(node.thenStatement, this.thenBlock);
    }
}

@CodeTemplate(`
while ({condition})
{block}`)
export class CWhileStatement
{
    public condition: CExpression;
    public block: CBlock;
    constructor(scope: IScope, node: ts.WhileStatement)
    {
        this.block = new CBlock(scope);
        this.condition = ExpressionHelper.create(scope, node.expression);
        StatementProcessor.process(node.statement, this.block);
    }
}

@CodeTemplate(`
for ({init};{condition};{increment})
{block}`)
export class CForStatement
{
    public init: CExpression;
    public condition: CExpression;
    public increment: CExpression;
    public block: CBlock;
    constructor(scope: IScope, node: ts.ForStatement)
    {
        this.block = new CBlock(scope);
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            StatementProcessor.process(<any>{ kind: ts.SyntaxKind.VariableStatement, declarationList: node.initializer }, scope);
            this.init = "";
        }
        else
            this.init = ExpressionHelper.create(scope, <ts.Expression>node.initializer);
        this.condition = ExpressionHelper.create(scope, node.condition);
        this.increment = ExpressionHelper.create(scope, node.incrementor);
        StatementProcessor.process(node.statement, this.block);
    }
}

@CodeTemplate(`
for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)
{
    {init} = {arrayAccess}[{iteratorVarName}];
    {statements {    }=> {this}}
}
`)
export class CForOfStatement implements IScope
{
    public init: CExpression;
    public iteratorVarName: string;
    public arraySize: string;
    public arrayAccess: string;
    public variables: CVariable[] = [];
    public statements: any[] = [];
    public parent: IScope;
    public root: CProgram;
    constructor(scope: IScope, node: ts.ForOfStatement)
    {
        this.parent = scope;
        this.root = scope.root;
        this.iteratorVarName = scope.root.typeHelper.addNewIteratorVariable(node);
        scope.variables.push(new CVariable(scope, this.iteratorVarName, "int16_t"));
        scope.root.headerFlags.int16_t = true;
        let arrayVarInfo = scope.root.typeHelper.getVariableInfo(node.expression);
        let arrayVarType = arrayVarInfo && arrayVarInfo.type as ArrayType;
        this.arraySize = arrayVarType.isDynamicArray ? arrayVarInfo.name + ".size" : (<ArrayType>arrayVarInfo.type).capacity + "";
        this.arrayAccess = arrayVarInfo.name + (arrayVarType.isDynamicArray ? ".data" : "");
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            let declInit = (<ts.VariableDeclarationList>node.initializer).declarations[0];
            new CVariableDeclaration(scope, declInit);
            this.init = declInit.name.getText();
        }
        else
            this.init = new CElementAccess(scope, node.initializer);
        StatementProcessor.process(node.statement, this);
        scope.variables = scope.variables.concat(this.variables);
        this.variables = [];
    }
}


@CodeTemplate(`
{#if statements.length > 1 || variables.length > 0}
    {
        {variables => {this};\n}
        {statements {    }=> {this}}
    }
{/if}
{#if statements.length == 1 && variables.length == 0}
        {statements}
{/if}
{#if statements.length == 0 && variables.length == 0}
        /* no statements */;
{/if}`)
export class CBlock implements IScope
{
    public variables: CVariable[] = [];
    public statements: any[] = [];
    public parent: IScope;
    public root: CProgram;
    constructor(scope: IScope)
    {
        this.parent = scope;
        this.root = scope.root;
    }
}

export class StatementProcessor {
    public static process(node: ts.Node, scope: IScope) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
                scope.root.functions.push(new CFunction(scope.root, <ts.FunctionDeclaration>node));
                break;
            case ts.SyntaxKind.VariableStatement:
                for (let decl of (<ts.VariableStatement>node).declarationList.declarations)
                    StatementProcessor.pushStatements(scope, <any>new CVariableDeclaration(scope, decl));
                break;
            case ts.SyntaxKind.ReturnStatement:
                StatementProcessor.pushStatements(scope, <any>new CReturnStatement(scope, <ts.ReturnStatement>node));
                break;
            case ts.SyntaxKind.ExpressionStatement:
                StatementProcessor.pushStatements(scope, <any>ExpressionHelper.create(scope, (<ts.ExpressionStatement>node).expression));
                break;
            case ts.SyntaxKind.IfStatement:
                StatementProcessor.pushStatements(scope, <any>new CIfStatement(scope, <ts.IfStatement>node));
                break;
            case ts.SyntaxKind.WhileStatement:
                StatementProcessor.pushStatements(scope, <any>new CWhileStatement(scope, <ts.WhileStatement>node));
                break;
            case ts.SyntaxKind.ForStatement:
                StatementProcessor.pushStatements(scope, <any>new CForStatement(scope, <ts.ForStatement>node));
                break;
            case ts.SyntaxKind.ForOfStatement:
                StatementProcessor.pushStatements(scope, <any>new CForOfStatement(scope, <ts.ForOfStatement>node));
                break;
            default:
                scope.statements.push("/* Unsupported statement: " + node.getText().replace(/[\n\s]+/g,' ') + " */;\n");
        }
    }
    private static pushStatements(scope: IScope, resolvableValue: IResolvable) {
        let result = resolvableValue.resolve();
        if (result.search(/[;}]\n$/) > -1) {
            for (let line of result.split('\n'))
                if (line != '')
                    scope.statements.push(line + '\n');
        }
        else {
            scope.statements.push(result + ";\n");
        }
    }
}
