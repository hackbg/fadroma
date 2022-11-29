```typescript
import { buildCrates } from '@fadroma/build'
await buildCrates([])
```

## Build tasks

>FIXME: should this still exist?

These are similar to the deploy tasks but don't need access to any chain
(because they don't upload or instantiate).

```typescript
import { BuildContext } from '.'
const buildTask: BuildContext = new BuildContext()
ok(buildTask.builder instanceof Fadroma.Builder)

// mock out:
buildTask.builder = { async build () { return {} } }
buildTask.exit    = () => {}
buildTask.project = '.'

ok(buildTask.contract() instanceof Fadroma.Contract,
  'define a contract to build')
ok(buildTask.contract({ crate: 'kv', builderId: 'local' }).build() instanceof Promise,
  'build is asynchronous')
ok(await buildTask.buildFromPath($('examples/kv'), []) ?? true,
   'build from directory')
ok(await buildTask.buildFromPath($('examples/kv/Cargo.toml'), []) ?? true,
   'build from file: Cargo.toml')
ok(await buildTask.buildFromPath($('packages/build/build.example.ts'), ['kv']) ?? true,
   'build from file: build script')
```
