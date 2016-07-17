Implementation
==============

This implementation uses public [TypeScript Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API)
to get the AST and some of type information.

 - transpile.ts - main transpilation loop is here
 - types.ts - preprocesses the transpiled source code and performs extended type analysis for translating TS types to C types 
 - memory.ts - memory management related stuff 
 - global.ts - global context containing TypeScript objects
 - printf.ts - transpiles console.log to printf
 - emit.ts - implements emitter with indentation and ability to write to certain parts of code
