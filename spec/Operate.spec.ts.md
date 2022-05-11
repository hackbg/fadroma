# Fadroma Operate

```typescript
import assert from 'assert'
const OperateSpec = {}
const test = tests => Object.assign(OperateSpec, tests)
export default OperateSpec
```

```typescript
import { runOperation } from '../index'
test({
  async 'run empty migration' () {
    const result = await runOperation("", [], [])
  },
  async 'run migration with falsy step' ({ rejects }) {
    rejects(runOperation("", [undefined], []))
  },
  async 'run migration with one step' ({ ok }) {
    const result = await runOperation("", [()=>({foo:true})], [])
    ok(result.foo)
  }
  async 'catch and rethrow step failure' ({ rejects }) {
    const error = {}
    await rejects(runOperation("", [()=>{throw error}], []))
  },
  async 'subsequent steps update the context' ({ ok }) {
    const result = await runOperation("", [
      ()=>({foo:true}),
      ()=>({bar:true})
    ], [])
    ok(result.foo)
    ok(result.bar)
  },
  async 'the context.run function runs steps without updating context' ({ rejects, ok }) {
    await rejects(runOperation("", [ async ({ run }) => { await run() } ], []))
    ok(await runOperation("", [ async ({ run }) => { await run(async () => {}) } ], []))
  },
})
```
