Tests
=====

Integration tests transpile TypeScript code using TS2C, build resulting C file using gcc and run it,
comparing program output with contents of the corresponding .res.expect files.

Integration tests are run with `npm test`.