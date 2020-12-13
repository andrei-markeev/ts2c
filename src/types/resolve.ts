import * as ts from 'typescript';

import { StandardCallHelper } from '../standard';
import { isEqualsExpression, isNullOrUndefinedOrNaN, isFieldPropertyAccess, isFieldElementAccess, isMethodCall, isLiteral, isFunctionArgInMethodCall, isForOfWithSimpleInitializer, isForOfWithIdentifierInitializer, isDeleteExpression, isThisKeyword, isCompoundAssignment, isUnaryExpression, isStringLiteralAsIdentifier, isLogicOp, isFunction, getUnaryExprResultType, getBinExprResultType, operandsToNumber, toNumberCanBeNaN, findParentFunction, isUnder, getAllNodesUnder, isFieldAssignment, getAllFunctionNodesInFunction } from './utils';
import { CType, NumberVarType, BooleanVarType, StringVarType, ArrayType, StructType, DictType, FuncType, PointerVarType, UniversalVarType, VoidType } from './ctypes';
import { CircularTypesFinder } from './findcircular';
import { TypeMerger } from './merge';
import { TypeHelper } from './typehelper';

type NodeFunc<T extends ts.Node> = { (n: T): ts.Node };
type NodeResolver<T extends ts.Node> = { getNode?: NodeFunc<T>, getType?: { (n: T): CType } };
type Equality<T extends ts.Node> = [{ (n): n is T }, NodeFunc<T>, NodeResolver<T>];

export class TypeResolver {

    constructor(
        private typeChecker: ts.TypeChecker,
        private allNodes: ts.Node[],
        public typeHelper: TypeHelper,
        private typeMerger: TypeMerger,
        private typeOfNodeDict: { [id: string]: { type: CType } }
    ) { }

    /** Postprocess TypeScript AST for better type inference and map TS types to C types */
    /** Creates typeOfNodeDict that is later used in getCType */
    public inferTypes() {

        const finder = new CircularTypesFinder(this.allNodes, this.typeChecker);
        const circularAssignments = finder.findCircularAssignments();

        const type = <T extends ts.Node>(t: { (n: T): CType } | string): NodeResolver<T> => ({ getType: typeof (t) === "string" ? _ => t : t });
        const struct = (prop: string, pos: number, elemType: CType = PointerVarType, recursive: boolean = false): StructType => new StructType({ [prop]: { type: elemType, order: pos, recursive } });

        let typeEqualities: Equality<any>[] = [];

        const addEquality = <T extends ts.Node>(typeGuard: { (n): n is T }, node1: NodeFunc<T>, node2: NodeFunc<T> | NodeResolver<T>) => {
            if (typeof node2 == "function")
                typeEqualities.push([typeGuard, node1, { getNode: node2 }]);
            else
                typeEqualities.push([typeGuard, node1, node2]);
        };

        // left hand side
        addEquality(ts.isIdentifier, n => n, n => this.typeHelper.getDeclaration(n));
        addEquality(ts.isPropertyAssignment, n => n, n => n.initializer);
        addEquality(ts.isPropertyAssignment, n => n.parent, type(n => {
            const propName = (ts.isIdentifier(n.name) || isStringLiteralAsIdentifier(n.name)) && n.name.text;
            if (propName)
                return struct(propName, n.pos, this.typeHelper.getCType(n) || PointerVarType)
            else
                return new DictType(this.typeHelper.getCType(n));
        }));
        addEquality(ts.isPropertyAssignment, n => n, type(n => {
            const propName = (ts.isIdentifier(n.name) || isStringLiteralAsIdentifier(n.name)) && n.name.text;
            const type = this.typeHelper.getCType(n.parent);
            return type instanceof StructType ? type.properties[propName]
                : type instanceof DictType ? type.elementType
                : null;
        }));
        addEquality(ts.isPropertyAssignment, n => n, type(n => {
            const type = this.typeHelper.getCType(n.initializer);
            if (type instanceof FuncType && type.closureParams.length)
                return new FuncType({ needsClosureStruct: true });
            else
                return null;
        }))
        addEquality(ts.isPropertyAccessExpression, n => n, n => n.name);
        addEquality(isFieldPropertyAccess, n => n.expression, type(n => struct(n.name.getText(), n.pos, this.typeHelper.getCType(n) || PointerVarType)));
        addEquality(isFieldPropertyAccess, n => n, type(n => {
            const type = this.typeHelper.getCType(n.expression);
            return type instanceof StructType ? type.properties[n.name.getText()]
                : type instanceof ArrayType && n.name.getText() == "length" ? NumberVarType
                : type === StringVarType && n.name.getText() == "length" ? NumberVarType
                : type instanceof ArrayType || type instanceof DictType ? type.elementType
                : type === UniversalVarType && n.name.getText() == "length" ? NumberVarType
                : type === UniversalVarType ? UniversalVarType
                : null;
        }));
        addEquality(isFieldElementAccess, n => n.expression, type(n => {
            const type = this.typeHelper.getCType(n.argumentExpression);
            const elementType = this.typeHelper.getCType(n) || PointerVarType;
            return isStringLiteralAsIdentifier(n.argumentExpression) ? struct(n.argumentExpression.text, n.pos, elementType)
                : ts.isNumericLiteral(n.argumentExpression) ? new ArrayType(elementType, 0, false)
                : type == NumberVarType ? new ArrayType(elementType, 0, false)
                : type == StringVarType ? new DictType(elementType)
                : null
        }));
        addEquality(isFieldElementAccess, n => n, type(n => {
            const type = this.typeHelper.getCType(n.expression);
            return ts.isStringLiteral(n.argumentExpression) && type instanceof StructType ? type.properties[n.argumentExpression.getText().slice(1, -1)]
                : ts.isStringLiteral(n.argumentExpression) && type instanceof ArrayType && n.argumentExpression.getText().slice(1, -1) == "length" ? NumberVarType
                : ts.isStringLiteral(n.argumentExpression) && type === StringVarType && n.argumentExpression.getText().slice(1, -1) == "length" ? NumberVarType
                : ts.isStringLiteral(n.argumentExpression) && type === UniversalVarType && n.argumentExpression.getText().slice(1, -1) == "length" ? NumberVarType
                : type instanceof ArrayType || type instanceof DictType ? type.elementType
                : type === UniversalVarType ? UniversalVarType
                : null
        }));
        for (let i = 0; i < 10; i++) {
            addEquality(ts.isArrayLiteralExpression, n => n, type(n => {
                const elemType = this.typeHelper.getCType(n.elements[i]);
                return elemType ? new ArrayType(elemType, 0, false) : null
            }));
            addEquality(ts.isArrayLiteralExpression, n => n.elements[i], type(n => {
                const arrType = this.typeHelper.getCType(n);
                return arrType && arrType instanceof ArrayType ? arrType.elementType
                    : arrType === UniversalVarType ? UniversalVarType
                    : null
            }));
        }

        // expressions
        addEquality(isEqualsExpression, n => n.left, n => circularAssignments[n.pos] ? null : n.right);
        addEquality(isEqualsExpression, n => n.left, type(n => {
            const type = this.typeHelper.getCType(n.right);
            if (type instanceof FuncType && type.closureParams.length)
                return new FuncType({ needsClosureStruct: true });
            else
                return null;
        }));
        addEquality(isFieldAssignment, n => n.left.expression, type(n => {
            if (!circularAssignments[n.pos])
                return null;
            return isFieldElementAccess(n.left) ? struct(n.left.argumentExpression.getText().slice(1, -1), n.left.pos, PointerVarType, true)
                : isFieldPropertyAccess(n.left) ? struct(n.left.name.text, n.left.pos, PointerVarType, true)
                : null;
        }));
        addEquality(ts.isConditionalExpression, n => n.whenTrue, n => n.whenFalse);
        addEquality(ts.isConditionalExpression, n => n, n => n.whenTrue);
        addEquality(isUnaryExpression, n => n, type(n => getUnaryExprResultType(n.operator, this.typeHelper.getCType(n.operand))));
        addEquality(isUnaryExpression, n => n.operand, type(n => {
            if (n.operator !== ts.SyntaxKind.PlusPlusToken && n.operator !== ts.SyntaxKind.MinusMinusToken)
                return null;
            const resultType = this.typeHelper.getCType(n);
            const accessObjType = (ts.isPropertyAccessExpression(n.operand) || ts.isElementAccessExpression(n.operand)) && this.typeHelper.getCType(n.operand.expression);
            const isDictAccessor = accessObjType instanceof DictType;
            if (resultType == UniversalVarType || toNumberCanBeNaN(resultType) || isDictAccessor)
                return UniversalVarType;
            else
                return null;
        }));
        addEquality(ts.isBinaryExpression, n => n, type(n => getBinExprResultType(this.typeMerger.mergeTypes.bind(this.typeMerger), this.typeHelper.getCType(n.left), n.operatorToken.kind, this.typeHelper.getCType(n.right))));
        addEquality(ts.isBinaryExpression, n => n.left, type(n => {
            const resultType = this.typeHelper.getCType(n);
            const operandType = this.typeHelper.getCType(n.left);
            const rightType = this.typeHelper.getCType(n.right);
            if (resultType === UniversalVarType) {
                return isCompoundAssignment(n.operatorToken) ? UniversalVarType
                    : operandType instanceof ArrayType ? new ArrayType(UniversalVarType, 0, true)
                    : operandType instanceof StructType || operandType instanceof DictType ? new DictType(UniversalVarType)
                    : null;
            } else if (operandsToNumber(operandType, n.operatorToken.kind, rightType) && toNumberCanBeNaN(operandType))
                return UniversalVarType;
            else
                return null;
        }));
        addEquality(ts.isBinaryExpression, n => n.right, type(n => {
            const resultType = this.typeHelper.getCType(n);
            const operandType = this.typeHelper.getCType(n.right);
            const leftType = this.typeHelper.getCType(n.left);
            if (resultType === UniversalVarType && !isLogicOp(n.operatorToken.kind)) {
                return operandType instanceof ArrayType ? new ArrayType(UniversalVarType, 0, true)
                    : operandType instanceof StructType || operandType instanceof DictType ? new DictType(UniversalVarType)
                    : null;
            } else if (operandsToNumber(leftType, n.operatorToken.kind, operandType) && toNumberCanBeNaN(operandType))
                return UniversalVarType;
            else
                return null;
        }));
        addEquality(isNullOrUndefinedOrNaN, n => n, type(UniversalVarType));
        addEquality(ts.isParenthesizedExpression, n => n, n => n.expression);
        addEquality(ts.isVoidExpression, n => n, type(UniversalVarType));
        addEquality(ts.isVoidExpression, n => n.expression, type(PointerVarType));
        addEquality(ts.isTypeOfExpression, n => n, type(StringVarType));
        addEquality(isDeleteExpression, n => n, type(BooleanVarType));
        addEquality(isDeleteExpression, n => n.expression.expression, type(n => new DictType(UniversalVarType)));

        // functions
        addEquality(ts.isCallExpression, n => n.expression, n => this.typeHelper.getDeclaration(n));
        addEquality(ts.isCallExpression, n => n.expression, type(n => this.typeHelper.getCType(n) ? new FuncType({ returnType: this.typeHelper.getCType(n), parameterTypes: n.arguments.map(arg => this.typeHelper.getCType(arg)) }) : null));
        addEquality(ts.isCallExpression, n => n, type(n => FuncType.getReturnType(this.typeHelper, n.expression)));
        addEquality(ts.isParameter, n => n, n => n.name);
        addEquality(ts.isParameter, n => n, n => n.initializer);

        addEquality(ts.isNewExpression, n => n, type(n => 
            ts.isIdentifier(n.expression) && n.expression.text === "Object" ? new StructType({})
            : FuncType.getInstanceType(this.typeHelper, n.expression)
        ));
        for (let i = 0; i < 10; i++)
            addEquality(ts.isNewExpression, n => n.arguments[i], n => {
                const func = this.typeHelper.getDeclaration(n.expression);
                return func && ts.isFunctionDeclaration(func) ? func.parameters[i] : null
            });
        addEquality(isThisKeyword, n => findParentFunction(n), type(n => new FuncType({ instanceType: this.typeHelper.getCType(n) })));
        addEquality(isThisKeyword, n => n, type(n => FuncType.getInstanceType(this.typeHelper, findParentFunction(n))));

        addEquality(isMethodCall, n => n.expression.expression, type(n => StandardCallHelper.getObjectType(this.typeHelper, n)));
        addEquality(ts.isCallExpression, n => n, type(n => StandardCallHelper.getReturnType(this.typeHelper, n)));
        for (let i = 0; i < 10; i++)
            addEquality(ts.isCallExpression, n => n.arguments[i], type(n => isLiteral(n.arguments[i]) ? null : StandardCallHelper.getArgumentTypes(this.typeHelper, n)[i]));

        // crutch for callback argument type in foreach
        addEquality(isFunctionArgInMethodCall, n => n.parameters[0], type(n => {
            const objType = this.typeHelper.getCType(n.parent.expression.expression);
            return objType instanceof ArrayType && n.parent.expression.name.text == "forEach" ? objType.elementType : null;
        }));

        addEquality(isFunction, n => n, type(n => new FuncType({ parameterTypes: n.parameters.map(p => this.typeHelper.getCType(p)) })));
        for (let i = 0; i < 10; i++)
            addEquality(isFunction, n => n.parameters[i], type(n => {
                const type = this.typeHelper.getCType(n);
                return type instanceof FuncType ? type.parameterTypes[i] : null
            }));

        // closures
        addEquality(isFunction, n => n, type(node => {
            const funcsInFunction = getAllFunctionNodesInFunction(node);
            const scopePropDefs = {};
            for (const f of funcsInFunction) {
                const fType = this.typeHelper.getCType(f) as FuncType;
                if (fType && fType.needsClosureStruct && fType.closureParams) {
                    for (const p of fType.closureParams) {
                        const decl = this.typeHelper.getDeclaration(p.node);
                        scopePropDefs[p.node.text] = { type: this.typeHelper.getCType(p.node) || PointerVarType, pos: decl.pos };
                        if (findParentFunction(decl) === node)
                            this.typeHelper.registerScopeVariable(decl);
                    }
                }
            }
            if (Object.keys(scopePropDefs).length > 0)
                return new FuncType({ scopeType: new StructType(scopePropDefs) });
            else
                return null;
        }));
        addEquality(isFunction, n => n, type(node => {
            const nodesInFunction = getAllNodesUnder(node);
            const closureParams = [];
            nodesInFunction.filter(n => ts.isIdentifier(n))
                .forEach((ident: ts.Identifier) => {
                    const identDecl = this.typeHelper.getDeclaration(ident);
                    // if declaration of identifier is function (i.e. function param), and it is not under node
                    // (then it is defined in a parent func obviously), then add closure params of this parent function
                    if (identDecl && isFunction(identDecl) && !isUnder(node, identDecl)) {
                        const identDeclType = this.typeHelper.getCType(identDecl) as FuncType;
                        for (let param of identDeclType.closureParams) {
                            if (!closureParams.some(p => p.node.text === param.node.text))
                                closureParams.push(param);
                        }
                    } else {
                        const identDeclFunc = identDecl && findParentFunction(identDecl);
                        const isFieldName = ts.isPropertyAccessExpression(ident.parent) && ident.parent.name === ident;
                        const assigned = isEqualsExpression(ident.parent) || isCompoundAssignment(ident.parent);
                        if (identDeclFunc && identDeclFunc != node && isUnder(identDeclFunc, node) && !isFieldName) {
                            const existing = closureParams.filter(p => p.node.escapedText === ident.escapedText)[0];
                            if (!existing)
                                closureParams.push({ assigned, node: ident, refs: [ident] });
                            else if (assigned && !existing.assigned)
                                existing.assigned = true;
                            
                            if (existing)
                                existing.refs.push(ident);
                        }
                    }
                });

            if (closureParams.length)
                return new FuncType({ closureParams });
            else
                return null;

        }));

        // statements
        addEquality(ts.isVariableDeclaration, n => n, n => n.initializer);
        addEquality(ts.isVariableDeclaration, n => n, type(n => {
            const type = this.typeHelper.getCType(n.initializer);
            if (type instanceof FuncType && type.closureParams.length)
                return new FuncType({ needsClosureStruct: true });
            else
                return null;
        }))
        addEquality(isForOfWithSimpleInitializer, n => n.expression, type(n => new ArrayType(this.typeHelper.getCType(n.initializer.declarations[0]) || PointerVarType, 0, false)));
        addEquality(isForOfWithSimpleInitializer, n => n.initializer.declarations[0], type(n => {
            const type = this.typeHelper.getCType(n.expression);
            return type instanceof ArrayType ? type.elementType : null
        }));
        addEquality(isForOfWithIdentifierInitializer, n => n.expression, type(n => new ArrayType(this.typeHelper.getCType(n.initializer) || PointerVarType, 0, false)));
        addEquality(isForOfWithIdentifierInitializer, n => n.initializer, type(n => {
            const type = this.typeHelper.getCType(n.expression);
            return type instanceof ArrayType ? type.elementType : null
        }));
        addEquality(ts.isForInStatement, n => n.initializer, type(StringVarType));
        addEquality(ts.isForInStatement, n => n.expression, type(_ => new DictType(PointerVarType)));
        addEquality(ts.isReturnStatement, n => n.expression, type(n => FuncType.getReturnType(this.typeHelper, findParentFunction(n))));
        addEquality(ts.isReturnStatement, n => findParentFunction(n), type(n => this.typeHelper.getCType(n.expression) ? new FuncType({ returnType: this.typeHelper.getCType(n.expression) }) : null));
        addEquality(ts.isCaseClause, n => n.expression, n => n.parent.parent.expression);
        addEquality(ts.isCatchClause, n => n.variableDeclaration, type(StringVarType));

        this.resolveTypes(typeEqualities);
    }

    public resolveTypes(typeEqualities: Equality<any>[]) {
        this.allNodes.forEach(n => this.setNodeType(n, this.typeHelper.getCType(n)))

        let equalities: [ts.Node, Equality<any>][] = [];
        typeEqualities.forEach(teq =>
            this.allNodes.forEach(node => { if (teq[0].bind(this)(node)) equalities.push([node, teq]); })
        );

        let changed;
        do {
            changed = false;
            for (let equality of equalities) {
                let [node, [_, node1_func, node2_resolver]] = equality;
                let node1 = node1_func(node);
                if (!node1)
                    continue;

                let type1 = this.typeHelper.getCType(node1);

                let node2 = node2_resolver.getNode ? node2_resolver.getNode(node) : null;
                let type2 = node2_resolver.getType ? node2_resolver.getType(node) : this.typeHelper.getCType(node2);
                if (!node2 && !type2)
                    continue;

                let { type, replaced } = this.typeMerger.mergeTypes(type1, type2);
                if (type && replaced) {
                    if (type != type1)
                        changed = true;
                    if (node2 && type != type2)
                        changed = true;
                    this.setNodeType(node1, type);
                    if (node2)
                        this.propagateNodeType(node1, node2);
                }
            }
        } while (changed);

        for (let k in this.typeOfNodeDict) {
            const type = this.typeOfNodeDict[k].type;
            if (type instanceof ArrayType && !type.isDynamicArray && type.capacity == 0)
                type.isDynamicArray = true;
            if (type instanceof StructType && Object.keys(type.properties).length == 0)
                this.typeOfNodeDict[k].type = new DictType(PointerVarType);
        }

        this.allNodes
            .filter(n => ts.isFunctionLike(n))
            .forEach(n => console.log(n.getText(), "|", ts.SyntaxKind[n.kind], "|", (this.typeHelper.getCType(n) as FuncType).getBodyText()));

        /*
        this.allNodes
            .filter(n => !ts.isToken(n) && !ts.isBlock(n) && n.kind != ts.SyntaxKind.SyntaxList)
            .forEach(n => console.log(n.getText(), "|", ts.SyntaxKind[n.kind], "|", JSON.stringify(this.typeHelper.getCType(n))));
        */

    }

    public setNodeType(n: ts.Node, t: CType) {
        if (n && t) {
            const key = n.pos + "_" + n.end;
            if (!this.typeOfNodeDict[key])
                this.typeOfNodeDict[key] = { type: t };
            else
                this.typeOfNodeDict[key].type = t;
        }
    }
    private propagateNodeType(from, to) {
        const typeToKeep = this.typeOfNodeDict[from.pos + "_" + from.end];
        const typeToRemove = this.typeOfNodeDict[to.pos + "_" + to.end];
        this.typeOfNodeDict[to.pos + "_" + to.end] = typeToRemove;
        for (let key in this.typeOfNodeDict)
            if (this.typeOfNodeDict[key] === typeToRemove)
                this.typeOfNodeDict[key] = typeToKeep;
    }


}