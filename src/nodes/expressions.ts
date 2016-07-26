import * as ts from 'typescript';
import {CodeTemplate} from '../template';
import {IScope} from '../program';
import {CType, ArrayType, StructType, StringVarType, NumberVarType, BooleanVarType, UniversalVarType, PointerVarType} from '../types';
import {AssignmentHelper, CAssignment} from './assignment';
import {PrintfHelper} from './printf';
import {CVariable} from './variable';

export class ExpressionHelper {
    public static create(scope: IScope, node: ts.Expression): CExpression {
        if (typeof node === 'string')
            return node;
        switch (node.kind) {
            case ts.SyntaxKind.ElementAccessExpression:
            case ts.SyntaxKind.PropertyAccessExpression:
                return new CElementAccess(scope, node);
            case ts.SyntaxKind.CallExpression:
                return new CCallExpression(scope, <any>node);
            case ts.SyntaxKind.BinaryExpression:
                let binaryExpr = <ts.BinaryExpression>node;
                if (binaryExpr.operatorToken.kind == ts.SyntaxKind.EqualsToken)
                    return AssignmentHelper.create(scope, binaryExpr.left, binaryExpr.right);
                else
                    return new CBinaryExpression(scope, binaryExpr);
            case ts.SyntaxKind.ArrayLiteralExpression:
                return ArrayLiteralHelper.create(scope, <any>node);
            case ts.SyntaxKind.StringLiteral:
                return new CString(node.getText());
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.Identifier:
                return node.getText();
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
                return new CUnaryExpression(scope, <any>node);
            case ts.SyntaxKind.ConditionalExpression:
                return new CTernaryExpression(scope, <any>node);
            default:
                return "/* unsupported expression " + node.getText() + " */";
        }
    }
}

export interface CExpression { }

@CodeTemplate(`
{#if type == "call"}
    {funcName}({arguments {, }=> {this}})
{/if}
{#if type == "array"}
    {funcName}({arrayAccess}{arguments => , {this}})
{/if}
{#if type == "array_size"}
    {arrayAccess}->size
{/if}
{#if type == "printf"}
    {printfCalls}
{/if}`
)
export class CCallExpression {
    public type: string;
    public funcName: string;
    public arrayAccess: CElementAccess;
    public arguments: CExpression[];
    public printfCalls: any[];
    constructor(scope: IScope, call: ts.CallExpression) {
        this.type = "call";
        this.funcName = call.expression.getText();
        if (this.funcName != "console.log")
            this.arguments = call.arguments.map(a => ExpressionHelper.create(scope, a));

        if (call.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
            let propAccess = <ts.PropertyAccessExpression>call.expression;
            if (this.funcName == "console.log") {
                this.type = "printf";
                this.printfCalls = call.arguments.map(a => PrintfHelper.create(scope, a));
                scope.root.headerFlags.printf = true;
            }
            if (propAccess.name.getText() == 'push' && this.arguments.length == 1) {
                if (call.parent.kind == ts.SyntaxKind.ExpressionStatement) {
                    this.type = "array";
                    this.funcName = "ARRAY_PUSH";
                    this.arrayAccess = new CElementAccess(scope, propAccess.expression);
                } else {
                    // ARRAY_PUSH cannot be used as expression directly, because it is a macros
                    // containing several statements, so let's push it separately into scope
                    // statements, and replace it's occurence in expression with array size
                    this.type = "array_size";
                    scope.statements.push(new CCallExpression(scope, call));
                }
                scope.root.headerFlags.array = true;
            }
            if (propAccess.name.getText() == 'pop' && this.arguments.length == 0) {
                this.type = "array";
                this.funcName = "ARRAY_POP";
                this.arrayAccess = new CElementAccess(scope, propAccess.expression);
                scope.root.headerFlags.array = true;
                scope.root.headerFlags.array_pop = true;
            }
        }
    }
}

@CodeTemplate(`
{#if operator}
    {left} {operator} {right}
{#elseif replacedWithCall}
    {call}({left}, {right}){callCondition}
{#elseif replacedWithVar}
    {replacementVarName}
{#else}
    /* unsupported expression {nodeText} */
{/if}`
)
class CBinaryExpression {
    public nodeText: string;
    public operator: string;
    public replacedWithCall: boolean = false;
    public call: string;
    public callCondition: string;
    public replacedWithVar: boolean = false;
    public replacementVarName: string;
    public left: CExpression;
    public right: CExpression;
    constructor(scope: IScope, node: ts.BinaryExpression) {
        let operatorMap: { [token: number]: string } = {};
        let callReplaceMap: { [token: number]: [string, string] } = {};
        let leftType = scope.root.typeHelper.getCType(node.left);
        let rightType = scope.root.typeHelper.getCType(node.right);
        this.left = ExpressionHelper.create(scope, node.left);
        this.right = ExpressionHelper.create(scope, node.right);
        if (leftType == NumberVarType && rightType == NumberVarType) {
            operatorMap[ts.SyntaxKind.GreaterThanToken] = '>';
            operatorMap[ts.SyntaxKind.GreaterThanEqualsToken] = '>=';
            operatorMap[ts.SyntaxKind.LessThanToken] = '<';
            operatorMap[ts.SyntaxKind.LessThanEqualsToken] = '<=';
            operatorMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.ExclamationEqualsToken] = '!=';
            operatorMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = '==';
            operatorMap[ts.SyntaxKind.EqualsEqualsToken] = '==';
            operatorMap[ts.SyntaxKind.AsteriskToken] = '*';
            operatorMap[ts.SyntaxKind.SlashToken] = '/';
            operatorMap[ts.SyntaxKind.PlusToken] = '+';
            operatorMap[ts.SyntaxKind.MinusToken] = '-';
        }
        else if (leftType == StringVarType && rightType == StringVarType) {
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['strcmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['strcmp', ' == 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['strcmp', ' == 0'];

            if (callReplaceMap[node.operatorToken.kind])
                scope.root.headerFlags.strings = true;

            if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
                let tempVarName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_string");
                if (this.left["resolve"])
                    this.left = this.left["resolve"]();
                if (this.right["resolve"])
                    this.right = this.right["resolve"]();
                // TODO: free
                scope.variables.push(new CVariable(scope, tempVarName, "char *"));
                scope.statements.push(tempVarName + " = malloc(strlen(" + this.left + ") + strlen(" + this.right + ") + 1);\n");
                scope.statements.push("assert(" + tempVarName + " != NULL);\n");
                scope.statements.push("strcpy(" + tempVarName + ", " + this.left + ");\n");
                scope.statements.push("strcat(" + tempVarName + ", " + this.right + ");\n");
                this.replacedWithVar = true;
                this.replacementVarName = tempVarName;
                scope.root.headerFlags.strings = true;
                scope.root.headerFlags.malloc = true;
            }
        }
        else if (leftType == NumberVarType && rightType == StringVarType
            || leftType == StringVarType && rightType == NumberVarType) {

            callReplaceMap[ts.SyntaxKind.ExclamationEqualsEqualsToken] = ['str_int16_t_cmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.ExclamationEqualsToken] = ['str_int16_t_cmp', ' != 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsEqualsToken] = ['str_int16_t_cmp', ' == 0'];
            callReplaceMap[ts.SyntaxKind.EqualsEqualsToken] = ['str_int16_t_cmp', ' == 0'];

            if (callReplaceMap[node.operatorToken.kind]) {
                scope.root.headerFlags.str_int16_t_cmp = true;
                // str_int16_t_cmp expects certain order of arguments (string, number)
                if (leftType == NumberVarType) {
                    let tmp = this.left;
                    this.left = this.right;
                    this.right = tmp;
                }
            }

            if (node.operatorToken.kind == ts.SyntaxKind.PlusToken) {
                let tempVarName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_string");
                if (this.left["resolve"])
                    this.left = this.left["resolve"]();
                if (this.right["resolve"])
                    this.right = this.right["resolve"]();
                // TODO: free
                let num = leftType == NumberVarType ? this.left : this.right;
                let str = leftType == StringVarType ? this.left : this.right;

                scope.variables.push(new CVariable(scope, tempVarName, "char *"));
                scope.statements.push(tempVarName + " = malloc(strlen(" + str + ") + STR_INT16_T_BUFLEN + 1);\n");
                scope.statements.push("assert(" + tempVarName + " != NULL);\n");
                scope.statements.push(tempVarName + "[0] = '\\0';\n");
                let strcatNumber = "str_int16_t_cat(" + tempVarName + ", " + num + ");\n";
                let strcatString = "strcat(" + tempVarName + ", " + str + ");\n";
                if (leftType == NumberVarType) {
                    scope.statements.push(strcatNumber);
                    scope.statements.push(strcatString);
                }
                else {
                    scope.statements.push(strcatString);
                    scope.statements.push(strcatNumber);
                }
                this.replacedWithVar = true;
                this.replacementVarName = tempVarName;
                scope.root.headerFlags.strings = true;
                scope.root.headerFlags.malloc = true;
                scope.root.headerFlags.str_int16_t_cat = true;
            }

        }
        this.operator = operatorMap[node.operatorToken.kind];
        if (callReplaceMap[node.operatorToken.kind]) {
            this.replacedWithCall = true;
            [this.call, this.callCondition] = callReplaceMap[node.operatorToken.kind];
        }
        this.nodeText = node.getText();
    }
}


@CodeTemplate(`
{#if isPostfix && operator}
    {operand}{operator}
{#elseif !isPostfix && operator}
    {operator}{operand}
{#elseif replacedWithCall}
    {call}({operand}){callCondition}
{#else}
    /* unsupported expression {nodeText} */
{/if}`
)
class CUnaryExpression {
    public nodeText: string;
    public operator: string;
    public operand: CExpression;
    public isPostfix: boolean;
    public replacedWithCall: boolean = false;
    public call: string;
    public callCondition: string;
    constructor(scope: IScope, node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression) {
        let operatorMap: { [token: number]: string } = {};
        let callReplaceMap: { [token: number]: [string, string] } = {};
        let type = scope.root.typeHelper.getCType(node.operand);
        if (type == NumberVarType) {
            operatorMap[ts.SyntaxKind.PlusPlusToken] = '++';
            operatorMap[ts.SyntaxKind.MinusMinusToken] = '--';
            operatorMap[ts.SyntaxKind.ExclamationToken] = '!';
            callReplaceMap[ts.SyntaxKind.PlusToken] = ["atoi", ""];
            if (callReplaceMap[node.operator])
                scope.root.headerFlags.atoi = true;
        }
        this.operator = operatorMap[node.operator];
        if (callReplaceMap[node.operator]) {
            this.replacedWithCall = true;
            [this.call, this.callCondition] = callReplaceMap[node.operator];
        }
        this.operand = ExpressionHelper.create(scope, node.operand);
        this.isPostfix = node.kind == ts.SyntaxKind.PostfixUnaryExpression;
        this.nodeText = node.getText();
    }
}

@CodeTemplate(`{condition} ? {whenTrue} : {whenFalse}`)
class CTernaryExpression {
    public condition: CExpression;
    public whenTrue: CExpression;
    public whenFalse: CExpression;
    constructor(scope: IScope, node: ts.ConditionalExpression) {
        this.condition = ExpressionHelper.create(scope, node.condition);
        this.whenTrue = ExpressionHelper.create(scope, node.whenTrue);
        this.whenFalse = ExpressionHelper.create(scope, node.whenFalse);
    }
}

class ArrayLiteralHelper {
    public static create(scope: IScope, node: ts.ArrayLiteralExpression) {
        let arrSize = node.elements.length;
        if (arrSize == 0) {
            return "/* Empty array is not supported inside expressions */";
        }

        let varName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_array");
        let type = scope.root.typeHelper.getCType(node);
        if (type instanceof ArrayType) {
            let canUseInitializerList = node.elements.every(e => e.kind == ts.SyntaxKind.NumericLiteral || e.kind == ts.SyntaxKind.StringLiteral);
            if (!type.isDynamicArray && canUseInitializerList) {
                let s = "{ ";
                for (let i = 0; i < arrSize; i++) {
                    if (i != 0)
                        s += ", ";
                    let cExpr = ExpressionHelper.create(scope, node.elements[i]);
                    s += typeof cExpr === 'string' ? cExpr : (<any>cExpr).resove();
                }
                s += " }";
                scope.variables.push(new CVariable(scope, varName, type, { initializer: s }));
            }
            else {
                scope.variables.push(new CVariable(scope, varName, type));
                if (type.isDynamicArray) {
                    scope.root.headerFlags.array = true;
                    scope.statements.push("ARRAY_CREATE(" + varName + ", " + arrSize + ", " + arrSize + ");\n");
                }
                for (let i = 0; i < arrSize; i++) {
                    let assignment = new CAssignment(scope, varName, i + "", type, node.elements[i])
                    scope.statements.push(assignment);
                }
            }
            return type.isDynamicArray ? "((void *)" + varName + ")" : varName;
        }
        else
            return "/* Unsupported use of array literal expression */";
    }
}

@CodeTemplate(`
{#if isSimpleVar || argumentExpression == null}
    {elementAccess}
{#elseif isDynamicArray && argumentExpression == 'length'}
    {elementAccess}->size
{#elseif isDynamicArray}
    {elementAccess}->data[{argumentExpression}]
{#elseif isStaticArray && argumentExpression == 'length'}
    {arrayCapacity}
{#elseif isStaticArray}
    {elementAccess}[{argumentExpression}]
{#elseif isStruct}
    {elementAccess}->{argumentExpression}
{#elseif isDict}
    DICT_GET({elementAccess}, {argumentExpression})
{#else}
    /* Unsupported left hand side expression {nodeText} */
{/if}`
)
export class CElementAccess {
    public isSimpleVar: boolean;
    public isDynamicArray: boolean = false;
    public isStaticArray: boolean = false;
    public isStruct: boolean = false;
    public isDict: boolean = false;
    public elementAccess: CElementAccess | string;
    public argumentExpression: CExpression = null;
    public arrayCapacity: string;
    public nodeText: string;
    constructor(scope: IScope, node: ts.Node) {
        let type: CType = null;

        if (node.kind == ts.SyntaxKind.Identifier) {
            type = scope.root.typeHelper.getCType(node);
            this.elementAccess = node.getText();
        } else if (node.kind == ts.SyntaxKind.PropertyAccessExpression) {
            let propAccess = <ts.PropertyAccessExpression>node;
            type = scope.root.typeHelper.getCType(propAccess.expression);
            if (propAccess.expression.kind == ts.SyntaxKind.Identifier)
                this.elementAccess = propAccess.expression.getText();
            else
                this.elementAccess = new CElementAccess(scope, propAccess.expression);
            this.argumentExpression = propAccess.name.getText();
        } else if (node.kind == ts.SyntaxKind.ElementAccessExpression) {
            let elemAccess = <ts.ElementAccessExpression>node;
            type = scope.root.typeHelper.getCType(elemAccess.expression);
            if (elemAccess.expression.kind == ts.SyntaxKind.Identifier)
                this.elementAccess = elemAccess.expression.getText();
            else
                this.elementAccess = new CElementAccess(scope, elemAccess.expression);
            if (elemAccess.argumentExpression.kind == ts.SyntaxKind.StringLiteral) {
                let ident = elemAccess.argumentExpression.getText().slice(1, -1);
                if (ident.search(/^[_A-Za-z][_A-Za-z0-9]*$/) > -1)
                    this.argumentExpression = ident;
                else
                    this.argumentExpression = ExpressionHelper.create(scope, elemAccess.argumentExpression);
            } else
                this.argumentExpression = ExpressionHelper.create(scope, elemAccess.argumentExpression);
        }

        this.isSimpleVar = typeof type === 'string' && type != UniversalVarType && type != PointerVarType;
        this.isDynamicArray = type instanceof ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof ArrayType && !type.isDynamicArray;
        this.arrayCapacity = type instanceof ArrayType && !type.isDynamicArray && type.capacity + "";
        this.isDict = type instanceof StructType && type.isDict;
        this.isStruct = type instanceof StructType && !type.isDict;
        this.nodeText = node.getText();

    }
}

export class CString {
    private value: string;
    constructor(value: string) {
        if (value.indexOf("'") == 0)
            this.value = '"' + value.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            this.value = value;
    }
    resolve() {
        return this.value;
    }
}
