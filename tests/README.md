Tests
=====

Integration tests transpile TypeScript code using TS2C, build resulting C file using gcc and run it
using valgrind, comparing program output with contents of the corresponding .res.expect files.

To run tests, use `npm test`.
To skip valgrind (it typically works only on Linux), use `npm run test-no-valgrind`.
If you want to run only one test, use e.g. `npm test -- arrays/join.res` (notice `.res` extension)
