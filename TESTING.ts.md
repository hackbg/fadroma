
### Mock of devnet manager

```typescript
import { spawn } from 'child_process'
const devnetManager = resolve(here, 'packages/devnet/devnet.server.mjs')
const devnetInitScript = resolve(here, '_mock-devnet.init.mjs')
export async function mockDevnetManager (port) {
  port = port || await freePort(10000 + Math.floor(Math.random()*10000))
  const manager = spawn(process.argv[0], [devnetManager], {
    stdio: 'inherit',
    env: { PORT: port, FADROMA_DEVNET_INIT_SCRIPT: devnetInitScript PATH: process.env.path }
  })
  await new Promise(ok=>setTimeout(ok, 1000)) // FIXME flimsy!
  return { url: `http://localhost:${port}`, port, close () { manager.kill() } }
}
```

### Mock of mocknet environment

When testing your own contracts with Fadroma Mocknet, you are responsible
for providing the value of the `env` struct seen by the contracts.
Since here we test the mocknet itself, we use this pre-defined value:

```typescript
import { randomBech32 } from '@hackbg/4mat'
export function mockEnv () {
  const height   = 0
  const time     = 0
  const chain_id = "mock"
  const sender   = randomBech32('mocked')
  const address  = randomBech32('mocked')
  return {
    block:    { height, time, chain_id }
    message:  { sender: sender, sent_funds: [] },
    contract: { address },
    contract_key: "",
    contract_code_hash: ""
  }
}
```

### Mock deployment

```typescript
import { Deployment } from '@fadroma/core'
import { withTmpFile } from '@hackbg/file'
import { equal } from 'assert'
import { basename } from 'path'
export const inTmpDeployment = cb => withTmpFile(f=>{
  const d = new Deployment(f, mockAgent())
  return cb(d)
})
```
