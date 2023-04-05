# Fadroma Upload

This package implements **uploading WASM files to get code ids**.

## Upload CLI

```shell
$ fadroma upload CONTRACT   # nil if same contract is already uploaded
$ fadroma reupload CONTRACT # always reupload
```

## Upload API

```typescript
import { getUploader } from '@fadroma/ops'

await getUploader({ /* options */ }).upload({ artifact: 'contract' })
```

### Upload state

Contracts start out as source code, which `@fadroma/ops` compiles to binary artifacts
(WASM files). The `Uploader` class takes care of uploading them and producing a JSON file
containing upload metadata, which we call an **upload receipt**.

```typescript
import { JSONDirectory, withTmpDir } from '@hackbg/file'
import { DeployConfig, FSUploader } from '@fadroma/ops'
import { Agent, Uploader, Template } from '@fadroma/agent'
import { examples } from '../examples/Examples.spec.ts.md'
let config:   DeployConfig
let uploader: Uploader
let agent:    Agent = { chain: { id: 'testing' }, upload: async x => x }
let artifact: URL = examples['KV'].url
let template: Template = new Template({ artifact })
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

### Uploader variants

#### FSUploader

`FSUploader` uploads WASM to the chain from local files.

#### FetchUploader

`FetchUploader`, uploads WASM to the chain from remote URLs.

### Upload events

### Upload errors
