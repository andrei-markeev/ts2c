import * as ts from 'typescript';
import {CodeTemplate} from '../template';
import {IScope} from '../program';
import {CElementAccess, CExpression, ExpressionProcessor} from './expressions';

@CodeTemplate(`
{#if !argumentExpression && !isObjLiteralAssignment && !isArrayLiteralAssignment}
    {accessor} = {expression};
{#elseif argumentExpression && isStruct && !isObjLiteralAssignment && !isArrayLiteralAssignment}
    {accessor}->{argumentExpression} = {expression};
{#elseif argumentExpression && isDict && !isObjLiteralAssignment && !isArrayLiteralAssignment}
    DICT_SET({accessor}, {argumentExpression}, {expression});
{#elseif argumentExpression && isDynamicArray && !isObjLiteralAssignment && !isArrayLiteralAssignment}
    {accessor}.data[{argumentExpression}] = {expression};
{#elseif argumentExpression && isStaticArray && !isObjLiteralAssignment && !isArrayLiteralAssignment}
    {accessor}[{argumentExpression}] = {expression};
{#elseif isObjLiteralAssignment && isStruct}
    {objInitializers => {accessor}->{propName} = {expression};\n}
{#elseif isObjLiteralAssignment && isDict}
    {objInitializers => DICT_SET({accessor}, {propName}, {expression});\n}
{#elseif isArrayLiteralAssignment && isDynamicArray}
    {arrInitializers => {accessor}.data[{index}] = {expression};\n}
{#elseif isArrayLiteralAssignment && isStaticArray}
    {arrInitializers => {accessor}[{index}] = {expression};\n}
{#else}
    /* Unsupported assignment */
{/if}`
)
export class CAssignment {
    public isObjLiteralAssignment: boolean = false;
    public objInitializers: {accessor: CElementAccess | string, propName: string, expression: CExpression}[];
    public isArrayLiteralAssignment: boolean = false;
    public arrayLiteralSize: number;
    public arrInitializers: {accessor: CElementAccess | string, index: number, expression: CExpression}[];
    public accessor: CElementAccess | string;
    public argumentExpression: CExpression;
    public isSimpleVar: boolean;
    public isDynamicArray: boolean = false;
    public isStaticArray: boolean = false;
    public isStruct: boolean = false;
    public isDict: boolean = false;
    public expression: CExpression;
    constructor(scope: IScope, left: ts.Node, right: ts.Expression) {
        let wrappedAccessor = new CElementAccess(scope, left);
        this.accessor = wrappedAccessor.elementAccess;
        this.argumentExpression = wrappedAccessor.argumentExpression;
        this.isSimpleVar = wrappedAccessor.isSimpleVar;
        this.isDynamicArray = wrappedAccessor.isDynamicArray;
        this.isStaticArray = wrappedAccessor.isStaticArray;
        this.isDict = wrappedAccessor.isDict;
        this.isStruct = wrappedAccessor.isStruct;

        if (right.kind == ts.SyntaxKind.ObjectLiteralExpression) {
            this.isObjLiteralAssignment = true;
            let objLiteral = <ts.ObjectLiteralExpression>right;
            this.objInitializers = objLiteral.properties
                .filter(p => p.kind == ts.SyntaxKind.PropertyAssignment)
                .map(p => { return {
                    accessor: wrappedAccessor,
                    propName: p.name.kind == ts.SyntaxKind.Identifier && p.name.getText()
                              || p.name.kind == ts.SyntaxKind.StringLiteral && p.name.getText().slice(1,-1)
                              || "/* unsupported property name expression " + p.name.getText() + " */",
                    expression: ExpressionProcessor.get(scope, (<ts.PropertyAssignment>p).initializer) 
                } });
        } else if (right.kind == ts.SyntaxKind.ArrayLiteralExpression) {
            this.isArrayLiteralAssignment = true;
            let arrLiteral = <ts.ArrayLiteralExpression>right;
            this.arrayLiteralSize = arrLiteral.elements.length;
            this.arrInitializers = arrLiteral.elements.map((e, i) => { return {
                accessor: wrappedAccessor,
                index: i,
                expression: ExpressionProcessor.get(scope, e)
            } })
        } else
            this.expression = ExpressionProcessor.get(scope, right);
    }
}
