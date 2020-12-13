import * as ts from 'typescript';
import { TypeHelper } from './typehelper';

export type CType = string | StructType | ArrayType | DictType | FuncType;
export const UniversalVarType = "struct js_var";
export const VoidType = "void";
export const PointerVarType = "void *";
export const StringVarType = "const char *";
export const NumberVarType = "int16_t";
export const BooleanVarType = "uint8_t";
export const RegexVarType = "struct regex_struct_t";
export const RegexMatchVarType = "struct regex_match_struct_t";

export function getTypeBodyText(t: CType): string { return typeof t === "string" ? t : t.getBodyText(); }
export function getTypeText(t: CType): string { return typeof(t) === "string" ? t : t.getText(); }

/** Type that represents static or dynamic array */
export class ArrayType {

    public static getArrayStructName(elementTypeText: string) {
        while (elementTypeText.indexOf(NumberVarType) > -1)
            elementTypeText = elementTypeText.replace(NumberVarType, "number");
        while (elementTypeText.indexOf(StringVarType) > -1)
            elementTypeText = elementTypeText.replace(StringVarType, "string");
        while (elementTypeText.indexOf(PointerVarType) > -1)
            elementTypeText = elementTypeText.replace(PointerVarType, "pointer");
        while (elementTypeText.indexOf(BooleanVarType) > -1)
            elementTypeText = elementTypeText.replace(BooleanVarType, "bool");
        
        elementTypeText = elementTypeText.replace(/^struct ([a-z0-9_]+)_t \*$/, (all, g1) => g1).replace(/^struct js_var/, "js_var");

        return "array_" +
            elementTypeText
                .replace(/^static /, '').replace('{var}', '').replace(/[\[\]]/g, '')
                .replace(/ /g, '_')
                .replace(/const char \*/g, 'string')
                .replace(/\*/g, 'p') + "_t";
    }

    public getText() {

        let elementType = this.elementType;
        let elementTypeText;
        if (typeof elementType === 'string')
            elementTypeText = elementType;
        else
            elementTypeText = elementType.getText();

        let structName = ArrayType.getArrayStructName(elementTypeText);

        if (this.isDynamicArray)
            return "struct " + structName + " *";
        else if (elementTypeText.indexOf('{var}') > -1)
            return elementTypeText + "[" + this.capacity + "]";
        else
            return "static " + elementTypeText + " {var}[" + this.capacity + "]";
    }
    public getBodyText() {
        return getTypeBodyText(this.elementType) + "[" + (this.isDynamicArray ? "" : this.capacity) + "]";
    }
    constructor(
        public elementType: CType,
        public capacity: number,
        public isDynamicArray: boolean
    ) {
    }
}

type PropertiesDictionary = { readonly[propName: string]: CType };

/** Type that represents JS object with static properties (implemented as C struct) */
export class StructType {
    public structName: string;
    public external: boolean;
    public forcedType: string;
    public getText() {
        return this.forcedType || 'struct ' + this.structName + ' *';
    }
    get properties(): PropertiesDictionary {
        return Object.keys(this.propertyDefs)
            .sort((a, b) => this.propertyDefs[a].order - this.propertyDefs[b].order)
            .reduce((acc, k) => { acc[k] = this.propertyDefs[k].type; return acc; }, {});
    }
    public getBodyText() {
        return "{" + Object.keys(this.propertyDefs).sort().map(k => k + ": " + getTypeBodyText(this.properties[k])).join("; ") + "}";
    }
    constructor(
        public propertyDefs: { [propName: string]: { type: CType, order: number, recursive?: boolean } }
    ) { }
}

/** Type that represents JS object with dynamic properties (implemented as dynamic dictionary) */
export class DictType {
    public getText() {
        if (this.elementType == UniversalVarType)
            return "struct dict_js_var_t *";
        else
            return "DICT(" + (typeof this.elementType === "string" ? this.elementType : this.elementType.getText()) + ")";
    }
    public getBodyText() {
        return "{" + getTypeBodyText(this.elementType) + "}";
    }
    constructor(public elementType: CType) { }
}

export class FuncType {
    public static getReturnType(typeHelper: TypeHelper, node: ts.Node): CType {
        const type = typeHelper.getCType(node);
        return type && type instanceof FuncType ? type.returnType : null;
    }
    public static getInstanceType(typeHelper: TypeHelper, node: ts.Node): CType {
        const type = typeHelper.getCType(node);
        return type && type instanceof FuncType ? type.instanceType : null
    }

    public returnType: CType;
    public parameterTypes?: CType[];
    public instanceType: CType;
    public closureParams: { assigned: boolean, node: ts.Identifier, refs: ts.Identifier[] }[];
    public needsClosureStruct: boolean;
    public scopeType: StructType;
    public structName: string;

    public getText(forceFuncType:boolean = false) {
        if (this.closureParams.length && !forceFuncType)
            return 'struct ' + this.structName + ' *';
        let retType = getTypeText(this.returnType).replace(/ \{var\}\[\d+\]/g, "* {var}").replace(/^static /, "");
        if (retType.indexOf("{var}") == -1)
            retType += " {var}";
        return retType.replace(" {var}", " (*{var})") + "("
            + this.parameterTypes
                .map(t => getTypeText(t).replace(/\ {var\}/, "").replace(/^static /, ""))
                .concat(this.closureParams.length ? ['struct ' + this.structName + ' *'] : [])
                .join(', ')
            + ")";
    }
    public getBodyText() {
        const paramTypes = [].concat(this.parameterTypes);
        if (this.instanceType)
            paramTypes.unshift(this.instanceType);
        return getTypeBodyText(this.returnType) 
            + "(" + paramTypes.map(pt => pt ? getTypeBodyText(pt) : PointerVarType).join(", ") + ")"
            + (this.scopeType ? " scope=" + getTypeBodyText(this.scopeType) : "")
            + (this.closureParams.length ? " closure" : "")
            + (this.needsClosureStruct ? "_struct" : "")
            + (this.closureParams.length ? "={" + this.closureParams.map(p => (p.assigned ? "*" : "") + p.node.text + "(" + p.refs.map(r => r.pos).join(",") + ")").join(", ") + "}" : "");
    }
    constructor(
        data: {
            returnType?: CType,
            parameterTypes?: CType[],
            /** type of `new function()` */
            instanceType?: CType,
            /** this is used when we can manage without creating context variable */
            closureParams?: { assigned: boolean, node: ts.Identifier, refs: ts.Identifier[] }[],
            /** if this function is assigned to a variable */
            needsClosureStruct?: boolean,
            /** function scope (all local variables), only needed if it has nested closures */
            scopeType?: StructType,
            structName?: string
        }
    ) {
        this.returnType = data.returnType || VoidType;
        this.parameterTypes = data.parameterTypes || [];
        this.instanceType = data.instanceType || null;
        this.closureParams = data.closureParams || [];
        this.needsClosureStruct = data.needsClosureStruct || false;
        this.scopeType = data.scopeType || null;
        this.structName = data.structName || null;
    }
}
