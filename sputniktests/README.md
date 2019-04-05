Sputnik Test Suite
------------------

In order to run TS2C against [Sputnik](https://en.wikipedia.org/wiki/Sputnik_(JavaScript_conformance_test)), download the suite from https://code.google.com/archive/p/sputniktests/downloads and edit Makefile so that it points to correct location of the `Conformance` folder.

Then, run the tests with
```
npm run test-sputnik
```