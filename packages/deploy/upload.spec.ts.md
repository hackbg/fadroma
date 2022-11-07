# Fadroma Upload Specification

```typescript
import { ok } from 'node:assert'
```

Contracts start out as source code, which `@fadroma/build` compiles to binary artifacts
(WASM files). The `Uploader` class takes care of uploading them and producing a JSON file
containing upload metadata, which we call an **upload receipt**.

```typescript
import { JSONDirectory, withTmpDir } from '@hackbg/kabinet'
import { DeployConfig, FSUploader } from '@fadroma/deploy'
import { Agent, Uploader, ContractTemplate } from '@fadroma/core'
import { examples } from '../../TESTING.ts.md'
let config:   DeployConfig
let uploader: Uploader
let agent:    Agent = { chain: { id: 'testing' }, upload: async x => x }
let artifact: URL = examples['KV'].url
let template: ContractTemplate = new ContractTemplate({ artifact })
```

When trying to upload a binary file, the `Uploader` checks if a corresponding receipt exists;
if it does, it returns the existing code ID instead of uploading the same file twice.

```typescript
config = new DeployConfig({ FADROMA_CHAIN: 'Mocknet' })
uploader = await config.getUploader()
ok(uploader instanceof Uploader)

await withTmpDir(async path=>{
  uploader = new FSUploader(agent, new JSONDirectory(path))
  ok(uploader.agent === agent)
  ok(await uploader.upload(template))
  ok(await uploader.upload(template))
  ok(await uploader.uploadMany([template]))
})
```
