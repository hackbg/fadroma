# Fadroma Upload Specification

```typescript
import { ok } from 'node:assert'
```

```typescript
import { JSONDirectory } from '@hackbg/kabinet'
import { DeployConfig, FSUploader } from '@fadroma/deploy'
import { Agent, Uploader, ContractTemplate } from '@fadroma/client'
import { examples } from '../../TESTING.ts.md'
let config:   DeployConfig
let uploader: Uploader
let agent:    Agent = { chain: { id: 'testing' }, upload: async x => x }
let artifact: URL = examples['KV'].url
let template: ContractTemplate = new ContractTemplate({ artifact })
```

The abstract base class `Uploader` defined in Fadroma Core is here extended
to implement the `FSUploader` class.

  * It uploads compiled contracts to the chain.
    * It needs an `agent` to perform the upload.

```typescript
config = new DeployConfig({ FADROMA_CHAIN: 'Mocknet' })
uploader = await config.getUploader()
ok(uploader instanceof Uploader)
```

  * It writes **upload receipts** to a specified directory,
    and uses those every subsequent time you request the same contract
    to be uploaded.

```typescript
import { FSUploader } from '.'
agent = { upload: async x => x }
agent.chain = { id: 'testing' }
uploader = new FSUploader(agent, new JSONDirectory())
ok(uploader.agent === agent)
ok(await uploader.upload(template))
ok(await uploader.uploadMany([]))
```
