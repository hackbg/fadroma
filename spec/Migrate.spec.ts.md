# Fadroma Migrate

```typescript
import assert from 'assert'
const MigrateSpec = {}
const test = tests => Object.assign(MigrateSpec, tests)
export default MigrateSpec
```

```typescript
import { runMigration } from '../index'
test({
  async 'run empty migration' () {
    const result = await runMigration("", [], [])
  },
  async 'run migration with falsy step' ({ rejects }) {
    rejects(runMigration("", [undefined], []))
  },
  async 'run migration with one step' ({ ok }) {
    const result = await runMigration("", [()=>({foo:true})], [])
    ok(result.foo)
  }
  async 'catch and rethrow step failure' ({ rejects }) {
    const error = {}
    await rejects(runMigration("", [()=>{throw error}], []))
  },
  async 'subsequent steps update the context' ({ ok }) {
    const result = await runMigration("", [
      ()=>({foo:true}),
      ()=>({bar:true})
    ], [])
    ok(result.foo)
    ok(result.bar)
  },
  async 'the context.run function runs steps without updating context' ({ rejects, ok }) {
    await rejects(runMigration("", [ async ({ run }) => { await run() } ], []))
    ok(await runMigration("", [ async ({ run }) => { await run(async () => {}) } ], []))
  },
})
```
