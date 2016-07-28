Tests
=====

Integration tests transpile TypeScript code using TS2C, build resulting C file using gcc and run it
using valgrind, comparing program output with contents of the corresponding .res.expect files.

This is configured for Linux. Never tested on Mac or Windows.

To run tests, use `npm test`.