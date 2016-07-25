Implementation
==============

This implementation uses public [TypeScript Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API)
to get the AST and some of type information.

 - program.ts - main transpilation entry point
 - nodes/*.ts - code template classes for different nodes  
 - types.ts - extended type analysis on top of TypeScript's type checker
 - memory.ts - memory management related stuff 
 - template.ts - code templating engine

Code templating
---------------

Implementation uses custom code templating engine instead of usual emitter approach. This is almost same in terms of the LOCs,
and besides much trickier to debug, but the big advantage is that it is much easier to understand the big picture of what is
being generated and what are the edge cases.

Code templating looks like this:

```ts
@CodeTemplate(`
while ({condition})
{block}`)
export class CWhileStatement
{
    public condition: CExpression;
    public block: CBlock;
    constructor(scope: IScope, node: ts.WhileStatement)
    {
        this.block = new CBlock(scope);
        this.condition = ExpressionHelper.create(scope, node.expression);
        StatementProcessor.process(node.statement, this.block);
    }
}
```

Code templating engine parses the template and replaces variables enclosed in `{` `}` with corresponding properties of that class.
Each property can be a string, a resolvable value (object with method `resolve() => string`), or instance of another template class.

Classes starting with `C` are usually code templates.

Contributions
-------------

Contributions are very welcome!

I would however appreciate if you stick to the following rules:

 - only features of ANSI/ISO 9899-1990 International Standard can be used in the transpiled code
 - no dead code should ever be added to the output (see HeaderFlags in program.ts)
 - if you're planning to do some heavy changes, please create an issue and let's discuss this first

Thanks!