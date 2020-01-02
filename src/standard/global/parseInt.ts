import * as ts from 'typescript';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../../template';
import { StandardCallResolver, IResolver } from '../../standard';
import { NumberVarType } from '../../types/ctypes';
import { IScope } from '../../program';
import { CExpression } from '../../nodes/expressions';
import { TypeHelper } from '../../types/typehelper';

@StandardCallResolver
class ParseIntResolver implements IResolver {
    public matchesNode(typeHelper: TypeHelper, call: ts.CallExpression) {
        return call.expression.kind === ts.SyntaxKind.Identifier && call.expression.getText() === "parseInt";
    }
    public returnType(typeHelper: TypeHelper, call: ts.CallExpression) {
        return NumberVarType;
    }
    public createTemplate(scope: IScope, node: ts.CallExpression) {
        return new CParseInt(scope, node);
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

@CodeTemplate(`parse_int16_t({arguments {, }=> {this}})`)
class CParseInt extends CTemplateBase {
    public arguments: CExpression[];
    constructor(scope: IScope, call: ts.CallExpression) {
        super();
        this.arguments = call.arguments.map(a => CodeTemplateFactory.createForNode(scope, a));
        scope.root.headerFlags.parse_int16_t = true;
    }

}
