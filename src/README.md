Implementation
==============

This implementation uses public [TypeScript Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API)
to get the AST and some of type information. It then performs extended type analysis and finally uses code templating to map
TypeScript AST to C89 code.

Source code structure: 

 - program.ts - main transpilation entry point
 - nodes/*.ts - code template classes for different syntax nodes  
 - standard/**.ts - code templates and resolvers for standard objects like Array, String, etc.
 - types.ts - extended type analysis on top of TypeScript's type checker
 - memory.ts - memory management related stuff 
 - template.ts - code templating engine

Contributions
-------------

Contributions are very welcome!

I would however appreciate if you stick to the following rules:

 - only features of ANSI/ISO 9899-1990 International Standard can be used in the transpiled code
 - no dead code should ever be added to the output (see HeaderFlags in program.ts)
 - if you're planning to do some heavy changes, please create an issue and let's discuss this first

Thanks!


Code templating
---------------

This implementation uses custom code templating engine instead of usual emitter approach. This is almost same in terms of the LOCs,
and besides much trickier to debug, but the big advantage is that it is much easier to understand the big picture of what is
being generated and what are the edge cases.

Essentially, code template maps a TypeScript AST node (ts.Node) to a string in a declarative way.

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
        this.block = new CBlock(scope, node.statement);
        this.condition = CodeTemplateFactory.create(scope, node.expression);
    }
}
```

### Supported syntax

  1. Variables enclosed in `{` `}` are replaced with corresponding properties of that class
  2. Template for array elements can be defined using `=>` syntax 
  3. Simple conditional templating is supported using `{#if}` `{#elseif}` `{#else}` and `{/if}` syntax
  4. It is possible to push statements to the current scope using `{#statements}` and `{/statements}` syntax

### Variables replacement

The referenced class property can be a string, a resolvable value (object with method `resolve() => string`),
instance of another template class, or array of such elements.

### Inline templates for arrays elements

While you can define array of templates and engine handles that fine, but sometimes it's an overkill to create
a class with just couple of properties or even with a single property.

For example:

```ts
@CodeTemplate(`{destructors => free({this});}`)
export class CMyClass {
    destructors: string[];
    /* ... */
}
```

### Conditions

```ts
@CodeTemplate(`
{#if type == 'array'}
    {type} {name}[{capacity}]
{#elseif type == 'pointer'}
    {type}* {name}
{#else}
    {type} {name}
{/if}`)
class CVariableDeclaration {
    /* ... */
}
```

Note: nesting of conditions is **not** allowed to preserve simplicity and readability.
Conditions are checked against the properties of the class.

### Statements

Finally, template engine allows pushing statements into the current scope.
This is very useful when working with expressions, because while JavaScript expressions are
rich and powerful, C89 doesn't support many of those features, so often you'd have to replace a part
of expression with a temporary variable.

```ts
@CodeTemplate(`
{#statements}
    {tempVarName} = malloc(sizeof(*{tempVarName}));
{/statements}
`)
class CMyClass {
    /* ... */
}
```

In overall, template engine goal is to make templates as readable as possible, so that you can look to a
template and instantly understand what is going to happen when this template is evaluated.

It is very important that templates are kept simple (because they're essentially magic strings).
