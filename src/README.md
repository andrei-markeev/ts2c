Implementation
==============

This implementation uses public [TypeScript Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API)
to get the AST and some of type information.

 - program.ts - main transpilation entry point
 - nodes/*.ts - code template classes for different nodes  
 - types.ts - extended type analysis on top of TypeScript's type checker
 - memory.ts - memory management related stuff 
 - template.ts - code templating engine
