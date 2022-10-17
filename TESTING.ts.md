# Test context and helpers

## Fixtures

* Files with a fixed content that are used in the test suites.
* Stored in [./fixtures](./fixtures/README.md).
* TODO use `fetch` instead of Node FS API

```typescript
import { CustomConsole, bold } from '@hackbg/konzola'
import $                      from '@hackbg/kabinet'
import { resolve, dirname }   from 'path'
import { fileURLToPath }      from 'url'
```

```typescript
export const here      = dirname(fileURLToPath(import.meta.url))
export const workspace = resolve(here)
export const fixture   = x => resolve(here, 'fixtures', x)
export const log       = new CustomConsole('Fadroma Testing')
```

### Example mnemonics

```typescript
export const mnemonics = [
  'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy',
  'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing'
]
```

### Example contracts

* Testing of the mocknet is done with the help fo two minimal smart contracts.
  * Compiled artifacts of those are stored under [`/fixtures`](./fixtures/README.md).
  * You can recompile them with the Fadroma Build CLI.
    See **[../examples/README.md]** for build instructions.
* They are also used by the Fadroma Ops example project.

* **Echo contract** (build with `pnpm rs:build:example examples/echo`).
  Parrots back the data sent by the client, in order to validate
  reading/writing and serializing/deserializing the input/output messages.
* **KV contract** (build with `pnpm rs:build:example examples/kv`).
  Exposes the key/value storage API available to contracts,
  in order to validate reading/writing and serializing/deserializing stored values.

```typescript
import { readFileSync } from 'fs'
export const examples = {}
example('Empty', 'empty.wasm',                     'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
example('KV',    'fadroma-example-kv@HEAD.wasm',   '16dea8b55237085f24af980bbd408f1d6893384996e90e0ce2c6fc3432692a0d')
example('Echo',  'fadroma-example-echo@HEAD.wasm', 'a4983efece1306aa897651fff74cae18436fc3280fc430d11a4997519659b6fd')
function example (name, wasm, hash) {
  return examples[name] = {
    name,
    path: fixture(wasm),
    data: readFileSync(fixture(wasm)),
    url:  $(fixture(wasm)).url,
    hash
  }
}
```

## Mocks

### Mock agent

```typescript
import { Agent, Chain, Uploader, Contract, Client } from '@fadroma/client'
export const mockAgent = () => new class MockAgent extends Agent {

  chain = new (class MockChain extends Chain {
    uploads = new class MockUploader extends Uploader {
      resolve = () => `/tmp/fadroma-test-upload-${Math.floor(Math.random()*1000000)}`
      make = () => new class MockFile {
        resolve = () => `/tmp/fadroma-test-upload-${Math.floor(Math.random()*1000000)}`
      }
    }
  })('mock')

  async upload () { return {} }

  instantiate (template, label, initMsg) {
    return new Contract({ ...template, label, initMsg, address: 'some address' })
  }

  async instantiateMany (contract, configs) {
    const receipts = {}
    for (const [{codeId}, name] of configs) {
      let label = name
      receipts[name] = { codeId, label }
    }
    return receipts
  }

  async getHash () {
    return 'sha256'
  }

}
```

### Mock of devnet manager

```typescript
import { spawn } from 'child_process'
const devnetManager = resolve(here, '../packages/devnet/devnet.server.mjs')
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
import { randomBech32 } from '@hackbg/formati'
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
import { Deployment } from './packages/client'
import { withTmpFile } from '@hackbg/kabinet'
import { equal } from 'assert'
import { basename } from 'path'
export const inTmpDeployment = cb => withTmpFile(f=>{
  const d = new Deployment(f, mockAgent())
  equal(d.name, basename(f))
  return cb(d)
})
```
