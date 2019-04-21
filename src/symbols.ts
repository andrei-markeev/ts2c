import * as ts from 'typescript'
import { CType, StructType, ArrayType, NumberVarType, FuncType } from './ctypes';
import { TypeHelper } from './typehelper';
import { findParentFunction } from './utils';

export class SymbolsHelper {

    constructor(private typeChecker: ts.TypeChecker, private typeHelper: TypeHelper) { }

    private userStructs: { [name: string]: StructType } = {};
    private arrayStructs: CType[] = [];

    public getStructsAndFunctionPrototypes() {

        for (let arrElemType of this.arrayStructs) {
            let elementTypeText = this.typeHelper.getTypeString(arrElemType);
            let structName = ArrayType.getArrayStructName(elementTypeText);
            this.userStructs[structName] = new StructType({
                size: { type: NumberVarType, order: 1 },
                capacity: { type: NumberVarType, order: 2 },
                data: { type: elementTypeText + "*", order: 3 }
            });
            this.userStructs[structName].structName = structName;
        }

        let structs = Object.keys(this.userStructs).filter(k => !this.userStructs[k].external).map(k => ({
            name: k,
            properties: Object.keys(this.userStructs[k].properties).map(pk => ({
                name: pk,
                type: this.userStructs[k].propertyDefs[pk].recursive ? this.userStructs[k] : this.userStructs[k].properties[pk]
            }))
        }));

        return [structs];
    }

    public ensureClosureStruct(type: FuncType, name: string) {
        if (!type.structName)
            type.structName = name + "_t";
        let i = 0;
        const params = type.closureParams.reduce((a, p) => {
            a[p.node.text] = { type: this.typeHelper.getCType(p.node), order: ++i };
            return a;
        }, {});
        params["func"] = { type: type.getText(true), order: 0 };
        const closureStruct = new StructType(params);
        let found = this.findStructByType(closureStruct);
        if (!found)
            this.userStructs[type.structName] = closureStruct;
    }

    public ensureStruct(structType: StructType, name: string) {
        if (!structType.structName)
            structType.structName = name + "_t";

        let found = this.findStructByType(structType);
        if (!found)
            this.userStructs[structType.structName] = structType;
    }

    public ensureArrayStruct(elementType: CType) {
        if (this.arrayStructs.every(s => this.typeHelper.getTypeString(s) !== this.typeHelper.getTypeString(elementType)))
            this.arrayStructs.push(elementType);
    }

    private findStructByType(structType: StructType) {
        let userStructCode = this.getStructureBodyString(structType);

        for (var s in this.userStructs) {
            if (this.getStructureBodyString(this.userStructs[s]) == userStructCode)
                return s;
        }

        return null;
    }

    private getStructureBodyString(structType: StructType) {
        let userStructCode = '{\n';
        for (let propName in structType.properties) {
            let propType = structType.propertyDefs[propName].recursive ? structType.getText() : structType.propertyDefs[propName].type;
            if (typeof propType === 'string') {
                userStructCode += '    ' + propType + ' ' + propName + ';\n';
            } else if (propType instanceof ArrayType) {
                let propTypeText = propType.getText();
                if (propTypeText.indexOf("{var}") > -1)
                    userStructCode += '    ' + propTypeText.replace(/^static /, '').replace("{var}", propName) + ';\n';
                else
                    userStructCode += '    ' + propTypeText + ' ' + propName + ';\n';
            } else {
                userStructCode += '    ' + propType.getText() + ' ' + propName + ';\n';
            }
        }
        userStructCode += "};\n"
        return userStructCode;
    }
    
    private temporaryVariables: { [scopeId: string]: string[] } = {
        // reserved symbols that are used in program.ts
        "main": [
            "TRUE", "FALSE", "uint8_t", "int16_t", 
            "regex_indices_struct_t", "regex_match_struct_t", "regex_func_t",
            "ARRAY", "ARRAY_CREATE", "ARRAY_PUSH", "ARRAY_INSERT", "ARRAY_REMOVE", "ARRAY_POP",
            "DICT", "DICT_CREATE", "DICT_SET", "DICT_GET", "dict_find_pos", "tmp_dict_pos", "tmp_dict_pos2",
            "STR_INT16_T_BUFLEN", "str_int16_t_cmp", "str_pos", "str_rpos", "str_len",
            "str_char_code_at", "str_substring", "str_slice", "str_int16_t_cat",
            "array_int16_t_cmp", "array_str_cmp", "parse_int16_t",
            "js_var_type", "js_var", "array_js_var_t", "dict_js_var_t",
            "js_var_from", "js_var_from_int16_t", "js_var_from_uint8_t", "js_var_from_str", "js_var_from_dict",
            "str_to_int16_t", "js_var_to_str", "js_var_to_number", "js_var_to_bool", "js_var_to_undefined",
            "js_var_typeof", "js_var_eq", "js_var_op", "js_var_compute",
            "regex_clear_matches", "regex_match",
            "gc_main", "gc_i", "gc_j"
        ]
    };
    private iteratorVarNames = ['i', 'j', 'k', 'l', 'm', 'n'];
    /** Generate name for a new iterator variable and register it in temporaryVariables table.
     * Generated name is guarantied not to conflict with any existing names in specified scope.
     */
    public addIterator(scopeNode: ts.Node): string {
        let parentFunc = findParentFunction(scopeNode);
        let scopeId = parentFunc && parentFunc.pos + 1 || 'main';
        let existingSymbolNames = this.typeChecker.getSymbolsInScope(scopeNode, ts.SymbolFlags.Variable).map(s => s.name);
        if (!this.temporaryVariables[scopeId])
            this.temporaryVariables[scopeId] = [];
        existingSymbolNames = existingSymbolNames.concat(this.temporaryVariables[scopeId]);
        let i = 0;
        while (i < this.iteratorVarNames.length && existingSymbolNames.indexOf(this.iteratorVarNames[i]) > -1)
            i++;
        let iteratorVarName;
        if (i == this.iteratorVarNames.length) {
            i = 2;
            while (existingSymbolNames.indexOf("i_" + i) > -1)
                i++;
            iteratorVarName = "i_" + i;
        }
        else
            iteratorVarName = this.iteratorVarNames[i];

        this.temporaryVariables[scopeId].push(iteratorVarName);
        return iteratorVarName;
    }

    /** Generate name for a new temporary variable and register it in temporaryVariables table.
     * Generated name is guarantied not to conflict with any existing names in specified scope.
     */
    public addTemp(scopeNode: ts.Node, proposedName: string, reserve: boolean = true): string {
        let parentFunc = findParentFunction(scopeNode);
        let scopeId = parentFunc && parentFunc.pos + 1 || 'main';
        let existingSymbolNames = scopeNode == null ? [] : this.typeChecker.getSymbolsInScope(scopeNode, ts.SymbolFlags.Variable).map(s => s.name);
        if (!this.temporaryVariables[scopeId])
            this.temporaryVariables[scopeId] = [];
        existingSymbolNames = existingSymbolNames.concat(this.temporaryVariables[scopeId]);
        if (existingSymbolNames.indexOf(proposedName) > -1) {
            let i = 2;
            while (existingSymbolNames.indexOf(proposedName + "_" + i) > -1)
                i++;
            proposedName = proposedName + "_" + i;
        }

        if (reserve)
            this.temporaryVariables[scopeId].push(proposedName);
        return proposedName;
    }

    private closureVarNames: { [pos: number]: string } = [];
    public getClosureVarName(node: ts.Node) {
        if (!this.closureVarNames[node.pos]) {
            const name = this.addTemp(node, "closure");
            this.closureVarNames[node.pos] = name;
        }
        return this.closureVarNames[node.pos];
    }

}