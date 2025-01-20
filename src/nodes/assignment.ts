import * as kataw from '@andrei-markeev/kataw';
import {CodeTemplate, CodeTemplateFactory, CTemplateBase} from '../template';
import {IScope} from '../program';
import {CType, ArrayType, StructType, DictType, UniversalVarType} from '../types/ctypes';
import {CElementAccess, CSimpleElementAccess} from './elementaccess';
import {CExpression} from './expressions';
import { CAsString, CAsUniversalVar } from './typeconvert';
import { getNodeText, isArrayLiteral, isFieldElementAccess, isFieldPropertyAccess, isObjectLiteral, isPropertyDefinition, isStringLiteral } from '../types/utils';

export class AssignmentHelper {
    public static create(scope: IScope, left: kataw.ExpressionNode, right: kataw.ExpressionNode, inline: boolean = false) {
        let accessor;
        let varType;
        let argumentExpression;
        if (isFieldElementAccess(left)) {
            varType = scope.root.typeHelper.getCType(left.member);
            if (kataw.isIdentifier(left.member))
                accessor = left.member.text;
            else
                accessor = new CElementAccess(scope, left.member);

            if (varType instanceof StructType && isStringLiteral(left.expression)) {
                let identText = left.expression.text;
                if (identText.search(/^[_A-Za-z][_A-Za-z0-9]*$/) > -1)
                    argumentExpression = identText;
                else
                    argumentExpression = CodeTemplateFactory.createForNode(scope, left.expression);
            } else if (varType instanceof DictType) {
                argumentExpression = new CAsString(scope, left.expression);
            } else
                argumentExpression = CodeTemplateFactory.createForNode(scope, left.expression);
        } else if (isFieldPropertyAccess(left)) {
            varType = scope.root.typeHelper.getCType(left.member);
            if (varType instanceof DictType || varType === UniversalVarType) {
                if (kataw.isIdentifier(left.member))
                    accessor = left.member.text;
                else
                    accessor = new CElementAccess(scope, left.member);

                argumentExpression = '"' + left.expression.text + '"';
            } else {
                varType = scope.root.typeHelper.getCType(left);
                accessor = new CElementAccess(scope, left);
                argumentExpression = null;
            }
        } else {
            varType = scope.root.typeHelper.getCType(left);
            accessor = new CElementAccess(scope, left);
            argumentExpression = null;
        }
        return new CAssignment(scope, accessor, argumentExpression, varType, right, inline);
    }
}

@CodeTemplate(`
{#if assignmentRemoved}
{#elseif isNewExpression}
    {expression}{CR}
{#elseif isObjLiteralAssignment}
    {objInitializers}
{#elseif isArrayLiteralAssignment}
    {arrInitializers}
{#elseif isDynamicArray && argumentExpression == null}
    {accessor} = ((void *){expression}){CR}
{#elseif argumentExpression == null}
    {accessor} = {expression}{CR}
{#elseif isStruct}
    {accessor}->{argumentExpression} = {expression}{CR}
{#elseif isDict}
    DICT_SET({accessor}, {argumentExpression}, {expression}){CR}
{#elseif isDynamicArray}
    {accessor}->data[{argumentExpression}] = {expression}{CR}
{#elseif isStaticArray}
    {accessor}[{argumentExpression}] = {expression}{CR}
{#elseif isUniversalVar}
    if ({accessor}.type == JS_VAR_DICT)
        DICT_SET(((struct dict_js_var_t *){accessor}.data), {argumentExpression}, {expression})
{#else}
    /* Unsupported assignment {accessor}[{argumentExpression}] = {nodeText} */{CR}
{/if}`
)
export class CAssignment extends CTemplateBase {
    public isObjLiteralAssignment: boolean = false;
    public objInitializers: CAssignment[];
    public isArrayLiteralAssignment: boolean = false;
    public arrayLiteralSize: number;
    public arrInitializers: CAssignment[];
    public isDynamicArray: boolean = false;
    public isStaticArray: boolean = false;
    public isStruct: boolean = false;
    public isDict: boolean = false;
    public isNewExpression: boolean = false;
    public isUniversalVar: boolean = false;
    public assignmentRemoved: boolean = false;
    public expression: CExpression;
    public nodeText: string;
    public CR: string;
    constructor(scope: IScope, public accessor: CElementAccess | CSimpleElementAccess | string, public argumentExpression: CExpression, type: CType, right: kataw.SyntaxNode, inline: boolean = false) {
        super();
        this.CR = inline ? "" : ";\n";
        this.isNewExpression = right.kind === kataw.SyntaxKind.NewExpression;
        this.isDynamicArray = type instanceof ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof ArrayType && !type.isDynamicArray;
        this.isDict = type instanceof DictType;
        this.isStruct = type instanceof StructType;
        this.isUniversalVar = type === UniversalVarType;
        this.nodeText = getNodeText(right);

        let argType = type;
        let argAccessor = accessor;
        if (argumentExpression) {
            if (type instanceof StructType && typeof argumentExpression === 'string')
                argType = type.properties[argumentExpression];
            else if (type instanceof ArrayType || type instanceof DictType)
                argType = type.elementType;
            argAccessor = new CSimpleElementAccess(scope, type, accessor, argumentExpression);
        }

        let isTempVar = !!scope.root.memoryManager.getReservedTemporaryVarName(right);
        if (isObjectLiteral(right) && !isTempVar) {
            this.isObjLiteralAssignment = true;
            let objLiteral = <kataw.ObjectLiteral>right;
            this.objInitializers = objLiteral.propertyList.properties
                .filter(isPropertyDefinition)
                .map(p => {
                    const propName = (kataw.isIdentifier(p.left) || isStringLiteral(p.left)) && p.left.text;
                    return new CAssignment(scope, argAccessor, this.isDict ? '"' + propName + '"' : propName, argType, p.right)
                });
        } else if (isArrayLiteral(right) && !isTempVar) {
            this.isArrayLiteralAssignment = true;
            this.arrayLiteralSize = right.elementList.elements.length;
            this.arrInitializers = right.elementList.elements.map((e, i) => new CAssignment(scope, argAccessor, "" + i, argType, e))
        } else if (!this.isUniversalVar && argType == UniversalVarType) {
            this.expression = new CAsUniversalVar(scope, right);
        } else
            this.expression = CodeTemplateFactory.createForNode(scope, right);

        if (this.argumentExpression == null) {
            let expr = typeof this.expression == "string" ? this.expression : this.expression && this.expression["resolve"] && this.expression["resolve"]();
            let acc = typeof this.accessor == "string" ? this.accessor : this.accessor && this.accessor["resolve"] && this.accessor["resolve"]();
            if (expr == '' || acc == expr || "((void *)" + acc + ")" == expr)
                this.assignmentRemoved = true;
        }
    }
}
