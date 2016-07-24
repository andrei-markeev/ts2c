import * as ts from 'typescript';
import {CodeTemplate} from '../template';
import {IScope} from '../program';
import {CType, ArrayType, StructType} from '../types';
import {CElementAccess, CExpression, ExpressionHelper} from './expressions';

export class AssignmentHelper {
    public static create(scope: IScope, left: ts.Node, right: ts.Expression) {
        let accessor = new CElementAccess(scope, left);
        let varType = scope.root.typeHelper.getCType(left);
        return new CAssignment(scope, accessor, null, varType, right);
    }
}

@CodeTemplate(`
{#if isObjLiteralAssignment}
    {objInitializers}
{#elseif isArrayLiteralAssignment}
    {arrInitializers}
{#elseif isDynamicArray && argumentExpression == null}
    {accessor} = ((void *){expression});\n
{#elseif argumentExpression == null}
    {accessor} = {expression};\n
{#elseif isStruct}
    {accessor}->{argumentExpression} = {expression};\n
{#elseif isDict}
    DICT_SET({accessor}, {argumentExpression}, {expression});\n
{#elseif isDynamicArray}
    {accessor}->data[{argumentExpression}] = {expression};\n
{#elseif isStaticArray}
    {accessor}[{argumentExpression}] = {expression};\n
{#else}
    /* Unsupported assignment {accessor}[{argumentExpression}] = {nodeText} */;\n
{/if}`
)
export class CAssignment {
    public isObjLiteralAssignment: boolean = false;
    public objInitializers: CAssignment[];
    public isArrayLiteralAssignment: boolean = false;
    public arrayLiteralSize: number;
    public arrInitializers: CAssignment[];
    public isSimpleVar: boolean;
    public isDynamicArray: boolean = false;
    public isStaticArray: boolean = false;
    public isStruct: boolean = false;
    public isDict: boolean = false;
    public expression: CExpression;
    public nodeText: string;
    constructor(scope: IScope, public accessor: CElementAccess | string, public argumentExpression: CExpression, type: CType, right: ts.Expression) {

        this.isSimpleVar = typeof type === 'string';
        this.isDynamicArray = type instanceof ArrayType && type.isDynamicArray;
        this.isStaticArray = type instanceof ArrayType && !type.isDynamicArray;
        this.isDict = type instanceof StructType && type.isDict;
        this.isStruct = type instanceof StructType && !type.isDict;
        this.nodeText = right.getText();

        if (right.kind == ts.SyntaxKind.ObjectLiteralExpression) {
            this.isObjLiteralAssignment = true;
            let objLiteral = <ts.ObjectLiteralExpression>right;
            this.objInitializers = objLiteral.properties
                .filter(p => p.kind == ts.SyntaxKind.PropertyAssignment)
                .map(p => <ts.PropertyAssignment>p)
                .map(p => new CAssignment(scope, this.accessor, p.name.getText(), type, p.initializer));
        } else if (right.kind == ts.SyntaxKind.ArrayLiteralExpression) {
            this.isArrayLiteralAssignment = true;
            let arrLiteral = <ts.ArrayLiteralExpression>right;
            this.arrayLiteralSize = arrLiteral.elements.length;
            this.arrInitializers = arrLiteral.elements.map((e, i) => new CAssignment(scope, this.accessor, ""+i, type, e))
        } else
            this.expression = ExpressionHelper.create(scope, right);
    }
}
