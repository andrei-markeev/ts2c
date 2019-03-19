import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {CProgram, IScope} from '../program';
import {ArrayType, NumberVarType} from '../types';
import {CVariable, CVariableDeclaration, CVariableDestructors} from './variable';
import {CExpression} from './expressions';
import {CString} from './literals';
import {CElementAccess} from './elementaccess';
import {AssignmentHelper} from './assignment';

@CodeTemplate(`break;\n`, ts.SyntaxKind.BreakStatement)
export class CBreakStatement {
    constructor(scope: IScope, node: ts.BreakStatement) { }
}
@CodeTemplate(`continue;\n`, ts.SyntaxKind.ContinueStatement)
export class CContinueStatement {
    constructor(scope: IScope, node: ts.BreakStatement) { }
}
@CodeTemplate(`;\n`, ts.SyntaxKind.EmptyStatement)
export class CEmptyStatement {
    constructor(scope: IScope, node: ts.BreakStatement) { }
}

@CodeTemplate(`
{destructors}
return {expression};
`, ts.SyntaxKind.ReturnStatement)
export class CReturnStatement {
    public expression: CExpression;
    public destructors: CVariableDestructors;
    constructor(scope: IScope, node: ts.ReturnStatement) {
        this.expression = CodeTemplateFactory.createForNode(scope, node.expression);
        this.destructors = new CVariableDestructors(scope, node);
    }
}

@CodeTemplate(`
if ({condition})
{thenBlock}
{#if hasElseBlock}
    else
    {elseBlock}
{/if}
`, ts.SyntaxKind.IfStatement)
export class CIfStatement {
    public condition: CExpression;
    public thenBlock: CBlock;
    public elseBlock: CBlock;
    public hasElseBlock: boolean;
    constructor(scope: IScope, node: ts.IfStatement) {
        this.condition = CodeTemplateFactory.createForNode(scope, node.expression);
        this.thenBlock = new CBlock(scope, node.thenStatement);
        this.hasElseBlock = !!node.elseStatement;
        this.elseBlock = this.hasElseBlock && new CBlock(scope, node.elseStatement);
    }
}

@CodeTemplate(`
while ({condition})
{block}`, ts.SyntaxKind.WhileStatement)
export class CWhileStatement {
    public condition: CExpression;
    public block: CBlock;
    constructor(scope: IScope, node: ts.WhileStatement) {
        this.block = new CBlock(scope, node.statement);
        this.condition = CodeTemplateFactory.createForNode(scope, node.expression);
    }
}

@CodeTemplate(`
do
{block}
while ({condition});`, ts.SyntaxKind.DoStatement)
export class CDoWhileStatement {
    public condition: CExpression;
    public block: CBlock;
    constructor(scope: IScope, node: ts.WhileStatement) {
        this.block = new CBlock(scope, node.statement);
        this.condition = CodeTemplateFactory.createForNode(scope, node.expression);
    }
}

@CodeTemplate(`
{#if varDecl}
    {varDecl}
{/if}
for ({init};{condition};{increment})
{block}`, ts.SyntaxKind.ForStatement)
export class CForStatement {
    public init: CExpression;
    public condition: CExpression;
    public increment: CExpression;
    public block: CBlock;
    public varDecl: CVariableDeclaration = null;
    constructor(scope: IScope, node: ts.ForStatement) {
        this.block = new CBlock(scope, node.statement);
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            let declList = <ts.VariableDeclarationList>node.initializer;
            this.varDecl = new CVariableDeclaration(scope, declList.declarations[0]);
            this.init = "";
        }
        else
            this.init = CodeTemplateFactory.createForNode(scope, node.initializer);
        this.condition = CodeTemplateFactory.createForNode(scope, node.condition);
        this.increment = CodeTemplateFactory.createForNode(scope, node.incrementor);
    }
}

@CodeTemplate(`
{#if isDynamicArray}
    for ({iteratorVarName} = 0; {iteratorVarName} < {arrayAccess}->size; {iteratorVarName}++)
    {
        {variables {    }=> {this};\n}
        {init} = {cast}{arrayAccess}->data[{iteratorVarName}];
        {statements {    }=> {this}}
    }
{#else}
    for ({iteratorVarName} = 0; {iteratorVarName} < {arrayCapacity}; {iteratorVarName}++)
    {
        {variables {    }=> {this};\n}
        {init} = {cast}{arrayAccess}[{iteratorVarName}];
        {statements {    }=> {this}}
    }
{/if}
`, ts.SyntaxKind.ForOfStatement)
export class CForOfStatement implements IScope {
    public init: CExpression;
    public iteratorVarName: string;
    public variables: CVariable[] = [];
    public statements: any[] = [];
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    public isDynamicArray: boolean;
    public arrayAccess: CElementAccess;
    public arrayCapacity: string;
    public cast: string = "";
    constructor(scope: IScope, node: ts.ForOfStatement) {
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
        this.arrayAccess = new CElementAccess(scope, node.expression);
        let arrayVarType = scope.root.typeHelper.getCType(node.expression);
        if (arrayVarType && arrayVarType instanceof ArrayType) {
            this.isDynamicArray = arrayVarType.isDynamicArray;
            this.arrayCapacity = arrayVarType.capacity + "";
            let elemType = arrayVarType.elementType;
            if (elemType instanceof ArrayType && elemType.isDynamicArray)
                this.cast = "(void *)";
        }
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            let declInit = (<ts.VariableDeclarationList>node.initializer).declarations[0];
            scope.variables.push(new CVariable(scope, declInit.name.getText(), declInit.name));
            this.init = declInit.name.getText();
        }
        else {
            this.init = new CElementAccess(scope, node.initializer);
        }
        this.statements.push(CodeTemplateFactory.createForNode(this, node.statement));
        scope.variables = scope.variables.concat(this.variables);
        this.variables = [];
    }
}

@CodeTemplate(`
for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->index->size; {iteratorVarName}++)
{
    {variables {    }=> {this};\n}
    {init} = {varAccess}->index->data[{iteratorVarName}];
    {statements {    }=> {this}}
}
`, ts.SyntaxKind.ForInStatement)
export class CForInStatement implements IScope {
    public variables: CVariable[] = [];
    public statements: any[] = [];
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    public iteratorVarName: string;
    public varAccess: CElementAccess;
    public init: CElementAccess | string;
    constructor(scope: IScope, node: ts.ForInStatement) {
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
        this.varAccess = new CElementAccess(scope, node.expression);
        let dictVarType = scope.root.typeHelper.getCType(node.expression);
        // TODO: do something with dictVarType

        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            let declInit = (<ts.VariableDeclarationList>node.initializer).declarations[0];
            scope.variables.push(new CVariable(scope, declInit.name.getText(), declInit.name));
            this.init = declInit.name.getText();
        }
        else
            this.init = new CElementAccess(scope, node.initializer);

        if (node.statement.kind == ts.SyntaxKind.Block)
        {
            let block = <ts.Block>node.statement;
            for (let s of block.statements)
                this.statements.push(CodeTemplateFactory.createForNode(this, s));
        }
        else
            this.statements.push(CodeTemplateFactory.createForNode(this, node.statement));
        scope.variables = scope.variables.concat(this.variables);
        this.variables = [];
    }
}

class CProperty {
    constructor(
        public varAccess: CElementAccess,
        public index: string,
        public name: CString,
        public init: CExpression
    ) { }
}

@CodeTemplate(`{expression}{SemicolonCR}`, ts.SyntaxKind.ExpressionStatement)
export class CExpressionStatement {
    public expression: CExpression;
    public SemicolonCR: string = ';\n';
    constructor(scope: IScope, node: ts.ExpressionStatement) {
        if (node.expression.kind == ts.SyntaxKind.BinaryExpression) {
            let binExpr = <ts.BinaryExpression>node.expression;
            if (binExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
                this.expression = AssignmentHelper.create(scope, binExpr.left, binExpr.right);;
                this.SemicolonCR = '';
            }
        }
        if (!this.expression)
            this.expression = CodeTemplateFactory.createForNode(scope, node.expression);
    }
}


@CodeTemplate(`
{#if statements.length > 1 || variables.length > 0}
    {
        {variables {    }=> {this};\n}
        {statements {    }=> {this}}
    }
{/if}
{#if statements.length == 1 && variables.length == 0}
        {statements}
{/if}
{#if statements.length == 0 && variables.length == 0}
        /* no statements */;
{/if}`, ts.SyntaxKind.Block)
export class CBlock implements IScope {
    public variables: CVariable[] = [];
    public statements: any[] = [];
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    constructor(scope: IScope, node: ts.Statement) {
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        if (node.kind == ts.SyntaxKind.Block) {
            let block = <ts.Block>node;
            block.statements.forEach(s => this.statements.push(CodeTemplateFactory.createForNode(this, s)));
        }
        else
            this.statements.push(CodeTemplateFactory.createForNode(this, node));
    }
}

