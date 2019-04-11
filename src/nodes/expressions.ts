import { AssignmentHelper } from './assignment';
import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {IScope} from '../program';
import {StringVarType, RegexVarType, NumberVarType, UniversalVarType, BooleanVarType, ArrayType, StructType, DictType, toNumberCanBeNaN, operandsToNumber} from '../types';
import {CVariable} from './variable';
import {CRegexAsString} from './regexfunc';
import { CString } from './literals';
import { CAsNumber, CAsString_Length, CAsString_Concat, CAsUniversalVar, CAsString } from './typeconvert';
import { isCompoundAssignment, isNumberOp, isIntegerOp, isRelationalOp, isEqualityOp, isLogicOp, isInBoolContext, isSimpleNode } from '../typeguards';
import { CArraySize } from './elementaccess';
import { StandardCallHelper } from '../standard';

export interface CExpression { }

@CodeTemplate(`
{#if universalWrapper}
    js_var_to_bool({expression})
{#elseif isString && expressionIsIdentifier}
    *{expression}
{#elseif isString}
    *({expression})
{#else}
    {expression}
{/if}`)
export class CCondition {
    public universalWrapper: boolean = false;
    public isString: boolean = false;
    public expression: CExpression;
    public expressionIsIdentifier: boolean = false;
    constructor(scope: IScope, node: ts.Expression) {
        this.expression = CodeTemplateFactory.createForNode(scope, node);
        this.expressionIsIdentifier = ts.isIdentifier(node);
        const type = scope.root.typeHelper.getCType(node);
        this.isString = type == StringVarType;
        if (type == UniversalVarType) {
            this.universalWrapper = true;
            scope.root.headerFlags.js_var_to_bool = true;
        }
    }
}

@CodeTemplate(`
{#if expression}
    {expression}
{#else}
    /* unsupported expression {nodeText} */
{/if}`, ts.SyntaxKind.BinaryExpression)
export class CBinaryExpression {
    public expression: CExpression = null;
    public operator: string;
    public left: CExpression;
    public right: CExpression;
    public nodeText: string;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        if (node.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
            this.expression = AssignmentHelper.create(scope, node.left, node.right, true);
            return;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.CommaToken) {
            let nodeAsStatement = <ts.ExpressionStatement>ts.createNode(ts.SyntaxKind.ExpressionStatement);
            nodeAsStatement.expression = node.left;
            nodeAsStatement.parent = node.getSourceFile();
            scope.statements.push(CodeTemplateFactory.createForNode(scope, nodeAsStatement));
            this.expression = CodeTemplateFactory.createForNode(scope, node.right);
            return;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
            this.expression = new CPlusExpression(scope, node);
            return;
        }
        if (node.operatorToken.kind == ts.SyntaxKind.PlusEqualsToken) {
            const left = CodeTemplateFactory.createForNode(scope, node.left);
            const right = new CPlusExpression(scope, node);
            this.expression = "(" + CodeTemplateFactory.templateToString(left) + " = " + CodeTemplateFactory.templateToString(<any>right) + ")";
        }
        if (isNumberOp(node.operatorToken.kind) || isIntegerOp(node.operatorToken.kind)) {
            this.expression = new CArithmeticExpression(scope, node);
            return;
        }
        if (isRelationalOp(node.operatorToken.kind)) {
            this.expression = new CRelationalExpression(scope, node);
            return;
        }
        if (isEqualityOp(node.operatorToken.kind)) {
            this.expression = new CEqualityExpression(scope, node);
            return;
        }
        if (node.operatorToken.kind === ts.SyntaxKind.InKeyword) {
            this.expression = new CInExpression(scope, node);
            return;
        }
        if (isLogicOp(node.operatorToken.kind)) {
            this.expression = new CLogicExpession(scope, node);
            return;
        }

        this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
    }
}

@CodeTemplate(`
{#statements}
    {#if leftVarName}
        {leftVarName} = {left};
    {/if}
    {#if rightVarName}
        {rightVarName} = {right};
    {/if}
{/statements}
{#if isBoolContext}
    {left} {operator} {right}
{#else}
    {condition} ? {whenTrue} : {whenFalse}
{/if}`)
class CLogicExpession {
    public isBoolContext: boolean;
    public operator: string;
    public left: CExpression;
    public right: CExpression;
    public leftVarName: string = "";
    public rightVarName: string = "";
    public condition: CExpression;
    public whenTrue: CExpression;
    public whenFalse: CExpression;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        const type = scope.root.typeHelper.getCType(node);
        
        if (type === UniversalVarType) {
            this.left = new CAsUniversalVar(scope, node.left);
            this.right = new CAsUniversalVar(scope, node.right);
        } else {
            this.left = CodeTemplateFactory.createForNode(scope, node.left);
            this.right = CodeTemplateFactory.createForNode(scope, node.right);
        }

        this.isBoolContext = isInBoolContext(node) && type !== UniversalVarType;
        const isOr = node.operatorToken.kind === ts.SyntaxKind.BarBarToken;

        if (this.isBoolContext) {
            this.operator = isOr ? "||" : "&&";
        } else {
            if (!isSimpleNode(node.left))
            {
                this.leftVarName = scope.root.symbolsHelper.addTemp(node, "tmp1");
                scope.variables.push(new CVariable(scope, this.leftVarName, type));
            }
            if (!isSimpleNode(node.right))
            {
                this.rightVarName = scope.root.symbolsHelper.addTemp(node, "tmp2");
                scope.variables.push(new CVariable(scope, this.rightVarName, type));
            }

            if (this.leftVarName && type === UniversalVarType) {
                this.condition = "js_var_to_bool(" + this.leftVarName + ")";
                scope.root.headerFlags.js_var_to_bool = true;
            }
            else
                this.condition = this.leftVarName || new CCondition(scope, node.left);

            if (isOr) {
                this.whenTrue = this.leftVarName || this.left;
                this.whenFalse = this.rightVarName || this.right;
            } else {
                this.whenTrue = this.rightVarName || this.right;
                this.whenFalse = this.leftVarName || this.left;
            }
        }
    }

}

@CodeTemplate(`
{#if operator}
    {left} {operator} {right}
{#elseif computeOperation && isCompoundAssignment}
    {left} = js_var_compute({left}, {computeOperation}, {right})
{#elseif computeOperation}
    js_var_compute({left}, {computeOperation}, {right})
{#else}
    /* unsupported arithmetic expression {nodeText} */
{/if}`)
class CArithmeticExpression {
    public isCompoundAssignment;
    public operator: string = null;
    public computeOperation: string = null;
    public left: CExpression;
    public right: CExpression;
    public nodeText: string;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        let leftType = scope.root.typeHelper.getCType(node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        this.isCompoundAssignment = isCompoundAssignment(node.operatorToken);
        
        if (toNumberCanBeNaN(leftType) || toNumberCanBeNaN(rightType)) {
            const js_var_operator_map = {
                [ts.SyntaxKind.AsteriskToken]: "JS_VAR_ASTERISK",
                [ts.SyntaxKind.AsteriskEqualsToken]: "JS_VAR_ASTERISK",
                [ts.SyntaxKind.SlashToken]: "JS_VAR_SLASH",
                [ts.SyntaxKind.SlashEqualsToken]: "JS_VAR_SLASH",
                [ts.SyntaxKind.PercentToken]: "JS_VAR_PERCENT",
                [ts.SyntaxKind.PercentEqualsToken]: "JS_VAR_PERCENT",
                [ts.SyntaxKind.MinusToken]: "JS_VAR_MINUS",
                [ts.SyntaxKind.MinusEqualsToken]: "JS_VAR_MINUS",
                [ts.SyntaxKind.LessThanLessThanToken]: "JS_VAR_SHL",
                [ts.SyntaxKind.LessThanLessThanEqualsToken]: "JS_VAR_SHL",
                [ts.SyntaxKind.GreaterThanGreaterThanToken]: "JS_VAR_SHR",
                [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: "JS_VAR_SHR",
                [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: "JS_VAR_USHR",
                [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: "JS_VAR_USHR",
                [ts.SyntaxKind.BarToken]: "JS_VAR_OR",
                [ts.SyntaxKind.BarEqualsToken]: "JS_VAR_OR",
                [ts.SyntaxKind.AmpersandToken]: "JS_VAR_AND",
                [ts.SyntaxKind.AmpersandEqualsToken]: "JS_VAR_AND"
            };
            
            this.computeOperation = js_var_operator_map[node.operatorToken.kind];
            this.left = new CAsUniversalVar(scope, node.left);
            this.right = new CAsUniversalVar(scope, node.right);
            scope.root.headerFlags.js_var_compute = true;
        } else {
            this.operator = node.operatorToken.getText();
            this.left = new CAsNumber(scope, node.left);
            this.right = new CAsNumber(scope, node.right);

            if (node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken
                || node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken)
            {
                this.operator = ">>";
                const leftAsString = CodeTemplateFactory.templateToString(this.left as any);
                this.left = "((uint16_t)" + leftAsString + ")";
                if (node.operatorToken.kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken)
                    this.left = leftAsString + " = " + this.left;
                scope.root.headerFlags.uint16_t = true;
            }
        }
        this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
    }
}


@CodeTemplate(`
{#if operator}
    {left} {operator} {right}
{#elseif stringCondition}
    strcmp({left}, {right}) {stringCondition}
{#elseif universalCondition}
    js_var_lessthan({left}, {right}) {universalCondition}
{#else}
    /* unsupported relational expression {nodeText} */
{/if}`)
class CRelationalExpression {
    public operator: string = null;
    public universalCondition: string = null;
    public stringCondition: string = null;
    public left: CExpression;
    public right: CExpression;
    public nodeText: string;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        let leftType = scope.root.typeHelper.getCType(node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        
        if (leftType === UniversalVarType || rightType === UniversalVarType) {
            switch(node.operatorToken.kind) {
                case ts.SyntaxKind.LessThanToken:
                    this.left = new CAsUniversalVar(scope, node.left);
                    this.right = new CAsUniversalVar(scope, node.right);
                    this.universalCondition = "> 0";
                    break;
                case ts.SyntaxKind.LessThanEqualsToken:
                    // notice operands are swapped
                    this.left = new CAsUniversalVar(scope, node.right);
                    this.right = new CAsUniversalVar(scope, node.left);
                    this.universalCondition = "< 0";
                    break;
                case ts.SyntaxKind.GreaterThanToken:
                    // notice operands are swapped
                    this.left = new CAsUniversalVar(scope, node.right);
                    this.right = new CAsUniversalVar(scope, node.left);
                    this.universalCondition = "> 0";
                    break;
                case ts.SyntaxKind.GreaterThanEqualsToken:
                    this.left = new CAsUniversalVar(scope, node.left);
                    this.right = new CAsUniversalVar(scope, node.right);
                    this.universalCondition = "< 0";
                    break;
            }
            
            scope.root.headerFlags.js_var_lessthan = true;
        } else if (leftType === StringVarType && rightType === StringVarType) {
            this.stringCondition = node.operatorToken.getText() + " 0";
            this.left = CodeTemplateFactory.createForNode(scope, node.left);
            this.right = CodeTemplateFactory.createForNode(scope, node.right);
            scope.root.headerFlags.strings = true;
        } else {
            this.operator = node.operatorToken.getText();
            this.left = new CAsNumber(scope, node.left);
            this.right = new CAsNumber(scope, node.right);
        }
        this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
    }
}

@CodeTemplate(`
{#if expression}
    {expression}
{#elseif operator}
    {left} {operator} {right}
{#elseif stringCondition}
    strcmp({left}, {right}) {stringCondition}
{#elseif strNumCondition}
    str_int16_t_cmp({left}, {right}) {strNumCondition}
{#elseif universalCondition}
    js_var_eq({left}, {right}, {strict}) {universalCondition}
{#else}
    /* unsupported equality expression {nodeText} */
{/if}`)
class CEqualityExpression {
    public expression: string = null;
    public operator: string = null;
    public stringCondition: string = null;
    public strNumCondition: string = null;
    public universalCondition: string = null;
    public strict: string = null;
    public left: CExpression;
    public right: CExpression;
    public nodeText: string;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        const leftType = scope.root.typeHelper.getCType(node.left);
        const rightType = scope.root.typeHelper.getCType(node.right);

        const notEquals = node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken;
        this.strict = node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ? "TRUE" : "FALSE";

        this.left = CodeTemplateFactory.createForNode(scope, node.left);
        this.right = CodeTemplateFactory.createForNode(scope, node.right);

        if ((leftType == NumberVarType || leftType == BooleanVarType) && (rightType == NumberVarType || rightType == BooleanVarType)) {
            this.operator = notEquals ? "!=" : "==";
        }
        else if (leftType == StringVarType && rightType == StringVarType) {
            this.stringCondition = notEquals ? "!= 0" : "== 0";
            scope.root.headerFlags.strings = true;
        }
        else if (leftType == NumberVarType && rightType == StringVarType
            || leftType == StringVarType && rightType == NumberVarType) {

            this.strNumCondition = notEquals ? "!= 0" : "== 0";
            scope.root.headerFlags.str_int16_t_cmp = true;
            // str_int16_t_cmp expects certain order of arguments (string, number)
            if (leftType == NumberVarType) {
                const tmp = this.left;
                this.left = this.right;
                this.right = tmp;
            }

        }
        else if (leftType == UniversalVarType || rightType == UniversalVarType) {
            this.universalCondition = notEquals ? "== FALSE" : "== TRUE";
            this.left = new CAsUniversalVar(scope, this.left, leftType);
            this.right = new CAsUniversalVar(scope, this.right, rightType);
            scope.root.headerFlags.js_var_eq = true;

        } else if (leftType instanceof StructType || leftType instanceof ArrayType || leftType instanceof DictType
                || rightType instanceof StructType || rightType instanceof ArrayType || rightType instanceof DictType) {

            if (leftType != rightType) {
                this.expression = notEquals ? "TRUE" : "FALSE";
                scope.root.headerFlags.bool = true;
            } else
                this.operator = notEquals ? "!=" : "==";
        }
        this.nodeText = node.flags & ts.NodeFlags.Synthesized ? "(synthesized node)" : node.getText();
    }
}

@CodeTemplate(`
{#statements}
    {#if replacedWithVar}
        {replacementVarName} = malloc({strlen_left} + {strlen_right} + 1);
        assert({replacementVarName} != NULL);
        {replacementVarName}[0] = '\\0';
        {strcat_left}
        {strcat_right}
    {/if}
    {#if replacedWithVar && gcVarName}
        ARRAY_PUSH({gcVarName}, {replacementVarName});
    {/if}

{/statements}
{#if addNumbers}
    {left} + {right}
{#elseif replacedWithVar}
    {replacementVarName}
{#elseif isUniversalVar}
    js_var_plus({left}, {right})
{/if}`)
class CPlusExpression {
    public addNumbers: boolean = false;
    public isUniversalVar: boolean = false;
    public replacedWithVar: boolean = false;
    public replacementVarName: string = null;
    public gcVarName: string = null;
    public left: CExpression;
    public right: CExpression;
    public strcat_left: CExpression;
    public strcat_right: CExpression;
    public strlen_left: CExpression;
    public strlen_right: CExpression;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        let leftType = scope.root.typeHelper.getCType(node.left);
        this.left = CodeTemplateFactory.createForNode(scope, node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        this.right = CodeTemplateFactory.createForNode(scope, node.right);

        if (leftType == RegexVarType) {
            leftType = StringVarType;
            this.left = new CRegexAsString(this.left);
        }
        if (rightType == RegexVarType) {
            rightType = StringVarType;
            this.right = new CRegexAsString(this.right);
        }

        if ((leftType === NumberVarType || leftType === BooleanVarType) && (rightType === NumberVarType || rightType === BooleanVarType)) {
            this.addNumbers = true;
        }
        else if (leftType === UniversalVarType || rightType === UniversalVarType) {
            this.isUniversalVar = true;
            this.left = new CAsUniversalVar(scope, this.left, leftType);
            this.right = new CAsUniversalVar(scope, this.right, rightType);
            scope.root.headerFlags.js_var_plus = true;
        }
        else {
            let tempVarName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            scope.func.variables.push(new CVariable(scope, tempVarName, "char *", { initializer: "NULL" }));
            this.gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
            this.replacedWithVar = true;
            this.replacementVarName = tempVarName;

            this.strlen_left = new CAsString_Length(scope, node.left, this.left, leftType);
            this.strlen_right = new CAsString_Length(scope, node.right, this.right, rightType);

            this.strcat_left = new CAsString_Concat(scope, node.left, tempVarName, this.left, leftType);
            this.strcat_right = new CAsString_Concat(scope, node.right, tempVarName, this.right, rightType);

            scope.root.headerFlags.strings = true;
            scope.root.headerFlags.malloc = true;
            scope.root.headerFlags.str_int16_t_cat = true;

            if (this.gcVarName) {
                scope.root.headerFlags.gc_iterator = true;
                scope.root.headerFlags.array = true;
            }
        }

    }
}

@CodeTemplate(`
{#statements}
    {#if tmpVarName}
        {tmpVarName} = {key};
    {/if}
{/statements}
{#if result}
    {result}
{#elseif isArray && tmpVarName}
    ({tmpVarName}.type != JS_VAR_NAN && {tmpVarName}.number >= 0 && {tmpVarName}.number < {arraySize})
{#elseif isArray && !tmpVarName}
    ({key} >= 0 && {key} < {arraySize})
{#elseif isStruct}
    dict_find_pos({propertiesVarName}, {propertiesCount}, {key}) > -1
{#elseif isDict}
    dict_find_pos({obj}->index->data, {obj}->index->size, {key}) > -1
{#elseif isUniversalVar}
    js_var_get({obj}, {key}).type != JS_VAR_UNDEFINED
{#else}
    /* unsupported 'in' expression {nodeText} */
{/if}`)
class CInExpression {
    public isArray: boolean = false;
    public arraySize: CArraySize;
    public isStruct: boolean = false;
    public propertiesVarName: string;
    public propertiesCount: string;
    public isDict: boolean = false;
    public isUniversalVar: boolean = false;
    public result: string = null;
    public obj: CExpression;
    public key: CExpression;
    public tmpVarName: string = null;
    public nodeText: string;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        const type = scope.root.typeHelper.getCType(node.right);
        this.obj = CodeTemplateFactory.createForNode(scope, node.right);
        if (type instanceof ArrayType) {
            this.isArray = true;
            this.arraySize = new CArraySize(scope, this.obj, type);
            this.key = new CAsNumber(scope, node.left);
            const keyType = scope.root.typeHelper.getCType(node.left);
            if (toNumberCanBeNaN(keyType)) {
                this.tmpVarName = scope.root.symbolsHelper.addTemp(node, "tmp_key");
                scope.variables.push(new CVariable(scope, this.tmpVarName, UniversalVarType));
            }
        } else {
            this.key = new CAsString(scope, node.left);
        }
        if (type instanceof StructType) {
            this.isStruct = true;
            const propTypes = Object.keys(type.properties);
            if (propTypes.length == 0) {
                this.result = "FALSE";
                scope.root.headerFlags.bool = true;
            } else {
                const initializer = "{ " + propTypes.sort().map(p => '"' + p + '"').join(", ") + " }";
                this.propertiesVarName = type.structName + "_props";
                this.propertiesCount = propTypes.length + "";
                if (!scope.root.variables.some(v => v.name === this.propertiesVarName))
                    scope.root.variables.push(new CVariable(scope, this.propertiesVarName, "const char *{var}[" + this.propertiesCount + "]", { initializer }));
                scope.root.headerFlags.dict_find_pos = true;
            }
        }
        this.isDict = type instanceof DictType;
        this.isUniversalVar = type === UniversalVarType;

        if (ts.isStringLiteral(node.left)) {
            const ident = ts.createIdentifier(node.left.text);
            const propAccess = ts.createPropertyAccess(node.right, ident);
            const standardCall = ts.createCall(propAccess,[],[]);
            ident.parent = propAccess;
            ident.getText = () => ident.text;
            propAccess.parent = standardCall;
            propAccess.getText = () => "(" + node.right.getText() + ")." + ident.text;
            standardCall.parent = node.parent;
            standardCall.getText = () => propAccess.getText() + "()";
            if (StandardCallHelper.isStandardCall(scope.root.typeHelper, standardCall))
                this.result = "TRUE";
        }
        
        if (this.isArray && ts.isStringLiteral(node.left) && node.left.text === "length")
            this.result = "TRUE";
     
        this.nodeText = node.getText();
    }
}

@CodeTemplate(`
{#if isCompound}
    ({operand} = {before}{operand}{after})
{#else}
    {before}{operand}{after}
{/if}`, [ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression])
class CUnaryExpression {
    public before: string = "";
    public operand: CExpression;
    public after: string = "";
    public isPostfix: boolean;
    public isCompound: boolean = false;
    constructor(scope: IScope, node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression) {
        this.isPostfix = node.kind == ts.SyntaxKind.PostfixUnaryExpression;

        const type = scope.root.typeHelper.getCType(node.operand);
        if (node.operator === ts.SyntaxKind.PlusToken)
            this.operand = new CAsNumber(scope, node.operand);
        else if (node.operator === ts.SyntaxKind.MinusToken) {
            this.before = "-";
            this.operand = new CAsNumber(scope, node.operand);
            if (toNumberCanBeNaN(type)) {
                this.before = "js_var_compute(js_var_from_int16_t(0), JS_VAR_MINUS, ";
                this.after = ")";
                scope.root.headerFlags.js_var_compute = true;
                scope.root.headerFlags.js_var_from_int16_t = true;
            }
        } else if (node.operator === ts.SyntaxKind.TildeToken) {
            this.before = "~";
            this.operand = new CAsNumber(scope, node.operand);
            if (toNumberCanBeNaN(type))
                this.after = ".number";
        } else if (node.operator === ts.SyntaxKind.ExclamationToken) {
            this.before = "!";
            this.operand = new CCondition(scope, node.operand);
        } else if (node.operator === ts.SyntaxKind.PlusPlusToken) {
            if (this.isPostfix) {
                if (toNumberCanBeNaN(type))
                    this.operand = `/* not supported expression ${node.getText()} */`;
                else {
                    this.operand = new CAsNumber(scope, node.operand);
                    this.after = "++";
                }
            } else {
                if (toNumberCanBeNaN(type)) {
                    this.isCompound = true;
                    this.before = "js_var_plus(js_var_to_number(";
                    this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
                    this.after = "), js_var_from_int16_t(1))";
                    scope.root.headerFlags.js_var_plus = true;
                    scope.root.headerFlags.js_var_from_int16_t = true;
                } else {
                    this.before = "++";
                    this.operand = new CAsNumber(scope, node.operand);
                }
            }
        } else if (node.operator === ts.SyntaxKind.MinusMinusToken) {
            if (this.isPostfix) {
                if (toNumberCanBeNaN(type))
                    this.operand = `/* not supported expression ${node.getText()} */`;
                else {
                    this.operand = new CAsNumber(scope, node.operand);
                    this.after = "--";
                }
            } else {
                if (toNumberCanBeNaN(type)) {
                    this.isCompound = true;
                    this.before = "js_var_compute(";
                    this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
                    this.after = ", JS_VAR_MINUS, js_var_from_int16_t(1))";
                    scope.root.headerFlags.js_var_compute = true;
                    scope.root.headerFlags.js_var_from_int16_t = true;
                } else {
                    this.before = "--";
                    this.operand = new CAsNumber(scope, node.operand);
                }
            }
        }
    }
}

@CodeTemplate(`{condition} ? {whenTrue} : {whenFalse}`, ts.SyntaxKind.ConditionalExpression)
class CTernaryExpression {
    public condition: CExpression;
    public whenTrue: CExpression;
    public whenFalse: CExpression;
    constructor(scope: IScope, node: ts.ConditionalExpression) {
        this.condition = CodeTemplateFactory.createForNode(scope, node.condition);
        this.whenTrue = CodeTemplateFactory.createForNode(scope, node.whenTrue);
        this.whenFalse = CodeTemplateFactory.createForNode(scope, node.whenFalse);
    }
}

@CodeTemplate(`({expression})`, ts.SyntaxKind.ParenthesizedExpression)
class CGroupingExpression {
    public expression: CExpression;
    constructor(scope: IScope, node: ts.ParenthesizedExpression) {
        this.expression = CodeTemplateFactory.createForNode(scope, node.expression);
    }
}

@CodeTemplate(`
{#if isUniversalVar}
    js_var_typeof({expression})
{#elseif isString}
    "string"
{#elseif isNumber}
    "number"
{#elseif isBoolean}
    "number"
{#else}
    "object"
{/if}`, ts.SyntaxKind.TypeOfExpression)
class CTypeOf {
    expression: CExpression;
    isUniversalVar: boolean;
    isNumber: boolean;
    isBoolean: boolean;
    isString: boolean;
    constructor(scope: IScope, node: ts.TypeOfExpression) {
        const type = scope.root.typeHelper.getCType(node.expression);
        this.isUniversalVar = type === UniversalVarType;
        this.isString = type === StringVarType;
        this.isNumber = type === NumberVarType;
        this.isBoolean = type === BooleanVarType;
        this.expression = CodeTemplateFactory.createForNode(scope, node.expression);

        if (type == UniversalVarType) {
            scope.root.headerFlags.js_var = true;
            scope.root.headerFlags.js_var_typeof = true;
        }
    }
}

@CodeTemplate(`js_var_to_undefined({expression})`, ts.SyntaxKind.VoidExpression)
class CVoid {
    public expression: CExpression;
    constructor(scope: IScope, node: ts.TypeOfExpression) {
        this.expression = CodeTemplateFactory.createForNode(scope, node.expression);
        scope.root.headerFlags.js_var = true;
        scope.root.headerFlags.js_var_to_undefined = true;
    }
}

@CodeTemplate(`
{#statements}
    {tempVarName} = dict_find_pos({dict}->index->data, {dict}->index->size, {argExpression});
    if ({tempVarName} >= 0)
    {
        ARRAY_REMOVE({dict}->index, {tempVarName}, 1);
        ARRAY_REMOVE({dict}->values, {tempVarName}, 1);
    }
{/statements}
{#if !topExpressionOfStatement}
    TRUE
{/if}`, ts.SyntaxKind.DeleteExpression)
class CDelete {
    public dict: CExpression;
    public argExpression: CExpression;
    public tempVarName: string;
    public topExpressionOfStatement: boolean;
    constructor(scope: IScope, node: ts.DeleteExpression) {
        this.topExpressionOfStatement = node.parent.kind == ts.SyntaxKind.ExpressionStatement;
        this.dict = (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
            && CodeTemplateFactory.createForNode(scope, node.expression.expression);
        if (ts.isElementAccessExpression(node.expression))
            this.argExpression = ts.isNumericLiteral(node.expression.argumentExpression)
                ? '"' + node.expression.argumentExpression.text + '"' 
                : CodeTemplateFactory.createForNode(scope, node.expression.argumentExpression)
        else if (ts.isPropertyAccessExpression(node.expression))
            this.argExpression = new CString(scope, node.expression.name.text);
        this.tempVarName = scope.root.symbolsHelper.addTemp(node, "tmp_dict_pos");
        scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
        scope.root.headerFlags.bool = true;
        scope.root.headerFlags.array_remove = true;
    }
}

