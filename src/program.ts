import * as kataw from '@andrei-markeev/kataw';
import { CFunctionPrototype, CFunction } from './nodes/function';
import { CRegexSearchFunction } from './nodes/regexfunc';
import { TypeHelper } from './types/typehelper';
import { SymbolsHelper } from './symbols';
import { MemoryManager } from './memory';
import { CodeTemplate, CodeTemplateFactory, CTemplateBase } from './template';
import { CVariable, CVariableDestructors } from './nodes/variable';
import { StandardCallHelper } from './standard';
import { CCommon } from './common';

export interface IScope {
    parent: IScope;
    func: IScope;
    root: CProgram;
    variables: CVariable[];
    statements: ( CTemplateBase | string )[];
}

export class HeaderFlags {
    strings: boolean = false;
    printf: boolean = false;
    malloc: boolean = false;
    bool: boolean = false;
    int16_t: boolean = false;
    uint16_t: boolean = false;
    js_var: boolean = false;
    js_var_array: boolean = false;
    js_var_dict: boolean = false;
    js_var_from: boolean = false;
    js_var_from_str: boolean = false;
    js_var_from_int16_t: boolean = false;
    js_var_from_uint8_t: boolean = false;
    js_var_to_str: boolean = false;
    js_var_to_number: boolean = false;
    js_var_to_undefined: boolean = false;
    js_var_to_bool: boolean = false;
    js_var_typeof: boolean = false;
    js_var_eq: boolean = false;
    js_var_lessthan: boolean = false;
    js_var_plus: boolean = false;
    js_var_compute: boolean = false;
    js_var_get: boolean = false;
    js_var_isnan: boolean = false;
    js_var_dict_inc: boolean = false;
    js_var_inc: boolean = false;
    array: boolean = false;
    array_pop: boolean = false;
    array_insert: boolean = false;
    array_remove: boolean = false;
    array_string_t: boolean = false;
    array_int16_t_cmp: boolean = false;
    array_str_cmp: boolean = false;
    array_pointer_t: boolean = false;
    gc_main: boolean = false;
    gc_iterator: boolean = false;
    gc_iterator2: boolean = false;
    gc_array: boolean = false;
    dict: boolean = false;
    dict_find_pos: boolean = false;
    str_int16_t_buflen: boolean = false;
    str_int16_t_cmp: boolean = false;
    str_int16_t_cat: boolean = false;
    str_pos: boolean = false;
    str_rpos: boolean = false;
    str_len: boolean = false;
    str_char_code_at: boolean = false;
    str_substring: boolean = false;
    str_slice: boolean = false;
    str_to_int16_t: boolean = false;
    parse_int16_t: boolean = false;
    regex: boolean = false;
    regex_match: boolean = false;
    try_catch: boolean = false;
}

export const reservedCSymbolNames = [
    "main",
    "TRUE", "FALSE", "uint8_t", "int16_t",
    "typedef", "struct", "unsigned", "signed", "int", "double", "long", "short", "char", "float",
    "sizeof", "goto", "volatile", "static", "extern", "auto", "register", "union",
    "printf", "assert", "malloc", "realloc", "memmove", "sprintf", "strcmp", "strstr",
    "isdigit", "isspace", 'CHAR_BIT',
    "regex_indices_struct_t", "regex_match_struct_t", "regex_func_t",
    "ARRAY", "ARRAY_CREATE", "ARRAY_PUSH", "ARRAY_INSERT", "ARRAY_REMOVE", "ARRAY_POP",
    "DICT", "DICT_CREATE", "DICT_SET", "DICT_GET", "dict_find_pos", "tmp_dict_pos", "tmp_dict_pos2",
    "STR_INT16_T_BUFLEN", "str_int16_t_cmp", "str_pos", "str_rpos", "str_len",
    "str_char_code_at", "str_substring", "str_slice", "str_int16_t_cat",
    "array_int16_t_cmp", "array_str_cmp", "parse_int16_t",
    "js_var_type", "js_var", "array_js_var_t", "dict_js_var_t",
    "js_var_from", "js_var_from_int16_t", "js_var_from_uint8_t", "js_var_from_str", "js_var_from_dict",
    "str_to_int16_t", "js_var_to_str", "js_var_to_number", "js_var_to_bool", "js_var_to_undefined",
    "js_var_typeof", "js_var_dict_inc", "js_var_get", "js_var_eq", "js_var_op", "js_var_compute",
    "regex_clear_matches", "regex_match",
    "gc_main", "gc_i", "gc_j"
];

@CodeTemplate(`
{runtimeCode}

{#if includes.length}
    {includes => #include {this}\n}
{/if}

{userStructs => struct {name} {\n    {properties {    }=> {this};\n}\n};\n}
 
{#if headerFlags.gc_main || headerFlags.js_var_plus}
    static struct array_pointer_t *gc_main;
{/if}
{#if headerFlags.gc_iterator || headerFlags.js_var_plus}
    static int16_t gc_i;
{/if}
{#if headerFlags.gc_iterator2}
    static int16_t gc_j;
{/if}

{variables => {this};\n}

{functionPrototypes => {this}\n}

{functions => {this}\n}

int main(void) {
    {gcVarNames {    }=> ARRAY_CREATE({this}, 2, 0);\n}
    {#if headerFlags.try_catch || headerFlags.js_var_get}
        ARRAY_CREATE(err_defs, 2, 0);
    {/if}

    {statements {    }=> {this}}
    {destructors}

    return 0;
}
`)
export class CProgram implements IScope {
    public parent: IScope = null;
    public root = this;
    public func = this;
    public includes: string[] = [];
    public variables: CVariable[] = [];
    public statements: (CTemplateBase | string)[] = [];
    public functions: (CFunction | CRegexSearchFunction)[] = [];
    public functionPrototypes: CFunctionPrototype[] = [];
    public gcVarNames: string[];
    public destructors: CVariableDestructors;
    public userStructs: { name: string, properties: CVariable[] }[];
    public headerFlags = new HeaderFlags();
    public runtimeCode: CCommon | string = '';
    constructor(rootNode: kataw.RootNode, commonHeaderFlags: HeaderFlags, public symbolsHelper: SymbolsHelper, public typeHelper: TypeHelper, public standardCallHelper: StandardCallHelper, public memoryManager: MemoryManager) {
        if (symbolsHelper.exportedSymbols[rootNode.id] !== undefined)
            this.includes.push('"' + rootNode.fileName.substring(rootNode.fileName.lastIndexOf('/') + 1).replace(/(\.js|\.ts)$/, '.h') + '"');
        this.gcVarNames = this.memoryManager.getGCVariablesForScope(null);
        for (let gcVarName of this.gcVarNames) {
            this.headerFlags.array = true;
            this.headerFlags.array_pointer_t = true;
            if (gcVarName == "gc_main") {
                this.headerFlags.gc_main = true;
                continue;
            }
            const simplePointerArray = "struct array_pointer_t *"
            let gcType = simplePointerArray;
            if (gcVarName.indexOf("_arrays") > -1) gcType = "ARRAY(struct array_pointer_t *)";
            if (gcVarName.indexOf("_arrays_c") > -1) gcType = "ARRAY(ARRAY(struct array_pointer_t *))";
            if (gcVarName.indexOf("_dicts") > -1) gcType = "ARRAY(DICT(void *))";
            if (gcType !== simplePointerArray)
                this.headerFlags.gc_array = true;
            this.variables.push(new CVariable(this, gcVarName, gcType));
        }

        for (let s of rootNode.statements)
            this.statements.push(CodeTemplateFactory.createForNode(this, s));

        let [structs] = this.symbolsHelper.getStructsAndFunctionPrototypes(this.typeHelper);
        this.headerFlags.array_pointer_t = this.headerFlags.array_pointer_t || structs.filter(s => s.name == "array_pointer_t").length > 0;
        this.headerFlags.array_string_t = this.headerFlags.array_string_t || structs.filter(s => s.name == "array_string_t").length > 0;
        this.headerFlags.js_var_array = this.headerFlags.js_var_array || structs.filter(s => s.name == "array_js_var_t").length > 0;
        this.headerFlags.js_var_dict = this.headerFlags.js_var_dict || structs.filter(s => s.name == "dict_js_var_t").length > 0;
        this.userStructs = structs.filter(s => ["array_string_t", "array_pointer_t", "array_js_var_t", "dict_js_var_t"].indexOf(s.name) == -1).map(s => ({
            name: s.name,
            properties: s.properties.map(p => new CVariable(this, p.name, p.type, { removeStorageSpecifier: true }))
        }));

        this.destructors = new CVariableDestructors(this, null);

        if (commonHeaderFlags === null)
            this.runtimeCode = new CCommon(this.headerFlags);
        else {
            this.runtimeCode = '#include "common.h";';
            for (var key in this.headerFlags)
                commonHeaderFlags[key] |= this.headerFlags[key];
        }
    }
}
