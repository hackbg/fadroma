# Example and testing data

## Example mnemonics

```typescript
export const mnemonics = [
  'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy',
  'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing'
]
```

## Example contracts

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
import $, { BinaryFile } from '@hackbg/file'
import { readFileSync } from 'fs'
import { fixture } from '../fixtures/Fixtures.spec.ts.md'
export const examples = {}
example('Empty', 'empty.wasm',                     'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
example('KV',    'fadroma-example-kv@HEAD.wasm',   '16dea8b55237085f24af980bbd408f1d6893384996e90e0ce2c6fc3432692a0d')
example('Echo',  'fadroma-example-echo@HEAD.wasm', 'a4983efece1306aa897651fff74cae18436fc3280fc430d11a4997519659b6fd')
function example (name, wasm, hash) {
  return examples[name] = {
    name,
    path: fixture(wasm),
    data: $(fixture(wasm)).as(BinaryFile), read(),
    url:  $(fixture(wasm)).url,
    hash
  }
}
```

## Mocks

### Mock agent

```typescript
import { Agent, Chain, Uploader, Contract, Client } from '@fadroma/core'
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

