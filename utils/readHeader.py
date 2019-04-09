#!/usr/bin/python
import sys
import CppHeaderParser
import json
import pprint
import re

cppHeader = CppHeaderParser.CppHeader(sys.argv[1])

#pp = pprint.PrettyPrinter(indent=4)
#pp.pprint(cppHeader)
#sys.exit(0)

def convertType(type):
    if type == "int":
        return "number"
    elif type == "const char *":
        return "string"
    elif type == "void":
        return "void"
    elif type[0:6] == "struct":
        return re.sub(r'\s*\*\s*$','',type[7:])
    else:
        return ""

for func in cppHeader.functions:
    params = []
    for index, param in enumerate(func["parameters"]):
        name = param["name"] or "p" + str(index + 1)
        type = convertType(param["type"])
        annotation = "" if type else "/** @ctype " + param["type"] + " */ "
        params.append(annotation + name + (": " + type if type else ""))

    name = func["name"]
    type = convertType(func["rtnType"])
    annotation = "" if type else "/** @ctype " + func["rtnType"] + " */\n"
    func_s = "\n" + annotation + "function " + func["name"] + "(" + ", ".join(params) + ")" + (": " + type if type else "")
    print("%s"%func_s)