Tests
=====

Integration tests transpile TypeScript code using TS2C, build resulting C file using gcc and run it
using valgrind, comparing program output with contents of the corresponding .res.expect files.

To run tests, use `npm test`.
To skip valgrind (it typically works only on Linux), use `npm run test-without-valgrind`.