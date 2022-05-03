# `@hackbg/runspec` [![NPM version](https://img.shields.io/npm/v/@hackbg/runspec?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/runspec)

**Minimal test runner and reporter.**

Its gimmick is that there are no gimmicks.
No `describe`, no `expect`, no `beforeEach`/`afterAll`, etc.
Who told you you needed those, anyway?

## How to use

1. Define your **test cases** as plain old **functions** -
  synchronous or asynchronous, it's smart enough to handle
  both correctly, and you're smart enough to use JavaScript's
  standard control flow vocabulary.

2. Group test cases into **specifications** via regular ES modules
  (i.e. collect them all in an object and `export default` it.)

```typescript
// spec1.spec.js
export default {
  'synchronous test' (assert) {
    assert(true)
  },
  async 'asynchronous test' (assert) {
    await someAsyncFunction()
    assert(true)
  }
}
```

3. Group specifications into a **test suite** in a single executable script
   which calls `runSpec` on the test suite to execute the specifications.
   By default, it looks at `process.argv.slice(2)` - if it's empty, it runs
   all specs. If it contains names of test suites, it runs only those.

```typescript
// index.spec.js
import runSpec from '@hackbg/runspec'
import Spec1   from './spec1.spec'
import Spec2   from './spec2.spec'
import Spec3   from './spec3.spec'
runSpec({ Spec1, Spec2, Spec3 })
```

```sh
node index.spec.js
node index.spec.js Spec1
node index.spec.js Spec2 Spec3
```

4. Add the script to your project's `package.json` and run with `npm test`.

```json
{
  "scripts": {
    "test": "node index.spec.js"
  }
}
```

```sh
npm test
npm test Spec1
npm test Spec2 Spec3
```

* Goes well with [Ganesha](https://github.com/hackbg/ganesha) ;-)
