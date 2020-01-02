import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver } from '../../standard';
import { BooleanVarType, UniversalVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CAsUniversalVar } from '../../nodes/typeconvert';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver
class IsNaNResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        return call.expression.kind === ts.SyntaxKind.Identifier && call.expression.getText() === "isNaN";
    }
    public argumentTypes(typeHelper: TypeHelper, call: ts.CallExpression) {
        return [ UniversalVarType ];
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return BooleanVarType;
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CIsNaN(scope, node);
    }
    public needsDisposal(typeHelper: TypeHelper, node: ts.CallExpression) {
        return false;
    }
    public getTempVarName(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
    public getEscapeNode(typeHelper: TypeHelper, node: ts.CallExpression) {
        return null;
    }
}

@CodeTemplate(`js_var_isnan({argument})`)
class CIsNaN extends CTemplateBase {
    public argument: CAsUniversalVar = null;
    constructor(scope: IScope, call: ts.CallExpression) {
        super();
        this.argument = new CAsUniversalVar(scope, call.arguments[0]);
        scope.root.headerFlags.js_var_isnan = true;
        scope.root.headerFlags.js_var_to_number = true;
    }

}
