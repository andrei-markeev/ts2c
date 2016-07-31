import * as ts from 'typescript';
import {CodeTemplate, CodeTemplateFactory} from '../template';
import {IScope} from '../program';
import {ArrayType, StructType, NumberVarType, BooleanVarType, CType} from '../types';
import {AssignmentHelper, CAssignment} from './assignment';
import {CElementAccess, CSimpleElementAccess} from './elementaccess';


@CodeTemplate(`{declarations}`, ts.SyntaxKind.VariableStatement)
export class CVariableStatement {
    public declarations: CVariableDeclaration[];
    constructor(scope: IScope, node: ts.VariableStatement)
    {
        this.declarations = node.declarationList.declarations.map(d => CodeTemplateFactory.createForNode(scope, d));
    }
}

@CodeTemplate(`{declarations}`, ts.SyntaxKind.VariableDeclarationList)
export class CVariableDeclarationList {
    public declarations: CVariableDeclaration[];
    constructor(scope: IScope, node: ts.VariableDeclarationList)
    {
        this.declarations = node.declarations.map(d => CodeTemplateFactory.createForNode(scope, d));
    }
}


@CodeTemplate(`
{allocator}
{initializer}`, ts.SyntaxKind.VariableDeclaration)
export class CVariableDeclaration {
    public allocator: CVariableAllocation | string = '';
    public initializer: CAssignment | string = '';

    constructor(scope: IScope, varDecl: ts.VariableDeclaration) {
        let varInfo = scope.root.typeHelper.getVariableInfo(<ts.Identifier>varDecl.name);
        scope.variables.push(new CVariable(scope, varInfo.name, varInfo.type));
        if (varInfo.requiresAllocation)
            this.allocator = new CVariableAllocation(scope, varInfo.name, varInfo.type, varDecl.name);
        if (varDecl.initializer)
            this.initializer = AssignmentHelper.create(scope, varDecl.name, varDecl.initializer);
    }
}

@CodeTemplate(`
{#if needAllocateArray}
    ARRAY_CREATE({varName}, {initialCapacity}, {size});
{#elseif needAllocateStruct}
    {varName} = malloc(sizeof(*{varName}));
    assert({varName} != NULL);
{/if}
{#if gcVarName && (needAllocateStruct || needAllocateArray)}
    ARRAY_PUSH({gcVarName}, (void *){varName});
{/if}
`)
export class CVariableAllocation {
    public isArray: boolean;
    public needAllocateArray: boolean;
    public initialCapacity: number;
    public size: number;
    public needAllocateStruct: boolean;
    public isStruct: boolean;
    public isDict: boolean;
    public gcVarName: string;
    constructor(scope: IScope, public varName: CElementAccess | CSimpleElementAccess |string, varType: CType, refNode: ts.Node)
    {
        this.needAllocateArray = varType instanceof ArrayType && varType.isDynamicArray;
        this.needAllocateStruct = varType instanceof StructType;

        this.gcVarName = scope.root.memoryManager.getGCVariableForNode(refNode);
        this.isStruct = varType instanceof StructType && !varType.isDict;
        this.isDict = varType instanceof StructType && varType.isDict;
        this.isArray = varType instanceof ArrayType;
        if (varType instanceof ArrayType) {
            this.initialCapacity = Math.max(varType.capacity * 2, 4);
            this.size = varType.capacity;
        }
        
        if (this.needAllocateStruct || this.needAllocateArray)
            scope.root.headerFlags.malloc = true;
        if (this.gcVarName || this.needAllocateArray)
            scope.root.headerFlags.array = true;
        if (this.gcVarName)
            scope.root.headerFlags.gc_iterator = true;
    }

}

@CodeTemplate(`
{destructors {    }=> free({this});\n}
{#if gcArraysVarName}
        for (gc_i = 0; gc_i < {gcArraysVarName}->size; gc_i++) {
            free({gcArraysVarName}->data[gc_i]->data);
            free({gcArraysVarName}->data[gc_i]);
        }
        free({gcArraysVarName}->data);
        free({gcArraysVarName});
{/if}
{#if gcVarName}
        for (gc_i = 0; gc_i < {gcVarName}->size; gc_i++)
            free({gcVarName}->data[gc_i]);
        free({gcVarName}->data);
        free({gcVarName});
{/if}`
)
export class CVariableDestructors {
    public gcVarName: string = null;
    public gcArraysVarName: string = null;
    public destructors: string[];
    constructor(scope: IScope, node: ts.Node) {
        let gcVarNames = scope.root.memoryManager.getGCVariablesForScope(node);
        for (let gc of gcVarNames)
        {
            if (gc.indexOf("arrays") > -1)
                this.gcArraysVarName = gc;
            else
                this.gcVarName = gc;
        }
        
        this.destructors = [];
        scope.root.memoryManager.getDestructorsForScope(node)
            .forEach(r => {
                let type = scope.root.typeHelper.getCType(r.node);
                if (type instanceof ArrayType)
                    this.destructors.push(r.varName + "->data");
                this.destructors.push(r.varName);
            })
    }
}


interface CVariableOptions {
    removeStorageSpecifier?: boolean;
    initializer?: string;
}

export class CVariable {
    private varString: string;
    constructor(scope: IScope, public name: string, private typeSource, options?: CVariableOptions) {
        let typeString = scope.root.typeHelper.getTypeString(typeSource);
        if (typeString == NumberVarType)
            scope.root.headerFlags.int16_t = true;
        else if (typeString == BooleanVarType)
            scope.root.headerFlags.uint8_t = true;
        if (typeString.indexOf('{var}') > -1)
            this.varString = typeString.replace('{var}', name);
        else
            this.varString = typeString + " " + name;

        // root scope, make variables file-scoped by default
        if (scope.parent == null && this.varString.indexOf('static') != 0)
            this.varString = 'static ' + this.varString;
        
        if (options && options.removeStorageSpecifier)
            this.varString = this.varString.replace(/^static /,'');
        if (options && options.initializer)
            this.varString += " = " + options.initializer;
    }
    resolve() {
        return this.varString;
    }
}
