import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {IScope} from '../program';
import {ArrayType, StructType} from '../types';
import {CVariable} from './variable';
import {AssignmentHelper, CAssignment} from './assignment';

@CodeTemplate(`{expression}`, ts.SyntaxKind.ArrayLiteralExpression)
class CArrayLiteralExpression {
    public expression: string;
    constructor(scope: IScope, node: ts.ArrayLiteralExpression) {
        let arrSize = node.elements.length;
        if (arrSize == 0) {
            this.expression = "/* Empty array is not supported inside expressions */";
            return;
        }

        let type = scope.root.typeHelper.getCType(node);
        if (type instanceof ArrayType) {
            let varName: string;
            let canUseInitializerList = node.elements.every(e => e.kind == ts.SyntaxKind.NumericLiteral || e.kind == ts.SyntaxKind.StringLiteral);
            if (!type.isDynamicArray && canUseInitializerList) {
                varName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_array");
                let s = "{ ";
                for (let i = 0; i < arrSize; i++) {
                    if (i != 0)
                        s += ", ";
                    let cExpr = CodeTemplateFactory.createForNode(scope, node.elements[i]);
                    s += typeof cExpr === 'string' ? cExpr : (<any>cExpr).resolve();
                }
                s += " }";
                scope.variables.push(new CVariable(scope, varName, type, { initializer: s }));
            }
            else {
                if (type.isDynamicArray) {
                    varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
                    scope.func.variables.push(new CVariable(scope, varName, type, { initializer: "NULL" }));
                    scope.root.headerFlags.array = true;
                    scope.statements.push("ARRAY_CREATE(" + varName + ", " + arrSize + ", " + arrSize + ");\n");
                    let gcVarName = scope.root.memoryManager.getGCVariableForNode(node);
                    if (gcVarName) {
                        scope.statements.push("ARRAY_PUSH(" + gcVarName + ", (void *)" + varName + ");\n");
                        scope.root.headerFlags.gc_iterator = true;
                        scope.root.headerFlags.array = true;
                    }
                }
                else
                {
                    varName = scope.root.typeHelper.addNewTemporaryVariable(node, "tmp_array");
                    scope.variables.push(new CVariable(scope, varName, type));
                }
                for (let i = 0; i < arrSize; i++) {
                    let assignment = new CAssignment(scope, varName, i + "", type, node.elements[i])
                    scope.statements.push(assignment);
                }
            }
            this.expression = type.isDynamicArray ? "((void *)" + varName + ")" : varName;
        }
        else
            this.expression = "/* Unsupported use of array literal expression */";
    }
}

@CodeTemplate(`
{#statements}
    {#if varName}
        {varName} = malloc(sizeof(*{varName}));
        assert({varName} != NULL);
        {initializers}
    {/if}
{/statements}
{expression}`, ts.SyntaxKind.ObjectLiteralExpression)
class CObjectLiteralExpression {
    public expression: string = '';
    public varName: string = '';
    public initializers: CAssignment[] = [];
    constructor(scope: IScope, node: ts.ObjectLiteralExpression) {
        if (node.properties.length == 0)
            return;
        let type = scope.root.typeHelper.getCType(node);
        if (type instanceof StructType) {
            this.varName = scope.root.memoryManager.getReservedTemporaryVarName(node);
            scope.func.variables.push(new CVariable(scope, this.varName, type, { initializer: "NULL" }));
            
            this.initializers = node.properties
                .filter(p => p.kind == ts.SyntaxKind.PropertyAssignment)
                .map(p => <ts.PropertyAssignment>p)
                .map(p => new CAssignment(scope, this.varName, p.name.getText(), type, p.initializer));
            
            this.expression = this.varName;
        }
        else
            this.expression = "/* Unsupported use of object literal expression */";
    }
}


@CodeTemplate(`{value}`, ts.SyntaxKind.StringLiteral)
export class CString {
    public value: string;
    constructor(scope: IScope, value: ts.StringLiteral | string) {
        let s = typeof value === 'string' ? '"' + value + '"' : value.getText();
        s = s.replace(/\\u([A-Fa-f0-9]{4})/g, (match, g1) => String.fromCharCode(parseInt(g1, 16)));
        s = s.replace(/\\/g,'\\\\');
        if (s.indexOf("'") == 0)
            this.value = '"' + s.replace(/"/g, '\\"').replace(/([^\\])\\'/g, "$1'").slice(1, -1) + '"';
        else
            this.value = s;
    }
}

@CodeTemplate(`{value}`, [ts.SyntaxKind.NumericLiteral])
export class CNumber {
    public value: string;
    constructor(scope: IScope, value: ts.Node) {
        this.value = value.getText();
    }
}
