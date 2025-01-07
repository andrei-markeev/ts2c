import * as kataw from '@andrei-markeev/kataw';
import { AssignmentHelper } from './assignment';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../template';
import { IScope } from '../program';
import { StringVarType, RegexVarType, NumberVarType, UniversalVarType, BooleanVarType, ArrayType, StructType, DictType } from '../types/ctypes';
import { CVariable } from './variable';
import { CRegexAsString } from './regexfunc';
import { CString } from './literals';
import { CAsNumber, CAsString_Length, CAsString_Concat, CAsUniversalVar, CAsString } from './typeconvert';
import { isCompoundAssignment, isNumberOp, isIntegerOp, isRelationalOp, isEqualityOp, isLogicOp, isInBoolContext, isSimpleNode, toNumberCanBeNaN, getNodeText, isStringLiteral, isFieldPropertyAccess, isFieldAccess, isFieldElementAccess, isNumericLiteral } from '../types/utils';
import { CArraySize } from './elementaccess';

export type CExpression = string | CTemplateBase;

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
export class CCondition extends CTemplateBase {
    public universalWrapper: boolean = false;
    public isString: boolean = false;
    public expression: CExpression;
    public expressionIsIdentifier: boolean = false;
    constructor(scope: IScope, node: kataw.ExpressionNode) {
        super();
        this.expression = CodeTemplateFactory.createForNode(scope, node);
        this.expressionIsIdentifier = kataw.isIdentifier(node);
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
{/if}`, [kataw.SyntaxKind.BinaryExpression, kataw.SyntaxKind.AssignmentExpression])
export class CBinaryExpression extends CTemplateBase {
    public expression: CExpression = null;
    public operator: string;
    public left: CExpression;
    public right: CExpression;
    public nodeText: string;
    constructor(scope: IScope, node: kataw.BinaryExpression | kataw.AssignmentExpression) {
        super();
        if (node.operatorToken.kind === kataw.SyntaxKind.Assign) {
            this.expression = AssignmentHelper.create(scope, node.left, node.right, true);
            return;
        }
        if (node.operatorToken.kind === kataw.SyntaxKind.Comma) {
            let nodeAsStatement = <kataw.ExpressionStatement>kataw.createExpressionStatement(node.left, -1, -1);
            let statementNode = node.parent;
            while (statementNode.parent && (statementNode.flags & kataw.NodeFlags.IsStatement) !== kataw.NodeFlags.IsStatement) {
                statementNode = statementNode.parent;
            }
            nodeAsStatement.parent = statementNode.parent;
            scope.statements.push(CodeTemplateFactory.createForNode(scope, nodeAsStatement));
            this.expression = CodeTemplateFactory.createForNode(scope, node.right);
            return;
        }
        if (node.operatorToken.kind === kataw.SyntaxKind.Add) {
            this.expression = new CPlusExpression(scope, node);
            return;
        }
        if (node.operatorToken.kind === kataw.SyntaxKind.AddAssign) {
            const left = CodeTemplateFactory.createForNode(scope, node.left);
            const right = new CPlusExpression(scope, node);
            this.expression = "(" + CodeTemplateFactory.templateToString(left) + " = " + CodeTemplateFactory.templateToString(right) + ")";
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
        if (node.operatorToken.kind === kataw.SyntaxKind.InKeyword) {
            this.expression = new CInExpression(scope, node);
            return;
        }
        if (isLogicOp(node.operatorToken.kind)) {
            this.expression = new CLogicExpession(scope, node);
            return;
        }

        this.nodeText = getNodeText(node);
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
class CLogicExpession extends CTemplateBase {
    public isBoolContext: boolean;
    public operator: string;
    public left: CExpression;
    public right: CExpression;
    public leftVarName: string = "";
    public rightVarName: string = "";
    public condition: CExpression;
    public whenTrue: CExpression;
    public whenFalse: CExpression;
    constructor(scope: IScope, node: kataw.BinaryExpression) {
        super();
        const type = scope.root.typeHelper.getCType(node);
        
        if (type === UniversalVarType) {
            this.left = new CAsUniversalVar(scope, node.left);
            this.right = new CAsUniversalVar(scope, node.right);
        } else {
            this.left = CodeTemplateFactory.createForNode(scope, node.left);
            this.right = CodeTemplateFactory.createForNode(scope, node.right);
        }

        this.isBoolContext = isInBoolContext(node) && type !== UniversalVarType;
        const isOr = node.operatorToken.kind === kataw.SyntaxKind.LogicalOr;

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
class CArithmeticExpression extends CTemplateBase {
    public isCompoundAssignment;
    public operator: string = null;
    public computeOperation: string = null;
    public left: CExpression;
    public right: CExpression;
    public nodeText: string;
    constructor(scope: IScope, node: kataw.BinaryExpression) {
        super();
        let leftType = scope.root.typeHelper.getCType(node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        this.isCompoundAssignment = isCompoundAssignment(node.operatorToken);
        
        if (toNumberCanBeNaN(leftType) || toNumberCanBeNaN(rightType)) {
            const js_var_operator_map = {
                [kataw.SyntaxKind.Multiply]: "JS_VAR_ASTERISK",
                [kataw.SyntaxKind.MultiplyAssign]: "JS_VAR_ASTERISK",
                [kataw.SyntaxKind.Divide]: "JS_VAR_SLASH",
                [kataw.SyntaxKind.DivideAssign]: "JS_VAR_SLASH",
                [kataw.SyntaxKind.Modulo]: "JS_VAR_PERCENT",
                [kataw.SyntaxKind.ModuloAssign]: "JS_VAR_PERCENT",
                [kataw.SyntaxKind.Subtract]: "JS_VAR_MINUS",
                [kataw.SyntaxKind.SubtractAssign]: "JS_VAR_MINUS",
                [kataw.SyntaxKind.ShiftLeft]: "JS_VAR_SHL",
                [kataw.SyntaxKind.ShiftLeftAssign]: "JS_VAR_SHL",
                [kataw.SyntaxKind.ShiftRight]: "JS_VAR_SHR",
                [kataw.SyntaxKind.ShiftRightAssign]: "JS_VAR_SHR",
                [kataw.SyntaxKind.LogicalShiftRight]: "JS_VAR_USHR",
                [kataw.SyntaxKind.LogicalShiftRightAssign]: "JS_VAR_USHR",
                [kataw.SyntaxKind.BitwiseOr]: "JS_VAR_OR",
                [kataw.SyntaxKind.BitwiseOrAssign]: "JS_VAR_OR",
                [kataw.SyntaxKind.BitwiseAnd]: "JS_VAR_AND",
                [kataw.SyntaxKind.BitwiseAndAssign]: "JS_VAR_AND"
            };
            
            this.computeOperation = js_var_operator_map[node.operatorToken.kind];
            this.left = new CAsUniversalVar(scope, node.left);
            this.right = new CAsUniversalVar(scope, node.right);
            scope.root.headerFlags.js_var_compute = true;
        } else {
            this.operator = kataw.tokenToString(node.operatorToken.kind);
            this.left = new CAsNumber(scope, node.left);
            this.right = new CAsNumber(scope, node.right);

            if (node.operatorToken.kind == kataw.SyntaxKind.LogicalShiftRight
                || node.operatorToken.kind == kataw.SyntaxKind.LogicalShiftRightAssign)
            {
                this.operator = ">>";
                const leftAsString = CodeTemplateFactory.templateToString(this.left);
                this.left = "((uint16_t)" + leftAsString + ")";
                if (node.operatorToken.kind == kataw.SyntaxKind.LogicalShiftRightAssign)
                    this.left = leftAsString + " = " + this.left;
                scope.root.headerFlags.uint16_t = true;
            }
        }
        this.nodeText = getNodeText(node);
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
class CRelationalExpression extends CTemplateBase {
    public operator: string = null;
    public universalCondition: string = null;
    public stringCondition: string = null;
    public left: CExpression;
    public right: CExpression;
    public nodeText: string;
    constructor(scope: IScope, node: kataw.BinaryExpression) {
        super();
        let leftType = scope.root.typeHelper.getCType(node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        
        if (leftType === UniversalVarType || rightType === UniversalVarType) {
            switch(node.operatorToken.kind) {
                case kataw.SyntaxKind.LessThan:
                    this.left = new CAsUniversalVar(scope, node.left);
                    this.right = new CAsUniversalVar(scope, node.right);
                    this.universalCondition = "> 0";
                    break;
                case kataw.SyntaxKind.LessThanOrEqual:
                    // notice operands are swapped
                    this.left = new CAsUniversalVar(scope, node.right);
                    this.right = new CAsUniversalVar(scope, node.left);
                    this.universalCondition = "< 0";
                    break;
                case kataw.SyntaxKind.GreaterThan:
                    // notice operands are swapped
                    this.left = new CAsUniversalVar(scope, node.right);
                    this.right = new CAsUniversalVar(scope, node.left);
                    this.universalCondition = "> 0";
                    break;
                case kataw.SyntaxKind.GreaterThanOrEqual:
                    this.left = new CAsUniversalVar(scope, node.left);
                    this.right = new CAsUniversalVar(scope, node.right);
                    this.universalCondition = "< 0";
                    break;
            }
            
            scope.root.headerFlags.js_var_lessthan = true;
        } else if (leftType === StringVarType && rightType === StringVarType) {
            this.stringCondition = kataw.tokenToString(node.operatorToken.kind) + " 0";
            this.left = CodeTemplateFactory.createForNode(scope, node.left);
            this.right = CodeTemplateFactory.createForNode(scope, node.right);
            scope.root.headerFlags.strings = true;
        } else {
            this.operator = kataw.tokenToString(node.operatorToken.kind);
            this.left = new CAsNumber(scope, node.left);
            this.right = new CAsNumber(scope, node.right);
        }
        this.nodeText = getNodeText(node);
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
class CEqualityExpression extends CTemplateBase {
    public expression: string = null;
    public operator: string = null;
    public stringCondition: string = null;
    public strNumCondition: string = null;
    public universalCondition: string = null;
    public strict: string = null;
    public left: CExpression;
    public right: CExpression;
    public nodeText: string;
    constructor(scope: IScope, node: kataw.BinaryExpression) {
        super();
        const leftType = scope.root.typeHelper.getCType(node.left);
        const rightType = scope.root.typeHelper.getCType(node.right);

        const notEquals = node.operatorToken.kind === kataw.SyntaxKind.StrictNotEqual || node.operatorToken.kind === kataw.SyntaxKind.LooseNotEqual;
        this.strict = node.operatorToken.kind === kataw.SyntaxKind.StrictNotEqual || node.operatorToken.kind === kataw.SyntaxKind.StrictEqual ? "TRUE" : "FALSE";

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
        } else
            this.nodeText = getNodeText(node);
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
    js_var_plus({left}, {right}, gc_main)
{/if}`)
class CPlusExpression extends CTemplateBase {
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
    constructor(scope: IScope, node: kataw.BinaryExpression) {
        super();
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
class CInExpression extends CTemplateBase {
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
    constructor(scope: IScope, node: kataw.BinaryExpression) {
        super();
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

        if (isStringLiteral(node.left)) {
            if (scope.root.standardCallHelper.matchStringPropName(node.right, node.left.text))
                this.result = "TRUE";
        }
        
        if (this.isArray && isStringLiteral(node.left) && node.left.text === "length")
            this.result = "TRUE";
     
        this.nodeText = getNodeText(node);
    }
}

@CodeTemplate(`
{#if isCompound}
    ({operand} = {before}{operand}{after})
{#elseif incrementBy && isPostfix}
    js_var_dict_inc({operand}, {argumentExpr}, {incrementBy}, TRUE)
{#elseif incrementBy}
    js_var_dict_inc({operand}, {argumentExpr}, {incrementBy}, FALSE)
{#else}
    {before}{operand}{after}
{/if}`, [kataw.SyntaxKind.UnaryExpression, kataw.SyntaxKind.PostfixUpdateExpression, kataw.SyntaxKind.PrefixUpdateExpression])
class CUnaryExpression extends CTemplateBase {
    public before: string = "";
    public operand: CExpression;
    public after: string = "";
    public argumentExpr: CExpression = null;
    public incrementBy: string = "";
    public isPostfix: boolean;
    public isCompound: boolean = false;
    constructor(scope: IScope, node: kataw.UnaryExpression | kataw.PostfixUpdateExpression | kataw.PrefixUpdateExpression) {
        super();
        this.isPostfix = node.kind === kataw.SyntaxKind.PostfixUpdateExpression;
        const isTopExpressionOfStatement = kataw.isStatementNode(node.parent);

        const type = scope.root.typeHelper.getCType(node.operand);
        if (node.operandToken.kind === kataw.SyntaxKind.Add)
            this.operand = new CAsNumber(scope, node.operand);
        else if (node.operandToken.kind === kataw.SyntaxKind.Subtract) {
            this.before = "-";
            this.operand = new CAsNumber(scope, node.operand);
            if (toNumberCanBeNaN(type)) {
                this.before = "js_var_compute(js_var_from_int16_t(0), JS_VAR_MINUS, ";
                this.after = ")";
                scope.root.headerFlags.js_var_compute = true;
                scope.root.headerFlags.js_var_from_int16_t = true;
            }
        } else if (node.operandToken.kind === kataw.SyntaxKind.Complement) {
            this.before = "~";
            this.operand = new CAsNumber(scope, node.operand);
            if (toNumberCanBeNaN(type))
                this.after = ".number";
        } else if (node.operandToken.kind === kataw.SyntaxKind.Negate) {
            this.before = "!";
            this.operand = new CCondition(scope, node.operand);
        } else if (node.operandToken.kind === kataw.SyntaxKind.VoidKeyword) {
            this.operand = new CVoid(scope, node);
        } else if (node.operandToken.kind === kataw.SyntaxKind.DeleteKeyword) {
            this.operand = new CDelete(scope, node);
        } else if (node.operandToken.kind === kataw.SyntaxKind.TypeofKeyword) {
            this.operand = new CTypeOf(scope, node);
        } else if (node.operandToken.kind === kataw.SyntaxKind.Increment || node.operandToken.kind === kataw.SyntaxKind.Decrement) {
            const plus = node.operandToken.kind === kataw.SyntaxKind.Increment;
            let accessObj = null, isDict = false;
            if (isFieldAccess(node.operand)) {
                this.argumentExpr = CodeTemplateFactory.createForNode(scope, node.operand.expression);
                accessObj = node.operand.member;
                isDict = scope.root.typeHelper.getCType(accessObj) instanceof DictType;
            }
            if (this.isPostfix) {
                if (!isDict && (type === NumberVarType || type === BooleanVarType)) {
                    this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
                    this.after = plus ? "++" : "--";
                } else if (isDict) {
                    this.operand = CodeTemplateFactory.createForNode(scope, accessObj);
                    this.incrementBy = plus ? "1" : "-1";
                    scope.root.headerFlags.js_var_dict_inc = true;
                } else if (type === UniversalVarType) {
                    this.before = "js_var_inc(&";
                    this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
                    this.after = ", " + (plus ? "1" : "-1") + ")";
                    scope.root.headerFlags.js_var_inc = true;
                } else {
                    this.operand = "/* expression is not yet supported " + getNodeText(node) + " */";
                }
            } else {
                if (!isDict && (type === NumberVarType || type === BooleanVarType)) {
                    this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
                    this.before = plus ? "++" : "--";
                } else if (!isDict && !toNumberCanBeNaN(type)) {
                    this.isCompound = true;
                    this.operand = new CAsNumber(scope, node.operand);
                    this.after = plus ? " + 1" : " - 1";
                } else if (isTopExpressionOfStatement) {
                    const operationToken = kataw.createToken(plus ? kataw.SyntaxKind.Add : kataw.SyntaxKind.Subtract, kataw.NodeFlags.NoChildren, -1, -1);
                    const incrementByNumericLiteral = kataw.createNumericLiteral(1, "1", kataw.NodeFlags.NoChildren, -1, -1);
                    const binExpr = kataw.createBinaryExpression(node.operand, operationToken, incrementByNumericLiteral, kataw.NodeFlags.ExpressionNode, -1, -1);
                    binExpr.parent = node;
                    scope.root.typeHelper.registerSyntheticNode(binExpr, UniversalVarType);
                    this.operand = AssignmentHelper.create(scope, node.operand, binExpr);
                } else if (!isDict && plus) {
                    this.isCompound = true;
                    this.before = "js_var_plus(js_var_to_number(";
                    this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
                    this.after = "), js_var_from_int16_t(1), gc_main)";
                    scope.root.headerFlags.js_var_plus = true;
                    scope.root.headerFlags.js_var_from_int16_t = true;
                } else if (!isDict && !plus) {
                    this.isCompound = true;
                    this.before = "js_var_compute(js_var_to_number(";
                    this.operand = CodeTemplateFactory.createForNode(scope, node.operand);
                    this.after = "), JS_VAR_MINUS, js_var_from_int16_t(1))";
                    scope.root.headerFlags.js_var_compute = true;
                    scope.root.headerFlags.js_var_from_int16_t = true;
                } else {
                    this.operand = CodeTemplateFactory.createForNode(scope, accessObj);
                    this.incrementBy = plus ? "1" : "-1";
                    scope.root.headerFlags.js_var_dict_inc = true;
                }
            }
        } else {
            this.operand = `/* not supported unary expression ${getNodeText(node)} */`;
        }
    }
}

@CodeTemplate(`{condition} ? {whenTrue} : {whenFalse}`, kataw.SyntaxKind.ConditionalExpression)
class CTernaryExpression extends CTemplateBase {
    public condition: CExpression;
    public whenTrue: CExpression;
    public whenFalse: CExpression;
    constructor(scope: IScope, node: kataw.ConditionalExpression) {
        super();
        this.condition = CodeTemplateFactory.createForNode(scope, node.shortCircuit);
        this.whenTrue = CodeTemplateFactory.createForNode(scope, node.consequent);
        this.whenFalse = CodeTemplateFactory.createForNode(scope, node.alternate);
    }
}

@CodeTemplate(`({expression})`, kataw.SyntaxKind.ParenthesizedExpression)
class CGroupingExpression extends CTemplateBase {
    public expression: CExpression;
    constructor(scope: IScope, node: kataw.ParenthesizedExpression) {
        super();
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
{/if}`)
class CTypeOf extends CTemplateBase {
    expression: CExpression;
    isUniversalVar: boolean;
    isNumber: boolean;
    isBoolean: boolean;
    isString: boolean;
    constructor(scope: IScope, node: kataw.UnaryExpression) {
        super();
        const type = scope.root.typeHelper.getCType(node.operand);
        this.isUniversalVar = type === UniversalVarType;
        this.isString = type === StringVarType;
        this.isNumber = type === NumberVarType;
        this.isBoolean = type === BooleanVarType;
        this.expression = CodeTemplateFactory.createForNode(scope, node.operand);

        if (type == UniversalVarType) {
            scope.root.headerFlags.js_var = true;
            scope.root.headerFlags.js_var_typeof = true;
        }
    }
}

@CodeTemplate(`js_var_to_undefined({expression})`)
class CVoid extends CTemplateBase {
    public expression: CExpression;
    constructor(scope: IScope, node: kataw.UnaryExpression) {
        super();
        this.expression = CodeTemplateFactory.createForNode(scope, node.operand);
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
{/if}`)
class CDelete extends CTemplateBase {
    public dict: CExpression;
    public argExpression: CExpression;
    public tempVarName: string;
    public topExpressionOfStatement: boolean;
    constructor(scope: IScope, node: kataw.UnaryExpression) {
        super();
        this.topExpressionOfStatement = node.parent.kind == kataw.SyntaxKind.ExpressionStatement;
        this.dict = isFieldAccess(node.operand) && CodeTemplateFactory.createForNode(scope, node.operand.member);
        if (isFieldElementAccess(node.operand))
            this.argExpression = isNumericLiteral(node.operand.expression)
                ? '"' + node.operand.expression.text + '"' 
                : CodeTemplateFactory.createForNode(scope, node.operand.expression)
        else if (isFieldPropertyAccess(node.operand))
            this.argExpression = new CString(scope, node.operand.expression.text);
        this.tempVarName = scope.root.symbolsHelper.addTemp(node, "tmp_dict_pos");
        scope.variables.push(new CVariable(scope, this.tempVarName, NumberVarType));
        scope.root.headerFlags.bool = true;
        scope.root.headerFlags.array_remove = true;
    }
}
