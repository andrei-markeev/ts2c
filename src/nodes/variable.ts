import * as ts from 'typescript';
import {CodeTemplate} from '../template';
import {IScope} from '../program';
import {ArrayType, StructType} from '../types';
import {AssignmentHelper, CAssignment} from './assignment';

@CodeTemplate(`
{#if needAllocateArray}
    ARRAY_CREATE({varName}, {initialCapacity}, {size});
{/if}
{#if needAllocate}
    {varName} = malloc(sizeof(*{varName}));
    assert({varName} != NULL);
{/if}
{#if gcVarName && needAllocateArray}
    ARRAY_PUSH({gcVarName}, {varName}.data);
{/if}
{#if gcVarName && needAllocate}
    ARRAY_PUSH({gcVarName}, {varName});
{/if}
{initializer}`)
export class CVariableDeclaration {
    public varName: string;
    public isArray: boolean;
    public needAllocateArray: boolean;
    public initialCapacity: number;
    public size: number;
    public needAllocate: boolean;
    public isStruct: boolean;
    public isDict: boolean;
    public initializer: CAssignment | string = '';
    public gcVarName: string;

    constructor(scope: IScope, varDecl: ts.VariableDeclaration) {
        let varInfo = scope.root.typeHelper.getVariableInfo(<ts.Identifier>varDecl.name);
        let varType = varInfo.type;
        scope.variables.push(new CVariable(scope, varInfo.name, varInfo.type));
        this.varName = varInfo.name;
        this.needAllocateArray = varType instanceof ArrayType && varInfo.requiresAllocation;
        this.needAllocate = !(varType instanceof ArrayType) && varInfo.requiresAllocation;
        this.gcVarName = scope.root.memoryManager.getGCVariableForVariable(varDecl, varDecl.pos);
        this.isStruct = varType instanceof StructType && !varType.isDict;
        this.isDict = varType instanceof StructType && varType.isDict;
        this.isArray = varType instanceof ArrayType;
        if (varType instanceof ArrayType) {
            this.initialCapacity = Math.max(varType.capacity * 2, 4);
            this.size = varType.capacity;
        }
        if (varDecl.initializer)
            this.initializer = AssignmentHelper.create(scope, varDecl.name, varDecl.initializer);
        
        if (this.needAllocate || this.needAllocateArray)
            scope.root.headerFlags.malloc = true;
        if (this.gcVarName || this.needAllocateArray)
            scope.root.headerFlags.array = true;
        if (this.gcVarName)
            scope.root.headerFlags.gc_iterator = true;
    }
}

@CodeTemplate(`
{destructors {    }=> free({this});\n}
{#if gcVarName}
    for (_gc_i = 0; _gc_i < {gcVarName}.size; _gc_i++)
            free({gcVarName}.data[_gc_i]);
        free({gcVarName}.data);
{/if}`
)
export class CVariableDestructors {
    public gcVarName: string;
    public destructors: string[];
    constructor(scope: IScope, node: ts.Node) {
        this.gcVarName = scope.root.memoryManager.getGCVariableForScope(node);
        this.destructors = scope.root.memoryManager.getDestructorsForScope(node)
            .map(d => scope.root.typeHelper.getVariableInfo(d))
            .map(dv => (dv.type instanceof ArrayType) ? dv.name + ".data" : dv.name)
    }
}


export class CVariable {
    private varString: string;
    constructor(scope: IScope, name: string, private typeSource, insideStruct = false) {
        let typeString = scope.root.typeHelper.getTypeString(typeSource);
        if (typeString.indexOf('{var}') > -1)
            this.varString = typeString.replace('{var}', name);
        else
            this.varString = typeString + " " + name;
        
        if (insideStruct)
            this.varString = this.varString.replace(/^static /,'');
    }
    resolve() {
        return this.varString;
    }
}
