# Fadroma Migrate

```typescript
import assert from 'assert'
const MigrateSpec = {}
const test = tests => Object.assign(MigrateSpec, tests)
export default MigrateSpec
```

```typescript
import { runMigration } from './Migrate'
test({
  async 'run empty migration' () {
    const result = await runMigration("", [], [])
  },
  async 'run migration with falsy step' () {
    const result = await runMigration("", [undefined], [])
  },
  async 'run migration with one step' () {
    const result = await runMigration("", [()=>{foo:true}], [])
    assert(result.foo)
  }
  async 'subsequent steps update the context' () {
    const result = await runMigration("", [
      ()=>{foo:true},
      ()=>{bar:true}
    ], [])
    assert(result.foo)
    assert(result.bar)
  }
})
```
