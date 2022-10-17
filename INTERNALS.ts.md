This is where the [testing](./TESTING.ts.md) gets heavy.

```typescript
import * as Fadroma from '@hackbg/fadroma'
import Testing from './TESTING.ts.md'
```

* Mode deployments

```typescript
// integrations
const prefixOfActiveDeployment = Symbol()
const context = {
  deployments: {
    async create () {},
    async select () {},
    get () {},
    active: { prefix: prefixOfActiveDeployment, receipts: [] },
    printActive () {},
    list () { return [
      {prefix: '.active.yml'},
      {prefix: prefixOfActiveDeployment},
      {prefix:'somethingelse'}]
    },
  }
}
await Deploy.getOrCreate(context)
const { deployment, prefix } = await Deploy.get(context)
equal(deployment, context.deployments.active)
equal(prefix,     context.deployments.active.prefix)
await Deploy.status(context)
await Deploy.status(context)
```

* Chain-specific devnet handles

```typescript
import { getScrtDevnet } from '@hackbg/fadroma'
for (const version of ['1.2', '1.3']) {
  continue
  throw new Error('TODO')
  const dokeres = new Dokeres(mockDockerode(({ createContainer })=>{
    if (createContainer) {
      const stream = {
        on  (arg, cb) { if (arg === 'data') { cb(readyPhrase) } },
        off (arg, cb) {},
        destroy () {},
      }
      return [ null, stream ]
    }
  }))
  const devnet = getScrtDevnet(version, undefined, undefined, dokeres)
  ok(devnet instanceof DockerDevnet)
  await devnet.respawn()
  await devnet.kill()
  await devnet.erase()
}
```
