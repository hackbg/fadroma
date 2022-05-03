# `@hackbg/runspec`

Minimal test runner and reporter.

## Example

1. **Define test specs as default exports of ES modules.**
   No `describe`s, `expect`s, or other BS; freely use
   JavaScript's native control flow constructs
   and Node's built-in `assert` library.

```typescript
// specN.spec.js
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

2. **Define a test index.**

```typescript
// index.spec.js
import runSpec from '@hackbg/runspec'
import Spec1   from './spec1.spec'
import Spec2   from './spec2.spec'
import Spec3   from './spec3.spec'
runSpec({
  Something,
  Another
})
```

3. **Run the test index.**
   Pass no arguments to run all test suites,
   or pass the name of one or more suites to
   run just them.

```sh
node index.spec.js
node index.spec.js Spec1
node index.spec.js Spec2 Spec3
```

4. **Add to `package.json`**

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
