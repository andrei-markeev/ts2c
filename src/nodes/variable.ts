import * as kataw from '@andrei-markeev/kataw';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from '../template';
import { IScope } from '../program';
import { ArrayType, StructType, DictType, NumberVarType, BooleanVarType, CType, UniversalVarType, FuncType } from '../types/ctypes';
import { AssignmentHelper, CAssignment } from './assignment';
import { CElementAccess, CSimpleElementAccess } from './elementaccess';
import { getNodeText, isArrayLiteral, isNode, isNumericLiteral, isStringLiteral, isVariableDeclarationList } from '../types/utils';
import { TypeHelper } from '../types/typehelper';


@CodeTemplate(`{declarations}`, kataw.SyntaxKind.VariableStatement)
export class CVariableStatement extends CTemplateBase {
    public declarations: CVariableDeclaration[];
    constructor(scope: IScope, node: kataw.VariableStatement)
    {
        super();
        this.declarations = node.declarationList.declarations.map(d => CodeTemplateFactory.createForNode(scope, d) as CVariableDeclaration);
    }
}

@CodeTemplate(`{declarations}`, [kataw.SyntaxKind.VariableDeclarationList, kataw.SyntaxKind.LexicalDeclaration])
export class CVariableDeclarationList extends CTemplateBase {
    public declarations: CVariableDeclaration[];
    constructor(scope: IScope, node: kataw.VariableDeclarationList | kataw.LexicalDeclaration)
    {
        super();
        if (isVariableDeclarationList(node))
            this.declarations = node.declarations.map(d => CodeTemplateFactory.createForNode(scope, d) as CVariableDeclaration);
        else
            this.declarations = node.binding.bindingList.map(d => CodeTemplateFactory.createForNode(scope, d) as CVariableDeclaration)
    }
}


@CodeTemplate(`{initializer}`, [kataw.SyntaxKind.VariableDeclaration, kataw.SyntaxKind.LexicalBinding])
export class CVariableDeclaration extends CTemplateBase {
    public allocator: CVariableAllocation | string = '';
    public initializer: CAssignment | string = '';

    constructor(scope: IScope, varDecl: kataw.VariableDeclaration | kataw.LexicalBinding) {
        super();
        if (!kataw.isIdentifier(varDecl.binding)) {
            this.initializer = "/* Unsupported variable declaration binding '" + getNodeText(varDecl.binding) + "' */";
            return;
        }
        const name = varDecl.binding.text;
        const type = scope.root.typeHelper.getCType(varDecl.binding);
        const scopeVar = kataw.isIdentifier(varDecl.binding) ? scope.root.typeHelper.isScopeVariableDeclaration(varDecl.binding) : false;
        if (type instanceof ArrayType && !type.isDynamicArray && isArrayLiteral(varDecl.initializer) && !scopeVar) {
            const canUseInitializerList = varDecl.initializer.elementList.elements.every(e => isNumericLiteral(e) || isStringLiteral(e));
            if (canUseInitializerList) {
                let s = "{ ";
                for (let i = 0; i < type.capacity; i++) {
                    if (i != 0)
                        s += ", ";
                    let cExpr = CodeTemplateFactory.createForNode(scope, varDecl.initializer.elementList.elements[i]);
                    s += typeof cExpr === 'string' ? cExpr : (<any>cExpr).resolve();
                }
                s += " }";
                scope.variables.push(new CVariable(scope, name, type, { initializer: s }));
                return;
            }
        }

        if (!scope.variables.some(v => v.name === name) && !scopeVar)
            scope.variables.push(new CVariable(scope, name, type));
        if (varDecl.initializer)
            this.initializer = AssignmentHelper.create(scope, varDecl.binding, varDecl.initializer);
    }
}

@CodeTemplate(`
{#if needAllocateArray}
    ARRAY_CREATE({varName}, {initialCapacity}, {size});
{#elseif needAllocateDict}
    DICT_CREATE({varName}, {initialCapacity});
{#elseif needAllocateStruct}
    {varName} = malloc(sizeof(*{varName}));
    assert({varName} != NULL);
{/if}
{#if gcVarName && (needAllocateStruct || needAllocateArray || needAllocateDict)}
    ARRAY_PUSH({gcVarName}, (void *){varName});
{/if}
`)
export class CVariableAllocation extends CTemplateBase {
    public isArray: boolean;
    public needAllocateArray: boolean;
    public initialCapacity: number;
    public size: number;
    public needAllocateStruct: boolean;
    public needAllocateDict: boolean;
    public gcVarName: string;
    constructor(scope: IScope, public varName: CElementAccess | CSimpleElementAccess | string, varType: CType, refNode: kataw.SyntaxNode)
    {
        super();
        this.needAllocateArray = varType instanceof ArrayType && varType.isDynamicArray;
        this.needAllocateStruct = varType instanceof StructType || varType instanceof FuncType && varType.needsClosureStruct;
        this.needAllocateDict = varType instanceof DictType;
        this.initialCapacity = 4;

        this.gcVarName = scope.root.memoryManager.getGCVariableForNode(refNode);
        if (varType instanceof ArrayType) {
            this.initialCapacity = Math.max(varType.capacity * 2, 4);
            this.size = varType.capacity;
        }

        if (this.needAllocateStruct || this.needAllocateArray || this.needAllocateDict)
            scope.root.headerFlags.malloc = true;
        if (this.gcVarName || this.needAllocateArray)
            scope.root.headerFlags.array = true;
        if (varType instanceof ArrayType && varType.elementType == UniversalVarType)
            scope.root.headerFlags.js_var_array = true;
        if (varType instanceof DictType && varType.elementType == UniversalVarType)
            scope.root.headerFlags.js_var_dict = true;
        else if (this.needAllocateDict)
            scope.root.headerFlags.dict = true;
        if (this.gcVarName)
            scope.root.headerFlags.gc_iterator = true;
    }

}

@CodeTemplate(`
{#statements}
    {arrayDestructors => for (gc_i = 0; gc_i < ({this} ? {this}->size : 0); gc_i++) free((void*){this}->data[gc_i]);\n}
    {destructors => free({this});\n}
    {#if gcArraysCVarName}
        for (gc_i = 0; gc_i < {gcArraysCVarName}->size; gc_i++) {
            for (gc_j = 0; gc_j < ({gcArraysCVarName}->data[gc_i] ? {gcArraysCVarName}->data[gc_i]->size : 0); gc_j++)
                free((void*){gcArraysCVarName}->data[gc_i]->data[gc_j]);\n
            free({gcArraysCVarName}->data[gc_i] ? {gcArraysCVarName}->data[gc_i]->data : NULL);
            free({gcArraysCVarName}->data[gc_i]);
        }
        free({gcArraysCVarName}->data);
        free({gcArraysCVarName});
    {/if}
    {#if gcArraysVarName}
        for (gc_i = 0; gc_i < {gcArraysVarName}->size; gc_i++) {
            free({gcArraysVarName}->data[gc_i]->data);
            free({gcArraysVarName}->data[gc_i]);
        }
        free({gcArraysVarName}->data);
        free({gcArraysVarName});
    {/if}
    {#if gcDictsVarName}
        for (gc_i = 0; gc_i < {gcDictsVarName}->size; gc_i++) {
            free({gcDictsVarName}->data[gc_i]->index->data);
            free({gcDictsVarName}->data[gc_i]->index);
            free({gcDictsVarName}->data[gc_i]->values->data);
            free({gcDictsVarName}->data[gc_i]->values);
            free({gcDictsVarName}->data[gc_i]);
        }
        free({gcDictsVarName}->data);
        free({gcDictsVarName});
    {/if}
    {#if gcVarName}
        for (gc_i = 0; gc_i < {gcVarName}->size; gc_i++)
            free({gcVarName}->data[gc_i]);
        free({gcVarName}->data);
        free({gcVarName});
    {/if}
{/statements}`
)
export class CVariableDestructors extends CTemplateBase {
    public gcVarName: string = null;
    public gcArraysVarName: string = null;
    public gcArraysCVarName: string = null;
    public gcDictsVarName: string = null;
    public destructors: string[];
    public arrayDestructors: string[] = [];
    constructor(scope: IScope, node: kataw.SyntaxNode) {
        super();
        let gcVarNames = scope.root.memoryManager.getGCVariablesForScope(node);
        for (let gc of gcVarNames)
        {
            if (gc.indexOf("_arrays_c") > -1)
                this.gcArraysCVarName = gc;
            else if (gc.indexOf("_dicts") > -1)
                this.gcDictsVarName = gc;
            else if (gc.indexOf("_arrays") > -1)
                this.gcArraysVarName = gc;
            else
                this.gcVarName = gc;
        }
        
        this.destructors = [];
        scope.root.memoryManager.getDestructorsForScope(node)
            .forEach(r => {
                if (r.array) {
                    this.destructors.push(r.varName + "->data");
                    this.destructors.push(r.varName);
                } else if (r.arrayWithContents) {
                    scope.root.headerFlags.gc_iterator2 = true;
                    this.arrayDestructors.push(r.varName);
                    this.destructors.push(r.varName + " ? " + r.varName + "->data : NULL");
                    this.destructors.push(r.varName);
                } else if (r.dict) {
                    this.destructors.push(r.varName + "->index->data");
                    this.destructors.push(r.varName + "->index");
                    this.destructors.push(r.varName + "->values->data");
                    this.destructors.push(r.varName + "->values");
                    this.destructors.push(r.varName);
                } else if (r.string) {
                    this.destructors.push("(char *)" + r.varName);
                } else
                    this.destructors.push(r.varName);
            })
    }
}

interface CVariableOptions {
    removeStorageSpecifier?: boolean;
    arraysToPointers?: boolean;
    initializer?: string;
    funcDecl?: boolean;
}

export class CVariable extends CTemplateBase {
    private static: boolean;
    private arraysToPointers: boolean;
    private initializer: string;
    private funcDecl: boolean;
    public type: CType;
    private typeHelper: TypeHelper;

    constructor(scope: IScope, public name: string, typeSource: CType | kataw.SyntaxNode, options?: CVariableOptions) {
        super();
        const type = isNode(typeSource) ? scope.root.typeHelper.getCType(typeSource) : typeSource;

        if (type instanceof StructType)
            scope.root.symbolsHelper.ensureStruct(type, name);
        else if (type instanceof ArrayType && type.isDynamicArray)
            scope.root.symbolsHelper.ensureArrayStruct(scope.root.typeHelper, type.elementType);

        if (this.typeHasNumber(type))
            scope.root.headerFlags.int16_t = true;
        if (type == BooleanVarType)
            scope.root.headerFlags.bool = true;
        if (type instanceof ArrayType && type.elementType == UniversalVarType)
            scope.root.headerFlags.js_var_dict = true;
        if (type instanceof DictType && type.elementType == UniversalVarType)
            scope.root.headerFlags.js_var_dict = true;

        // root scope, make variables file-scoped by default
        if (scope.parent == null)
            this.static = true;
        if (options && options.removeStorageSpecifier)
            this.static = false;
        this.arraysToPointers = options && options.arraysToPointers;
        if (options && options.initializer)
            this.initializer = options.initializer;
        this.funcDecl = options && options.funcDecl;
        
        this.type = type;
        this.typeHelper = scope.root.typeHelper;
    }
    typeHasNumber(type: CType) {
        return type == NumberVarType
            || type instanceof ArrayType && this.typeHasNumber(type.elementType)
            || type instanceof ArrayType && type.isDynamicArray
            || type instanceof StructType && Object.keys(type.properties).some(k => this.typeHasNumber(type.properties[k]))
            || type instanceof DictType;
    }
    resolve() {
        let varString: string;
        if (this.funcDecl && this.type instanceof FuncType)
            varString = this.type.getPointerToTypeText();
        else
            varString = this.typeHelper.getTypeString(this.type);

        if (this.arraysToPointers)
            varString = varString.replace(/ \{var\}\[\d+\]/g, "* {var}");

        if (varString.indexOf('{var}') > -1)
            varString = varString.replace('{var}', this.name);
        else
            varString = varString + " " + this.name;

        if (this.static && varString.indexOf('static') != 0)
            varString = 'static ' + varString;
        else if (!this.static)
            varString = varString.replace(/^static /, '');
    
        if (this.initializer)
            varString += " = " + this.initializer;

        return varString;
    }
}
