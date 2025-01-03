import * as kataw from 'kataw';

import { StandardCallHelper } from '../standard';
import { isEqualsExpression, isFieldPropertyAccess, isFieldElementAccess, isMaybeStandardCall, isLiteral, isForOfWithSimpleInitializer, isForOfWithIdentifierInitializer, isDeleteExpression, isThisKeyword, isCompoundAssignment, isUnaryExpression, isStringLiteralAsIdentifier, isLogicOp, isFunction, getUnaryExprResultType, getBinExprResultType, operandsToNumber, toNumberCanBeNaN, findParentFunction, isUnder, getAllNodesUnder, isFieldAssignment, getAllFunctionNodesInFunction, isBooleanLiteral, isForInWithIdentifierInitializer, isForInWithSimpleInitializer, isStringLiteral, isNumericLiteral, isObjectLiteral, isArrayLiteral, isPropertyDefinition, getNodeText, isForInStatement, isReturnStatement, isVariableDeclaration, isCall, isNewExpression, isFunctionDeclaration, isBinaryExpression, isFieldAccess, isParenthesizedExpression, isVoidExpression, isTypeofExpression, isConditionalExpression, isCaseClause, isCatchClause, isFieldElementAccessNotMethodCall, isFieldPropertyAccessNotMethodCall, getVarDeclFromSimpleInitializer, isBindingElement, isCallArgument, isNewExpressionArgument, isParameter, isArrayLiteralElement, getNodeTextInContext, isLexicalBinding } from './utils';
import { CType, NumberVarType, StringVarType, ArrayType, StructType, DictType, FuncType, PointerVarType, UniversalVarType, ClosureParam } from './ctypes';
import { CircularTypesFinder } from './findcircular';
import { TypeMerger } from './merge';
import { TypeHelper } from './typehelper';
import { SyntaxNode } from 'kataw';
import { SymbolsHelper } from '../symbols';

type NodeFunc<T extends kataw.SyntaxNode> = { (n: T): kataw.SyntaxNode };
type NodeResolver<T extends kataw.SyntaxNode> = { getNode?: NodeFunc<T>, getType?: { (n: T): CType } };
type Equality<T extends kataw.SyntaxNode> = [{ (n): n is T }, NodeFunc<T>, NodeResolver<T>];

export class TypeResolver {

    constructor(
        public typeHelper: TypeHelper,
        public symbolsHelper: SymbolsHelper,
        private standardCallHelper: StandardCallHelper,
        private typeMerger: TypeMerger,
        private typeOfNodeDict: { [id: string]: { type: CType } }
    ) { }

    /** Postprocess TypeScript AST for better type inference and map TS types to C types */
    /** Creates typeOfNodeDict that is later used in getCType */
    public inferTypes(allNodes: SyntaxNode[]) {

        const finder = new CircularTypesFinder(allNodes, this.symbolsHelper);
        const circularAssignments = finder.findCircularAssignments();

        const type = <T extends kataw.SyntaxNode>(t: { (n: T): CType } | string): NodeResolver<T> => ({ getType: typeof (t) === "string" ? _ => t : t });
        const struct = (prop: string, pos: number, elemType: CType = PointerVarType, recursive: boolean = false): StructType => new StructType({ [prop]: { type: elemType, order: pos, recursive } });

        let typeEqualities: Equality<any>[] = [];

        const addEquality = <T extends kataw.SyntaxNode>(typeGuard: { (n): n is T }, node1: NodeFunc<T>, node2: NodeFunc<T> | NodeResolver<T>) => {
            if (typeof node2 == "function")
                typeEqualities.push([typeGuard, node1, { getNode: node2 }]);
            else
                typeEqualities.push([typeGuard, node1, node2]);
        };

        // literals
        addEquality(isObjectLiteral, n => n, type(n => {
            if (n.propertyList.properties.some(p => p.kind === kataw.SyntaxKind.ComputedPropertyName)) {
                let elemType = this.typeHelper.getCType(n.propertyList.properties[0]);
                for (let i = 1; i < n.propertyList.properties.length - 1; i++) {
                    const mergeResult = this.typeMerger.mergeTypes(elemType, this.typeHelper.getCType(n.propertyList.properties[i]));
                    if (mergeResult.replaced)
                        elemType = mergeResult.type;
                }
                return new DictType(elemType);
            }
            const props: Record<string, { type: CType, order: number }> = {};
            for (let i = 0; i < n.propertyList.properties.length - 1; i++) {
                const prop = n.propertyList.properties[i];
                if (kataw.isIdentifier(prop))
                    props[prop.text] = { type: this.typeHelper.getCType(prop) || PointerVarType, order: i };
            }
            return this.typeMerger.ensureNoTypeDuplicates(new StructType(props))
        }));

        addEquality(isArrayLiteral, n => n, type(n => {
            let elemType = null;
            for (const elem of n.elementList.elements) {
                const type = this.typeHelper.getCType(elem);
                if (type) {
                    const result = this.typeMerger.mergeTypes(elemType, type);
                    if (result.replaced)
                        elemType = result.type;
                }
            }
            return elemType ? new ArrayType(elemType, 0, false) : null;
        }));
        addEquality(isArrayLiteralElement, n => n, type(elem => {
            const arrayLiteral = <kataw.ArrayLiteral>elem.parent.parent;
            const arrType = this.typeHelper.getCType(arrayLiteral);
            return arrType && arrType instanceof ArrayType ? arrType.elementType
                : arrType === UniversalVarType ? UniversalVarType
                : null
        }));

        /* TODO
        addEquality(ts.isJSDoc, n => n, type(n => {
            const cTypeTag = n && n.tags && n.tags.filter(t => t.tagName.text === "ctype")[0];
            structType.forcedType = cTypeTag && cTypeTag.text.map(t => t.text).join().trim();
            structType.external = tsType && tsType.symbol && findParentSourceFile(tsType.symbol.declarations[0]).isDeclarationFile;
        }))
        */

        // left hand side
        addEquality(kataw.isIdentifier, n => n, n => this.typeHelper.getDeclaration(n));
        addEquality(isPropertyDefinition, n => n, n => n.right);
        addEquality(isPropertyDefinition, n => n.parent.parent, type(n => {
            const propName = (kataw.isIdentifier(n.left) || isStringLiteralAsIdentifier(n.left)) && n.left.text;
            if (propName)
                return struct(propName, n.start, this.typeHelper.getCType(n) || PointerVarType)
            else
                return new DictType(this.typeHelper.getCType(n));
        }));
        addEquality(isPropertyDefinition, n => n, type(n => {
            const propName = (kataw.isIdentifier(n.left) || isStringLiteralAsIdentifier(n.left)) && n.left.text;
            const type = this.typeHelper.getCType(n.parent.parent);
            return type instanceof StructType ? type.properties[propName]
                : type instanceof DictType ? type.elementType
                : null;
        }));
        addEquality(isPropertyDefinition, n => n, type(n => {
            const type = this.typeHelper.getCType(n.right);
            if (type instanceof FuncType && type.closureParams.length)
                return new FuncType({ needsClosureStruct: true });
            else
                return null;
        }))
        addEquality(isFieldPropertyAccess, n => n, n => n.expression);
        addEquality(isFieldPropertyAccess, n => n.member, type(n => {
            const type = this.typeHelper.getCType(n);
            if (isMaybeStandardCall(n.parent) && n.parent.expression === n) {
                if (!type)
                    return null;
                if (this.standardCallHelper.isStandardCall(n.parent))
                    return null;
            }
            return struct(getNodeText(n.expression), n.start, type || PointerVarType)
        }));
        addEquality(isFieldPropertyAccess, n => n, type(n => {
            const type = this.typeHelper.getCType(n.member);
            return type instanceof StructType ? type.properties[getNodeText(n.expression)]
                : type instanceof ArrayType && getNodeText(n.expression) == "length" ? NumberVarType
                : type === StringVarType && getNodeText(n.expression) == "length" ? NumberVarType
                : type instanceof ArrayType || type instanceof DictType ? type.elementType
                : type === UniversalVarType && getNodeText(n.expression) == "length" ? NumberVarType
                : type === UniversalVarType ? UniversalVarType
                : null;
        }));
        addEquality(isFieldElementAccessNotMethodCall, n => n.member, type(n => {
            const type = this.typeHelper.getCType(n.expression);
            const elementType = this.typeHelper.getCType(n) || PointerVarType;
            return isStringLiteralAsIdentifier(n.expression) ? struct(n.expression.text, n.start, elementType)
                : isNumericLiteral(n.expression) ? new ArrayType(elementType, 0, false)
                : type == NumberVarType ? new ArrayType(elementType, 0, false)
                : type == StringVarType ? new DictType(elementType)
                : null
        }));
        addEquality(isFieldElementAccessNotMethodCall, n => n, type(n => {
            const type = this.typeHelper.getCType(n.member);
            return isStringLiteral(n.expression) && type instanceof StructType ? type.properties[n.expression.text]
                : isStringLiteral(n.expression) && type instanceof ArrayType && n.expression.text == "length" ? NumberVarType
                : isStringLiteral(n.expression) && type === StringVarType && n.expression.text == "length" ? NumberVarType
                : isStringLiteral(n.expression) && type === UniversalVarType && n.expression.text == "length" ? NumberVarType
                : type instanceof ArrayType || type instanceof DictType ? type.elementType
                : type === UniversalVarType ? UniversalVarType
                : null
        }));

        // expressions
        addEquality(isEqualsExpression, n => n.left, n => circularAssignments[n.start] ? null : n.right);
        addEquality(isEqualsExpression, n => n.left, type(n => {
            const type = this.typeHelper.getCType(n.right);
            if (type instanceof FuncType && type.closureParams.length)
                return new FuncType({ needsClosureStruct: true });
            else
                return null;
        }));
        addEquality(isFieldAssignment, n => n.left.member, type(n => {
            if (!circularAssignments[n.start])
                return null;
            return isFieldElementAccess(n.left) && isStringLiteral(n.left.expression) ? struct(n.left.expression.text, n.left.start, PointerVarType, true)
                : isFieldPropertyAccess(n.left) && kataw.isIdentifier(n.left.expression) ? struct(n.left.expression.text, n.left.start, PointerVarType, true)
                : null;
        }));
        addEquality(isConditionalExpression, n => n.consequent, n => n.alternate);
        addEquality(isConditionalExpression, n => n, n => n.alternate);
        addEquality(isUnaryExpression, n => n, type(n => getUnaryExprResultType(n.operandToken.kind, this.typeHelper.getCType(n.operand))));
        addEquality(isUnaryExpression, n => n.operand, type(n => {
            if (n.operandToken.kind !== kataw.SyntaxKind.Increment && n.operandToken.kind !== kataw.SyntaxKind.Decrement)
                return null;
            const resultType = this.typeHelper.getCType(n);
            const accessObjType = (isFieldAccess(n.operand)) && this.typeHelper.getCType(n.operand.member);
            const isDictAccessor = accessObjType instanceof DictType;
            if (resultType == UniversalVarType || toNumberCanBeNaN(resultType) || isDictAccessor)
                return UniversalVarType;
            else
                return null;
        }));
        addEquality(isBinaryExpression, n => n, type(n => getBinExprResultType(this.typeMerger.mergeTypes.bind(this.typeMerger), this.typeHelper.getCType(n.left), n.operatorToken.kind, this.typeHelper.getCType(n.right))));
        addEquality(isBinaryExpression, n => n.left, type(n => {
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
        addEquality(isBinaryExpression, n => n.right, type(n => {
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
        addEquality(isParenthesizedExpression, n => n, n => n.expression);
        addEquality(isVoidExpression, n => n.operand, type(PointerVarType));
        addEquality(isDeleteExpression, n => n.operand.member, type(n => new DictType(UniversalVarType)));

        // functions
        addEquality(isCall, n => n.expression, n => kataw.isIdentifier(n.expression) ? this.typeHelper.getDeclaration(n.expression) : null);
        addEquality(isCall, n => n.expression, type(n => this.typeHelper.getCType(n) ? new FuncType({ returnType: this.typeHelper.getCType(n), parameterTypes: n.argumentList.elements.map(arg => this.typeHelper.getCType(arg)) }) : null));
        addEquality(isCallArgument, n => n, n => {
            const call = <kataw.CallExpression>n.parent.parent;
            const argIndex = call.argumentList.elements.indexOf(n);
            const decl = kataw.isIdentifier(call.expression) ? this.typeHelper.getDeclaration(call.expression) : null;
            if (decl && isFunctionDeclaration(decl.parent)) {
                const param = decl.parent.formalParameterList.formalParameters[argIndex];
                return this.typeHelper.getCType(param) instanceof FuncType ? param : null;
            } else
                return null;
        });    
        addEquality(isCall, n => n.expression, type(n => {
            // nested call expression e.g. `func(1, 2)()`
            if (isCall(n) && isCall(n.expression)) {
                const type = this.typeHelper.getCType(n.expression);
                if (type instanceof FuncType && type.closureParams.length)
                    return new FuncType({ needsClosureStruct: true });
            }
            return null;
        }))
        addEquality(isCall, n => n, type(n => FuncType.getReturnType(this.typeHelper, n.expression)));
        addEquality(isBindingElement, n => n, n => n.left);
        addEquality(isBindingElement, n => n, n => n.right);

        addEquality(isNewExpression, n => n, type(n => 
            kataw.isIdentifier(n.expression) && n.expression.text === "Object" ? new StructType({})
            : FuncType.getInstanceType(this.typeHelper, n.expression)
        ));
        addEquality(isNewExpressionArgument, n => n, n => {
            const newExpr = <kataw.NewExpression>n.parent.parent;
            const argIndex = newExpr.argumentList.elements.indexOf(n);
            const funcName = kataw.isIdentifier(newExpr.expression) ? this.typeHelper.getDeclaration(newExpr.expression) : null;
            return funcName && isFunctionDeclaration(funcName.parent) ? funcName.parent.formalParameterList.formalParameters[argIndex] : null
        });
        addEquality(isThisKeyword, n => findParentFunction(n), type(n => {
            return new FuncType({ instanceType: this.typeHelper.getCType(n) })
        }));
        addEquality(isThisKeyword, n => n, type(n => FuncType.getInstanceType(this.typeHelper, findParentFunction(n))));

        addEquality(isMaybeStandardCall, n => n.expression.member, type(n => this.standardCallHelper.getObjectType(n)));
        addEquality(isMaybeStandardCall, n => n, type(n => this.standardCallHelper.getReturnType(n)));
        addEquality(isCallArgument, n => n, type(n => {
            if (isLiteral(n))
                return null;
            if (isMaybeStandardCall(n.parent.parent)) {
                const argIndex = n.parent.parent.argumentList.elements.indexOf(n);
                return this.standardCallHelper.getArgumentTypes(n.parent.parent)[argIndex]
            }
        }));

        addEquality(isFunction, n => n, n => n.name);
        addEquality(isFunction, n => n, type(n => new FuncType({ parameterTypes: n.formalParameterList.formalParameters.map(p => this.typeHelper.getCType(p)) })));
        addEquality(isParameter, n => n, type(param => {
            const func = <kataw.FunctionDeclaration | kataw.FunctionExpression>param.parent.parent;
            const paramIndex = func.formalParameterList.formalParameters.indexOf(param);
            const type = this.typeHelper.getCType(func);
            return type instanceof FuncType ? type.parameterTypes[paramIndex] : null
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
                        scopePropDefs[p.node.text] = { type: this.typeHelper.getCType(p.node) || PointerVarType, pos: decl.start };
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
            const closureParams: ClosureParam[] = [];
            nodesInFunction.filter(n => kataw.isIdentifier(n))
                .forEach((ident: kataw.Identifier) => {
                    const identDecl = this.typeHelper.getDeclaration(ident);
                    // if declaration of identifier is function (i.e. function param), and it is not under node
                    // (then it is defined in a parent func obviously), then add closure params of this parent function
                    if (identDecl && isFunction(identDecl.parent) && !isUnder(node, identDecl.parent)) {
                        const identDeclType = this.typeHelper.getCType(identDecl) as FuncType;
                        if (!identDeclType)
                            return;
                        for (let param of identDeclType.closureParams) {
                            if (!closureParams.some(p => p.node.text === param.node.text))
                                closureParams.push(param);
                        }
                    } else {
                        const identDeclFunc = identDecl && findParentFunction(identDecl);
                        const isFieldName = isFieldPropertyAccess(ident.parent) && ident.parent.expression === ident;
                        const assigned = isEqualsExpression(ident.parent) || isCompoundAssignment(ident.parent);
                        if (identDeclFunc && identDeclFunc != node && isUnder(identDeclFunc, node) && !isFieldName) {
                            const existing = closureParams.filter(p => p.node.text === ident.text)[0];
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
        addEquality(isVariableDeclaration, n => n.binding, n => n);
        addEquality(isVariableDeclaration, n => n.binding, n => n.initializer);
        addEquality(isVariableDeclaration, n => n.binding, type(n => {
            const type = this.typeHelper.getCType(n.initializer);
            if (type instanceof FuncType && type.closureParams.length)
                return new FuncType({ needsClosureStruct: true });
            else
                return null;
        }))
        addEquality(isForOfWithSimpleInitializer, n => n.expression, type(n => new ArrayType(this.typeHelper.getCType(getVarDeclFromSimpleInitializer(n.initializer)) || PointerVarType, 0, false)));
        addEquality(isForOfWithSimpleInitializer, n => getVarDeclFromSimpleInitializer(n.initializer), type(n => {
            const type = this.typeHelper.getCType(n.expression);
            return type instanceof ArrayType ? type.elementType : null
        }));
        addEquality(isForOfWithIdentifierInitializer, n => n.expression, type(n => new ArrayType(this.typeHelper.getCType(n.initializer) || PointerVarType, 0, false)));
        addEquality(isForOfWithIdentifierInitializer, n => n.initializer, type(n => {
            const type = this.typeHelper.getCType(n.expression);
            return type instanceof ArrayType ? type.elementType : null
        }));
        addEquality(isForInWithIdentifierInitializer, n => n.initializer, type(StringVarType));
        addEquality(isForInWithSimpleInitializer, n => getVarDeclFromSimpleInitializer(n.initializer), type(StringVarType));
        addEquality(isForInStatement, n => n.expression, type(_ => new DictType(PointerVarType)));
        addEquality(isReturnStatement, n => n.expression, type(n => FuncType.getReturnType(this.typeHelper, findParentFunction(n))));
        addEquality(isReturnStatement, n => findParentFunction(n), type(n => this.typeHelper.getCType(n.expression) ? new FuncType({ returnType: this.typeHelper.getCType(n.expression) }) : null));
        addEquality(isCaseClause, n => n.expression, n => (<kataw.SwitchStatement>(<kataw.CaseBlock>n.parent).parent).expression);
        addEquality(isCatchClause, n => n.catchParameter, type(StringVarType));

        this.resolveTypes(allNodes, typeEqualities);
    }

    public resolveTypes(allNodes: kataw.SyntaxNode[], typeEqualities: Equality<any>[]) {
        let equalities: [kataw.SyntaxNode, Equality<any>][] = [];
        for (const node of allNodes) {
            this.setNodeType(node, this.typeHelper.getCType(node));
            for (const teq of typeEqualities) {
                if (teq[0].bind(this)(node))
                    equalities.push([node, teq]);
            }
        }

        for (const symbol of this.symbolsHelper.globalSymbolsWithResolvers) {
            for (const ref of symbol.references) {
                if (!isCall(ref.parent))
                    continue;
                const returnType = symbol.resolver!.returnType(this.typeHelper, ref.parent);
                this.setNodeType(ref.parent, returnType);
                this.setNodeType(ref, returnType);
                if (ref.parent.argumentList.elements.length > 0 && symbol.resolver!.argumentTypes) {
                    const argTypes = symbol.resolver!.argumentTypes(this.typeHelper, ref.parent);
                    for (let i = 0; i < ref.parent.argumentList.elements.length; i++)
                        this.setNodeType(ref.parent.argumentList.elements[i], argTypes[i]);
                }
            }
        }

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

        /*
        allNodes
            .filter(n => isFunction(n))
            .forEach(n => console.log(getNodeText(n), "|", kataw.SyntaxKind[n.kind], "|", (this.typeHelper.getCType(n) as FuncType).getBodyText()));
        */allNodes
            .filter(n => (!kataw.isKeyword(n) || n.kind === kataw.SyntaxKind.ThisKeyword)
                && n.kind !== kataw.SyntaxKind.Block
                && n.kind !== kataw.SyntaxKind.BlockStatement
                && n.kind !== kataw.SyntaxKind.ExpressionStatement
                && n.kind !== kataw.SyntaxKind.FunctionBody
                && n.kind !== kataw.SyntaxKind.FunctionStatementList
            )
            .forEach(n => {
                const type = this.typeHelper.getCType(n);
                console.log(getNodeTextInContext(n), "|", kataw.SyntaxKind[n.kind], "|", type == null || typeof type === "string" ? type : type.getBodyText());
            })
        //*/

    }

    public setNodeType(n: kataw.SyntaxNode, t: CType) {
        if (n && t) {
            const key = n.id;
            if (!this.typeOfNodeDict[key])
                this.typeOfNodeDict[key] = { type: t };
            else
                this.typeOfNodeDict[key].type = t;
        }
    }
    private propagateNodeType(from: kataw.SyntaxNode, to: kataw.SyntaxNode) {
        const typeToKeep = this.typeOfNodeDict[from.id];
        const typeToRemove = this.typeOfNodeDict[to.id];
        this.typeOfNodeDict[to.id] = typeToRemove;
        for (let key in this.typeOfNodeDict)
            if (this.typeOfNodeDict[key] === typeToRemove)
                this.typeOfNodeDict[key] = typeToKeep;
    }


}