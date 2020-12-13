import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../template';
import { CProgram, IScope } from '../program';
import { ArrayType, NumberVarType, StringVarType } from '../types/ctypes';
import { CVariable, CVariableDeclaration, CVariableDestructors } from './variable';
import { CExpression, CCondition } from './expressions';
import { CElementAccess, CArraySize, CSimpleElementAccess } from './elementaccess';
import { AssignmentHelper } from './assignment';
import { getAllNodesUnder } from '../types/utils';

@CodeTemplate(`{statement}{breakLabel}`, ts.SyntaxKind.LabeledStatement)
export class CLabeledStatement extends CTemplateBase {
    public statement: CExpression;
    public breakLabel: string;
    constructor(scope: IScope, node: ts.LabeledStatement) {
        super();
        const nodes = getAllNodesUnder(node);
        this.breakLabel = nodes.some(n => ts.isBreakStatement(n) && n.label.text === node.label.text)
            ? " " + node.label.text + "_break:"
            : "";

        const hasContinue = nodes.some(n => ts.isContinueStatement(n) && n.label.text === node.label.text);
        if (hasContinue) {
            if (ts.isForStatement(node.statement))
                this.statement = new CForStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isForOfStatement(node.statement))
                this.statement = new CForOfStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isWhileStatement(node.statement))
                this.statement = new CWhileStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isDoStatement(node.statement))
                this.statement = new CDoWhileStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (ts.isForInStatement(node.statement))
                this.statement = new CForInStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else
                this.statement = "/* Unsupported labeled statement " + node.getText() + " */";
        } else
            this.statement = CodeTemplateFactory.createForNode(scope, node.statement);
    }
}
@CodeTemplate(`
{#if label}
    goto {label};
{#else}
    break;
{/if}
`, ts.SyntaxKind.BreakStatement)
export class CBreakStatement extends CTemplateBase {
    public label: string;
    constructor(scope: IScope, node: ts.BreakStatement) {
        super();
        this.label = node.label && node.label.text + "_break";
    }
}
@CodeTemplate(`
{#if label}
    goto {label};
{#else}
    continue;
{/if}
`, ts.SyntaxKind.ContinueStatement)
export class CContinueStatement extends CTemplateBase {
    public label: string;
    constructor(scope: IScope, node: ts.BreakStatement) {
        super();
        this.label = node.label && node.label.text + "_continue";
    }
}
@CodeTemplate(`;\n`, ts.SyntaxKind.EmptyStatement)
export class CEmptyStatement {
    constructor(scope: IScope, node: ts.BreakStatement) { }
}

@CodeTemplate(`
{#if returnTypeAndVar}
    {returnTypeAndVar} = {expression};
    {destructors}
    return {returnTemp};
{#else}
    {destructors}
    return {expression};
{/if}
`, ts.SyntaxKind.ReturnStatement)
export class CReturnStatement extends CTemplateBase {
    public expression: CExpression;
    public destructors: CVariableDestructors;
    public retVarName: string = null;
    public returnTypeAndVar: string = null;
    public returnTemp: string = null;
    public closureParams: { name: string, value: CExpression }[] = [];
    doCheckVarNeeded(scope: IScope, node: ts.ReturnStatement): boolean {
        let s = scope.root.memoryManager.getDestructorsForScope(node);
        let idents = [];
        for (let e of s) {
            // strings will not be GCed here, thanks to escape analysis
            if (e.dict || e.array) {
                idents.push(e.varName);
            }
        }
        function testNode(n: ts.Node): boolean {
            let totalResult = ts.isIdentifier(n) && idents.indexOf(n.text) != -1;
            for (let i = 0; i < n.getChildCount(); i++) {
                totalResult ||= testNode(n.getChildAt(i));
            }
            return totalResult;
        }
        return testNode(node);
    }
    constructor(scope: IScope, node: ts.ReturnStatement) {
        super();
        this.returnTemp = scope.root.symbolsHelper.addTemp(node, 'returnVal');
        let returnType = scope.root.typeHelper.getCType(node.expression);
        if (this.doCheckVarNeeded(scope, node)) {
            // todo: make this less hackyy
            let fakeVar = new CVariable(scope, '__fake', returnType, { removeStorageSpecifier: true, arraysToPointers: true });;
            let fakeVarType = fakeVar.resolve().slice(0, -6).trim();
            this.returnTypeAndVar = fakeVarType;
            if (this.returnTypeAndVar.indexOf('{var}') == -1) {
                this.returnTypeAndVar += ' {var}';
            }
            this.returnTypeAndVar = this.returnTypeAndVar.replace('{var}', this.returnTemp);
        }
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
export class CIfStatement extends CTemplateBase {
    public condition: CExpression;
    public thenBlock: CBlock;
    public elseBlock: CBlock;
    public hasElseBlock: boolean;
    constructor(scope: IScope, node: ts.IfStatement) {
        super();
        this.condition = new CCondition(scope, node.expression);
        this.thenBlock = new CBlock(scope, node.thenStatement);
        this.hasElseBlock = !!node.elseStatement;
        this.elseBlock = this.hasElseBlock && new CBlock(scope, node.elseStatement);
    }
}

@CodeTemplate(`
{#if nonIntegral}
    {switch} = {values {\n        : }=> {this}}
        : -1;
{/if}
switch ({switch}) {
    {cases {    }=> {this}\n}
}
`, ts.SyntaxKind.SwitchStatement)
export class CSwitchStatement extends CTemplateBase {
    public nonIntegral: boolean;
    public expression: CExpression;
    public switch: CExpression;
    public cases: CSwitchCaseClause[];
    public values: CExpression[];
    constructor(scope: IScope, node: ts.SwitchStatement) {
        super();
        const exprType = scope.root.typeHelper.getCType(node.expression);
        this.nonIntegral = exprType != NumberVarType;

        this.expression = CodeTemplateFactory.createForNode(scope, node.expression);
        this.cases = node.caseBlock.clauses.map((clause, index) => new CSwitchCaseClause(scope, clause, this.nonIntegral ? index : null));

        if (this.nonIntegral) {
            const tempVarName = scope.root.symbolsHelper.addTemp(node, "tmp_switch");
            scope.variables.push(new CVariable(scope, tempVarName, NumberVarType));
            this.values = node.caseBlock.clauses.filter(c => ts.isCaseClause(c)).map((clause: ts.CaseClause, index) => new CSwitchCaseCompare(scope, this.expression, clause, index));
            this.switch = tempVarName;
        } else
            this.switch = this.expression;
    }
}

@CodeTemplate(`
{#if !defaultClause}
    case {value}:
{#else}
    default:
{/if}
        {statements {        }=> {this}}
`)
class CSwitchCaseClause extends CTemplateBase implements IScope {
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    public value: CExpression;
    public defaultClause: boolean;
    constructor(scope: IScope, clause: ts.CaseOrDefaultClause, index: number) {
        super();
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.defaultClause = clause.kind === ts.SyntaxKind.DefaultClause;
        if (index != null)
            this.value = "" + index;
        else if (ts.isCaseClause(clause))
            this.value = CodeTemplateFactory.createForNode(scope, clause.expression);

        for (let s of clause.statements) {
            const statement = CodeTemplateFactory.createForNode(this, s);
            this.statements.push(statement)
        }
    }
}

@CodeTemplate(`!strcmp({expression}, {value}) ? {index}`)
class CSwitchCaseCompare extends CTemplateBase {
    public value: CExpression;
    constructor(scope: IScope, public expression: CExpression, clause: ts.CaseClause, public index: number) {
        super();
        this.value = CodeTemplateFactory.createForNode(scope, clause.expression);
    }
}


@CodeTemplate(`
{#if continueLabel}
    while({condition}) {
        {variables {    }=> {this};\n}
        {statements {    }=> {this}}
        {continueLabel}: ;
    }
{#else}
    while ({condition})
    {block}
{/if}`, ts.SyntaxKind.WhileStatement)
export class CWhileStatement extends CTemplateBase {
    public condition: CExpression;
    public block: CBlock;
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    constructor(scope: IScope, node: ts.WhileStatement, public continueLabel?: string) {
        super();
        this.block = new CBlock(scope, node.statement);
        this.variables = this.block.variables;
        this.statements = this.block.statements;
        this.condition = new CCondition(scope, node.expression);
    }
}

@CodeTemplate(`
{#if continueLabel}
    do {
        {variables {    }=> {this};\n}
        {statements {    }=> {this}}
        {continueLabel}: ;
    } while ({condition});
{#else}
    do
    {block}
    while ({condition});
{/if}`, ts.SyntaxKind.DoStatement)
export class CDoWhileStatement extends CTemplateBase {
    public condition: CExpression;
    public block: CBlock;
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    constructor(scope: IScope, node: ts.DoStatement, public continueLabel?: string) {
        super();
        this.block = new CBlock(scope, node.statement);
        this.variables = this.block.variables;
        this.statements = this.block.statements;
        this.condition = new CCondition(scope, node.expression);
    }
}

@CodeTemplate(`
{#if varDecl}
    {varDecl}
{/if}
{#if continueLabel}
    {init};
    while({condition}) {
        {variables {    }=> {this};\n}
        {statements {    }=> {this}}
        {continueLabel}:
        {increment};
    }
{#else}
    for ({init};{condition};{increment})
    {block}
{/if}`, ts.SyntaxKind.ForStatement)
export class CForStatement extends CTemplateBase {
    public init: CExpression;
    public condition: CExpression;
    public increment: CExpression;
    public block: CBlock;
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    public varDecl: CVariableDeclaration = null;
    constructor(scope: IScope, node: ts.ForStatement, public continueLabel?: string) {
        super();
        this.block = new CBlock(scope, node.statement);
        this.variables = this.block.variables;
        this.statements = this.block.statements;
        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            let declList = <ts.VariableDeclarationList>node.initializer;
            this.varDecl = new CVariableDeclaration(scope, declList.declarations[0]);
            this.init = "";
        }
        else
            this.init = CodeTemplateFactory.createForNode(scope, node.initializer);
        this.condition = new CCondition(scope, node.condition);
        this.increment = node.incrementor ? CodeTemplateFactory.createForNode(scope, node.incrementor) : "";
    }
}

@CodeTemplate(`
{#if continueLabel}
    {iteratorVarName} = 0;
    while ({iteratorVarName} < {arraySize}) {
        {variables {    }=> {this};\n}
        {init} = {cast}{elementAccess};
    {statements {    }=> {this}}
        {continueLabel}:
        {iteratorVarName}++;
    }
{#else}
    for ({iteratorVarName} = 0; {iteratorVarName} < {arraySize}; {iteratorVarName}++)
    {
        {variables {    }=> {this};\n}
        {init} = {cast}{elementAccess};
        {statements {    }=> {this}}
    }
{/if}
`, ts.SyntaxKind.ForOfStatement)
export class CForOfStatement extends CTemplateBase implements IScope {
    public init: CExpression;
    public iteratorVarName: string;
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    public elementAccess: CSimpleElementAccess;
    public arraySize: CArraySize;
    public cast: string = "";
    constructor(scope: IScope, node: ts.ForOfStatement, public continueLabel?: string) {
        super();
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
        const arrType = <ArrayType>scope.root.typeHelper.getCType(node.expression);
        const varAccess = CodeTemplateFactory.createForNode(scope, node.expression);
        this.elementAccess = new CSimpleElementAccess(scope, arrType, varAccess, this.iteratorVarName);
        this.arraySize = new CArraySize(scope, varAccess, arrType);
        if (arrType && arrType instanceof ArrayType && arrType.elementType instanceof ArrayType && arrType.elementType.isDynamicArray)
            this.cast = "(void *)";

        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            let declInit = (<ts.VariableDeclarationList>node.initializer).declarations[0];
            scope.variables.push(new CVariable(scope, declInit.name.getText(), declInit.name));
            this.init = declInit.name.getText();
        }
        else
            this.init = new CElementAccess(scope, node.initializer);

        this.statements.push(CodeTemplateFactory.createForNode(this, node.statement));
        scope.variables = scope.variables.concat(this.variables);
        this.variables = [];
    }
}

@CodeTemplate(`
{#if continueLabel}
    {iteratorVarName} = 0;
    while ({iteratorVarName} < {varAccess}->index->size) {
        {variables {    }=> {this};\n}
        {init} = {varAccess}->index->data[{iteratorVarName}];
        {statements {    }=> {this}}
        {continueLabel}:
        {iteratorVarName}++;
    }
{#else}
    for ({iteratorVarName} = 0; {iteratorVarName} < {varAccess}->index->size; {iteratorVarName}++)
    {
        {variables {    }=> {this};\n}
        {init} = {varAccess}->index->data[{iteratorVarName}];
        {statements {    }=> {this}}
    }
{/if}
`, ts.SyntaxKind.ForInStatement)
export class CForInStatement extends CTemplateBase implements IScope {
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    public iteratorVarName: string;
    public varAccess: CElementAccess;
    public init: CElementAccess | string;
    constructor(scope: IScope, node: ts.ForInStatement, public continueLabel?: string) {
        super();
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
        this.varAccess = new CElementAccess(scope, node.expression);

        if (node.initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            let declInit = (<ts.VariableDeclarationList>node.initializer).declarations[0];
            scope.variables.push(new CVariable(scope, declInit.name.getText(), declInit.name));
            this.init = declInit.name.getText();
        }
        else
            this.init = new CElementAccess(scope, node.initializer);

        if (node.statement.kind == ts.SyntaxKind.Block) {
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

@CodeTemplate(`{expression}{SemicolonCR}`, ts.SyntaxKind.ExpressionStatement)
export class CExpressionStatement extends CTemplateBase {
    public expression: CExpression;
    public SemicolonCR: string = ';\n';
    constructor(scope: IScope, node: ts.ExpressionStatement) {
        super();
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
export class CBlock extends CTemplateBase implements IScope {
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    constructor(scope: IScope, node: ts.Statement) {
        super();
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        if (ts.isBlock(node)) {
            node.statements.forEach(s => this.statements.push(CodeTemplateFactory.createForNode(this, s)));
        }
        else
            this.statements.push(CodeTemplateFactory.createForNode(this, node));
    }
}

@CodeTemplate(``, ts.SyntaxKind.ImportDeclaration)
export class CImport extends CTemplateBase {
    public externalInclude: boolean;
    public moduleName: string;
    public nodeText: string;
    constructor(scope: IScope, node: ts.ImportDeclaration) {
        super();
        let moduleName = (<ts.StringLiteral>node.moduleSpecifier).text;
        this.externalInclude = moduleName.indexOf('ts2c-target') == 0;
        if (this.externalInclude) {
            moduleName = moduleName.split('/').slice(1).join('/');
            if (moduleName.slice(-6) == "/index")
                moduleName = moduleName.slice(0, -6);
            if (scope.root.includes.indexOf(moduleName) == -1)
                scope.root.includes.push(moduleName);
        }
        this.nodeText = node.getText();
    }
}

@CodeTemplate(`
TRY
{tryBlock}
CATCH
{#if catchVarName}
        {catchVarName} = err_defs->data[err_val - 1];
{/if}
{catchBlock}
{finallyBlock}
END_TRY
`, ts.SyntaxKind.TryStatement)
export class CTryStatement extends CTemplateBase {
    public tryBlock: CBlock;
    public catchBlock: CBlock | string;
    public finallyBlock: CBlock | string;
    public catchVarName: string;
    constructor(scope: IScope, node: ts.TryStatement) {
        super();
        this.tryBlock = new CBlock(scope, node.tryBlock);
        this.catchBlock = node.catchClause ? new CBlock(scope, node.catchClause.block) : "";
        this.finallyBlock = node.finallyBlock ? new CBlock(scope, node.finallyBlock) : "";
        this.catchVarName = node.catchClause && node.catchClause.variableDeclaration && node.catchClause.variableDeclaration.name.getText();
        if (this.catchVarName)
            scope.variables.push(new CVariable(scope, this.catchVarName, StringVarType));
        scope.root.headerFlags.try_catch = true;
    }
}

@CodeTemplate(`
{#statements}
    ARRAY_PUSH(err_defs, {value});
{/statements}
THROW(err_defs->size);
`, ts.SyntaxKind.ThrowStatement)
export class CThrowStatement extends CTemplateBase {
    public value: CExpression;
    constructor(scope: IScope, node: ts.ThrowStatement) {
        super();
        this.value = CodeTemplateFactory.createForNode(scope, node.expression);
        scope.root.headerFlags.try_catch = true;
    }
}
