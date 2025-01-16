import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../template';
import { CProgram, IScope} from '../program';
import { ArrayType, FuncType, NumberVarType, StringVarType } from '../types/ctypes';
import { CVariable, CVariableDeclaration, CVariableDestructors } from './variable';
import { CExpression, CCondition } from './expressions';
import { CElementAccess, CArraySize, CSimpleElementAccess } from './elementaccess';
import { AssignmentHelper } from './assignment';
import { findParentFunction, getAllNodesUnder, getNodeText, getVarDeclFromSimpleInitializer, isBinaryExpression, isBreakStatement, isCaseClause, isContinueStatement, isDoWhileStatement, isForInStatement, isForOfStatement, isForStatement, isSimpleInitializer, isStringLiteral, isWhileStatement } from '../types/utils';

@CodeTemplate(`{statement}{breakLabel}`, kataw.SyntaxKind.LabelledStatement)
export class CLabeledStatement extends CTemplateBase {
    public statement: CExpression;
    public breakLabel: string;
    constructor(scope: IScope, node: kataw.LabelledStatement) {
        super();
        const nodes = getAllNodesUnder(node);
        this.breakLabel = nodes.some(n => isBreakStatement(n) && n.label.text === node.label.text)
            ? " " + node.label.text + "_break:"
            : "";

        const hasContinue = nodes.some(n => isContinueStatement(n) && n.label.text === node.label.text);
        if (hasContinue) {
            if (isForStatement(node.statement))
                this.statement = new CForStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (isForOfStatement(node.statement))
                this.statement = new CForOfStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (isWhileStatement(node.statement))
                this.statement = new CWhileStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (isDoWhileStatement(node.statement))
                this.statement = new CDoWhileStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else if (isForInStatement(node.statement))
                this.statement = new CForInStatement(scope, node.statement, hasContinue && node.label.text + "_continue");
            else
                this.statement = "/* Unsupported labeled statement " + getNodeText(node) + " */";
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
`, kataw.SyntaxKind.BreakStatement)
export class CBreakStatement extends CTemplateBase {
    public label: string;
    constructor(scope: IScope, node: kataw.BreakStatement) {
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
`, kataw.SyntaxKind.ContinueStatement)
export class CContinueStatement extends CTemplateBase {
    public label: string;
    constructor(scope: IScope, node: kataw.BreakStatement) {
        super();
        this.label = node.label && node.label.text + "_continue";
    }
}
@CodeTemplate(`;\n`, kataw.SyntaxKind.EmptyStatement)
export class CEmptyStatement {
    constructor(scope: IScope, node: kataw.BreakStatement) { }
}

@CodeTemplate(`
{#statements}
    {#if retVarName}
        {retVarName} = {expression};
    {/if}
    {destructors}
{/statements}
{#if retVarName}
    return {retVarName};
{#elseif expression}
    return {expression};
{#else}
    return;
{/if}
`, kataw.SyntaxKind.ReturnStatement)
export class CReturnStatement extends CTemplateBase {
    public expression: CExpression = null;
    public destructors: CVariableDestructors = null;
    public retVarName: string = null;
    public closureParams: { name: string, value: CExpression }[] = [];
    constructor(scope: IScope, node: kataw.ReturnStatement) {
        super();
        if (node.expression !== null) {
            this.expression = CodeTemplateFactory.createForNode(scope, node.expression);
            let needRetVar = false;
            let returnExprNodes = getAllNodesUnder(node.expression);
            let destructors = scope.root.memoryManager.getDestructorsForScope(node);
            for (let n of returnExprNodes) {
                if (kataw.isIdentifier(n)) {
                    let symbol = scope.root.symbolsHelper.getSymbolAtLocation(n);
                    if (symbol) {
                        if (destructors.some(d => d.varName === n.text))
                            needRetVar = true;
                    }
                }
            }
            if (needRetVar) {
                const funcNode = findParentFunction(node);
                const funcType = scope.root.typeHelper.getCType(funcNode) as FuncType;
                this.retVarName = scope.root.symbolsHelper.addTemp(node, 'result');
                scope.variables.push(new CVariable(scope, this.retVarName, funcType.returnType));
            }
        }
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
`, kataw.SyntaxKind.IfStatement)
export class CIfStatement extends CTemplateBase {
    public condition: CExpression;
    public thenBlock: CBlock;
    public elseBlock: CBlock;
    public hasElseBlock: boolean;
    constructor(scope: IScope, node: kataw.IfStatement) {
        super();
        this.condition = new CCondition(scope, node.expression);
        this.thenBlock = new CBlock(scope, node.consequent);
        this.hasElseBlock = !!node.alternate;
        this.elseBlock = this.hasElseBlock && new CBlock(scope, node.alternate);
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
`, kataw.SyntaxKind.SwitchStatement)
export class CSwitchStatement extends CTemplateBase {
    public nonIntegral: boolean;
    public expression: CExpression;
    public switch: CExpression;
    public cases: CSwitchCaseClause[];
    public values: CExpression[];
    constructor(scope: IScope, node: kataw.SwitchStatement) {
        super();
        const exprType = scope.root.typeHelper.getCType(node.expression);
        this.nonIntegral = exprType != NumberVarType;

        this.expression = CodeTemplateFactory.createForNode(scope, node.expression);
        this.cases = node.caseBlock.clauses.map((clause, index) => new CSwitchCaseClause(scope, clause, this.nonIntegral ? index : null));

        if (this.nonIntegral) {
            const tempVarName = scope.root.symbolsHelper.addTemp(node, "tmp_switch");
            scope.variables.push(new CVariable(scope, tempVarName, NumberVarType));
            this.values = node.caseBlock.clauses.filter(c => isCaseClause(c)).map((clause, index) => new CSwitchCaseCompare(scope, this.expression, clause, index));
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
    constructor(scope: IScope, clause: kataw.CaseClause | kataw.DefaultClause, index: number) {
        super();
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.defaultClause = clause.kind === kataw.SyntaxKind.DefaultClause;
        if (index != null)
            this.value = "" + index;
        else if (isCaseClause(clause))
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
    constructor(scope: IScope, public expression: CExpression, clause: kataw.CaseClause, public index: number) {
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
{/if}`, kataw.SyntaxKind.WhileStatement)
export class CWhileStatement extends CTemplateBase {
    public condition: CExpression;
    public block: CBlock;
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    constructor(scope: IScope, node: kataw.WhileStatement, public continueLabel?: string) {
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
{/if}`, kataw.SyntaxKind.DoWhileStatement)
export class CDoWhileStatement extends CTemplateBase {
    public condition: CExpression;
    public block: CBlock;
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    constructor(scope: IScope, node: kataw.DoWhileStatement, public continueLabel?: string) {
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
{/if}`, kataw.SyntaxKind.ForStatement)
export class CForStatement extends CTemplateBase {
    public init: CExpression;
    public condition: CExpression;
    public increment: CExpression;
    public block: CBlock;
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    public varDecl: CVariableDeclaration = null;
    constructor(scope: IScope, node: kataw.ForStatement, public continueLabel?: string) {
        super();
        this.block = new CBlock(scope, node.statement);
        this.variables = this.block.variables;
        this.statements = this.block.statements;
        if (!node.initializer)
            this.init = "";
        else if (isSimpleInitializer(node.initializer)) {
            this.varDecl = new CVariableDeclaration(scope, getVarDeclFromSimpleInitializer(node.initializer));
            this.init = "";
        }
        else
            this.init = CodeTemplateFactory.createForNode(scope, node.initializer);
        this.condition = node.condition ? new CCondition(scope, node.condition) : "";
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
`, kataw.SyntaxKind.ForOfStatement)
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
    constructor(scope: IScope, node: kataw.ForOfStatement, public continueLabel?: string) {
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

        this.init = getForOfOrInInitializer(scope, node.initializer);

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
`, kataw.SyntaxKind.ForInStatement)
export class CForInStatement extends CTemplateBase implements IScope {
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    public iteratorVarName: string;
    public varAccess: CElementAccess;
    public init: CElementAccess | string;
    constructor(scope: IScope, node: kataw.ForInStatement, public continueLabel?: string) {
        super();
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        this.iteratorVarName = scope.root.symbolsHelper.addIterator(node);
        scope.variables.push(new CVariable(scope, this.iteratorVarName, NumberVarType));
        this.varAccess = new CElementAccess(scope, node.expression);

        this.init = getForOfOrInInitializer(scope, node.initializer);

        if (node.statement.kind == kataw.SyntaxKind.BlockStatement)
        {
            let blockStatement = <kataw.BlockStatement>node.statement;
            for (let s of blockStatement.block.statements)
                this.statements.push(CodeTemplateFactory.createForNode(this, s));
        }
        else
            this.statements.push(CodeTemplateFactory.createForNode(this, node.statement));
        scope.variables = scope.variables.concat(this.variables);
        this.variables = [];
    }
}

function getForOfOrInInitializer(scope: IScope, initializer: kataw.ForBinding | kataw.LexicalDeclaration | kataw.ExpressionNode) {
    if (isSimpleInitializer(initializer)) {
        const declInit = getVarDeclFromSimpleInitializer(initializer);
        if (declInit && kataw.isIdentifier(declInit.binding)) {
            scope.variables.push(new CVariable(scope, declInit.binding.text, declInit.binding));
            return declInit.binding.text;
        } else
            return '/* Unsupported for loop initializer ' + getNodeText(initializer) + ' */'
    } else if (kataw.isExpressionNode(initializer))
        return new CElementAccess(scope, <kataw.ExpressionNode>initializer);
    else
        return '/* Unsupported for loop initializer ' + getNodeText(initializer) + ' */'
}

@CodeTemplate(`{expression}{SemicolonCR}`, kataw.SyntaxKind.ExpressionStatement)
export class CExpressionStatement extends CTemplateBase {
    public expression: CExpression;
    public SemicolonCR: string = ';\n';
    constructor(scope: IScope, node: kataw.ExpressionStatement) {
        super();
        if (isBinaryExpression(node.expression)) {
            let binExpr = node.expression;
            if (binExpr.operatorToken.kind == kataw.SyntaxKind.Assign) {
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
{/if}`, kataw.SyntaxKind.BlockStatement)
export class CBlock extends CTemplateBase implements IScope {
    public variables: CVariable[] = [];
    public statements: CExpression[] = [];
    public parent: IScope;
    public func: IScope;
    public root: CProgram;
    constructor(scope: IScope, node: kataw.StatementNode) {
        super();
        this.parent = scope;
        this.func = scope.func;
        this.root = scope.root;
        if (node.kind === kataw.SyntaxKind.BlockStatement) {
            (<kataw.BlockStatement>node).block.statements.forEach(s => this.statements.push(CodeTemplateFactory.createForNode(this, s)));
        }
        else
            this.statements.push(CodeTemplateFactory.createForNode(this, node));
    }
}

@CodeTemplate(`
{#if nodeText}
    /* Unsupported import {nodeText} */
{/if}
`, kataw.SyntaxKind.ImportDeclaration)
export class CImport extends CTemplateBase {
    public nodeText: string = null;
    constructor(scope: IScope, node: kataw.ImportDeclaration) {
        super();
        let moduleNameNode = node.moduleSpecifier;
        if (moduleNameNode === null)
            moduleNameNode = node.fromClause.from;
        if (!isStringLiteral(moduleNameNode)) {
            this.nodeText = getNodeText(node);
            return;
        }

        let moduleName = moduleNameNode.text;
        const isLibInclude = moduleName.indexOf('ts2c-target') === 0;
        if (isLibInclude) {
            moduleName = moduleName.split('/').slice(1).join('/');
            if (moduleName.slice(-6) == "/index")
                moduleName = moduleName.slice(0, -6);
            moduleName = "<" + moduleName + ">";
            if (scope.root.includes.indexOf(moduleName) === -1)
                scope.root.includes.push(moduleName);
        } else {
            moduleName = '"' + moduleName.replace(/^\.\//, '') + '.h"';
            if (scope.root.includes.indexOf(moduleName) === -1)
                scope.root.includes.push(moduleName);
        }
    }
}

@CodeTemplate(`{declaration}`, kataw.SyntaxKind.ExportDeclaration)
export class CExport extends CTemplateBase {
    public declaration: CExpression = null;
    public nodeText: string = null;
    constructor(scope: IScope, node: kataw.ExportDeclaration) {
        super();
        this.declaration = CodeTemplateFactory.createForNode(scope, node.declaration);
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
`, kataw.SyntaxKind.TryStatement)
export class CTryStatement extends CTemplateBase {
    public tryBlock: CBlock;
    public catchBlock: CBlock | string;
    public finallyBlock: CBlock | string;
    public catchVarName: string;
    constructor(scope: IScope, node: kataw.TryStatement) {
        super();
        this.tryBlock = new CBlock(scope, node.block);
        this.catchBlock = node.catchClause ? new CBlock(scope, node.catchClause.block) : "";
        this.finallyBlock = node.finallyBlock ? new CBlock(scope, node.finallyBlock) : "";
        this.catchVarName = node.catchClause && node.catchClause.catchParameter && kataw.isIdentifier(node.catchClause.catchParameter) && node.catchClause.catchParameter.text;
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
`, kataw.SyntaxKind.ThrowStatement)
export class CThrowStatement extends CTemplateBase {
    public value: CExpression;
    constructor(scope: IScope, node: kataw.ThrowStatement) {
        super();
        this.value = CodeTemplateFactory.createForNode(scope, node.expression);
        scope.root.headerFlags.try_catch = true;
    }
}
