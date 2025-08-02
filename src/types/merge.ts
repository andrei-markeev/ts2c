import { canBeStandardCall } from "../standard";
import { CType, VoidType, PointerVarType, UniversalVarType, StringVarType, StructType, ArrayType, DictType, FuncType, getTypeBodyText, NumberVarType } from "./ctypes";

export class TypeMerger {

    public mergeTypes(type1: CType, type2: CType): { type: CType, replaced: boolean } {
        let type1_result = { type: this.ensureNoTypeDuplicates(type1), replaced: true };
        let type2_result = { type: this.ensureNoTypeDuplicates(type2), replaced: true };
        let noChanges = { type: this.ensureNoTypeDuplicates(type1), replaced: false };

        if (!type1 && type2)
            return type2_result;
        else if (type1 && !type2)
            return type1_result;
        else if (!type1 && !type2)
            return noChanges;

        else if (typeof type1 === "string" && typeof type2 === "string" && type1 === type2)
            return noChanges;

        else if (type1 === VoidType)
            return type2_result;
        else if (type2 === VoidType)
            return type1_result;

        else if (type1 === PointerVarType)
            return type2_result;
        else if (type2 === PointerVarType)
            return type1_result;

        else if (type1 === UniversalVarType)
            return type1_result;
        else if (type2 === UniversalVarType)
            return type2_result;

        else if (type1 === StringVarType && type2 instanceof StructType) {
            if (Object.keys(type2.properties).every(p => p === 'length' || canBeStandardCall(StringVarType, p)))
                return type1_result;
        }
        else if (type1 instanceof StructType && type2 === StringVarType) {
            if (Object.keys(type1.properties).every(p => p === 'length' || canBeStandardCall(StringVarType, p)))
                return type2_result;
        }
        else if (type1 instanceof ArrayType && type2 instanceof ArrayType) {
            let cap = Math.max(type2.capacity, type1.capacity);
            let isDynamicArray = type2.isDynamicArray || type1.isDynamicArray;
            let elementTypeMergeResult = this.mergeTypes(type1.elementType, type2.elementType);
            if (type1.capacity != cap || type2.capacity != cap
                || type1.isDynamicArray != isDynamicArray || type2.isDynamicArray != isDynamicArray
                || elementTypeMergeResult.replaced)
                return { type: this.ensureNoTypeDuplicates(new ArrayType(elementTypeMergeResult.type, cap, isDynamicArray)), replaced: true };

            return noChanges;
        }
        else if (type1 instanceof DictType && type2 instanceof ArrayType) {
            return this.mergeDictAndArray(type1, type2);
        }
        else if (type1 instanceof ArrayType && type2 instanceof DictType) {
            return this.mergeDictAndArray(type2, type1);
        }
        else if (type1 instanceof StructType && type2 instanceof StructType) {
            if (type1.forcedType && !type2.forcedType)
                return type1_result;
            if (type2.forcedType && !type1.forcedType)
                return type2_result;
            let props = Object.keys(type1.properties).concat(Object.keys(type2.properties));
            let changed = false;
            let newProps = {};
            for (let p of props) {
                let recursive1 = type1.propertyDefs[p] ? type1.propertyDefs[p].recursive : false;
                let recursive2 = type2.propertyDefs[p] ? type2.propertyDefs[p].recursive : false;
                let result = recursive1 || recursive2 ? { type: PointerVarType, replaced: recursive1 != recursive2 } : this.mergeTypes(type1.properties[p], type2.properties[p]);
                let order = type1.propertyDefs[p] ? type1.propertyDefs[p].order : -1;
                if (type2.propertyDefs[p] && (order === -1 || type2.propertyDefs[p].order < order))
                    order = type2.propertyDefs[p].order;
                newProps[p] = { type: result.type, order: order, recursive: recursive1 || recursive2 };
                if (result.replaced)
                    changed = true;
            }
            return changed ? { type: this.ensureNoTypeDuplicates(new StructType(newProps)), replaced: true } : noChanges;
        }
        else if (type1 instanceof ArrayType && type2 instanceof StructType) {
            return this.mergeArrayAndStruct(type1, type2);
        }
        else if (type1 instanceof StructType && type2 instanceof ArrayType) {
            return this.mergeArrayAndStruct(type2, type1);
        }
        else if (type1 instanceof DictType && type2 instanceof StructType) {
            return this.mergeDictAndStruct(type1, type2);
        }
        else if (type1 instanceof StructType && type2 instanceof DictType) {
            return this.mergeDictAndStruct(type2, type1)
        }
        else if (type1 instanceof DictType && type2 instanceof DictType) {
            const { type: elemType, replaced } = this.mergeTypes(type1.elementType, type2.elementType);
            if (replaced)
                return { type: this.ensureNoTypeDuplicates(new DictType(elemType)), replaced: true };
            else
                return noChanges;
        }
        else if (type1 instanceof FuncType && type2 instanceof FuncType) {
            let { type: returnType, replaced: returnTypeReplaced } = this.mergeTypes(type1.returnType, type2.returnType);
            const { type: instanceType, replaced: instanceTypeReplaced } = this.mergeTypes(type1.instanceType, type2.instanceType);
            const { type: scopeType, replaced: scopeTypeReplaced } = this.mergeTypes(type1.scopeType, type2.scopeType) as { type: StructType, replaced: boolean };

            if (returnTypeReplaced) {
                let retType = returnType;
                while (retType instanceof FuncType) {
                    if (retType.returnType === type1 || retType.returnType === type2) {
                        retType.returnTypeIsCircular = true;
                        break;
                    }
                    retType = retType.returnType;
                }
            }

            const paramCount = Math.max(type1.parameterTypes.length, type2.parameterTypes.length);
            let paramTypesReplaced = type1.parameterTypes.length !== type2.parameterTypes.length;
            let parameterTypes = [];
            for (let i = 0; i < paramCount; i++) {
                const { type: pType, replaced: pTypeReplaced } = this.mergeTypes(type1.parameterTypes[i], type2.parameterTypes[i]);
                parameterTypes.push(pType)
                if (pTypeReplaced)
                    paramTypesReplaced = true;
            }
            const closureParamCount = Math.max(type1.closureParams.length, type2.closureParams.length);
            let closureParamsReplaced = type1.closureParams.length !== type2.closureParams.length;
            let closureParams = [];
            for (let i = 0; i < closureParamCount; i++) {
                closureParams.push(type1.closureParams[i] || type2.closureParams[i]);
            }

            const needsClosureStructReplaced = type1.needsClosureStruct != type2.needsClosureStruct;
            const needsClosureStruct = type1.needsClosureStruct || type2.needsClosureStruct;

            const returnTypeIsCircularReplaced = type1.returnTypeIsCircular != type2.returnTypeIsCircular;
            const returnTypeIsCircular = type1.returnTypeIsCircular || type2.returnTypeIsCircular;

            if (returnTypeReplaced || instanceTypeReplaced || scopeTypeReplaced || paramTypesReplaced || closureParamsReplaced || needsClosureStructReplaced || returnTypeIsCircularReplaced)
                return { type: this.ensureNoTypeDuplicates(new FuncType({ returnType, returnTypeIsCircular, parameterTypes, instanceType, closureParams, needsClosureStruct, scopeType })), replaced: true };
            else
                return noChanges;
        }
        else
            return { type: UniversalVarType, replaced: true };
    }

    private mergeArrayAndStruct(arrayType: ArrayType, structType: StructType) {
        let props = Object.keys(structType.properties);
        let needPromoteToDictionary = false;
        let needPromoteToTuple = false;
        if (props.length === 0)
            needPromoteToDictionary = true;
        else {
            for (let p of props) {
                if (p == "length")
                    continue;
                if (isNaN(+p))
                    needPromoteToDictionary = true;
                if (this.mergeTypes(arrayType.elementType, structType.properties[p]).replaced)
                    needPromoteToTuple = true;
            }
        }
        if (needPromoteToDictionary && needPromoteToTuple)
            return { type: this.ensureNoTypeDuplicates(new DictType(UniversalVarType)), replaced: true };
        else if (needPromoteToDictionary)
            return { type: this.ensureNoTypeDuplicates(new DictType(arrayType.elementType)), replaced: true };
        else if (needPromoteToTuple)
            return { type: this.ensureNoTypeDuplicates(new ArrayType(UniversalVarType, arrayType.capacity, arrayType.isDynamicArray)), replaced: true };
        else
            return { type: arrayType, replaced: true };
    }

    private mergeDictAndStruct(dictType: DictType, structType: StructType) {
        let elementType = dictType.elementType;
        for (let k in structType.properties)
            ({ type: elementType } = this.mergeTypes(elementType, structType.properties[k]));
        return { type: this.ensureNoTypeDuplicates(new DictType(elementType)), replaced: true };
    }

    private mergeDictAndArray(dictType: DictType, arrayType: ArrayType) {
        const mergeResult = this.mergeTypes(dictType.elementType, arrayType.elementType);
        if (mergeResult.replaced)
            return { type: this.ensureNoTypeDuplicates(new DictType(mergeResult.type)), replaced: true };
        else
            return { type: dictType, replaced: true };
    }
    
    private typesDict = {};
    public ensureNoTypeDuplicates(t) {
        if (!t)
            return null;
        let typeBodyText = getTypeBodyText(t);
        let type = this.typesDict[typeBodyText];
        if (type instanceof ArrayType)
            type.capacity = Math.max(type.capacity, t.capacity);
        if (type instanceof StructType)
            for (let pk in type.propertyDefs)
                type.propertyDefs[pk].recursive = type.propertyDefs[pk].recursive || t.propertyDefs[pk].recursive;
        if (!type)
            type = this.typesDict[typeBodyText] = t;
        return type;
    }
}