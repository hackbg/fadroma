# Fadroma Upload

This package implements **uploading WASM files to get code ids**.

## Upload CLI

```shell
$ fadroma upload CONTRACT   # nil if same contract is already uploaded
$ fadroma reupload CONTRACT # always reupload
```

## Upload API

## Uploader

* **FetchUploader**: Support for uploading from any URL incl. `file:///`
* **FSUploader**: Support for uploading files from local FS with `node:fs`.

Uploading with default configuration (from environment variables):

```typescript
import { fixture } from '../fixtures/Fixtures.ts.md'
const artifact = fixture('null.wasm') // replace with path to your binary

import { upload } from '@fadroma/ops'
await upload({ artifact })
```

Passing custom options to the uploader:

```typescript
import { getUploader } from '@fadroma/ops'
await getUploader({ /* options */ }).upload({ artifact })
```

### Upload caching

Contracts start out as source code, which `@fadroma/ops` compiles to binary artifacts
(WASM files). The `Uploader` class takes care of uploading them and producing a JSON file
containing upload metadata, which we call an **upload receipt**.

```typescript
import { JSONDirectory, withTmpDir } from '@hackbg/file'
import { DeployConfig, FSUploader } from '@fadroma/ops'
import { Agent, Uploader, Template } from '@fadroma/agent'
import { examples } from '../fixtures/Fixtures.ts.md'
let config:   DeployConfig
let uploader: Uploader
let agent:    Agent = { chain: { id: 'testing' }, upload: async x => x }
let template: Template = new Template({ artifact })
```

When trying to upload a binary file, the `Uploader` checks if a corresponding receipt exists;
if it does, it returns the existing code ID instead of uploading the same file twice.

```typescript
await withTmpDir(async path=>{
  uploader = new FSUploader(agent, new JSONDirectory(path))
  assert.ok(uploader.agent === agent)
  assert.ok(await uploader.upload(template))
  assert.ok(await uploader.upload(template))
  assert.ok(await uploader.uploadMany([template]))
})
```

### Uploader variants

#### FSUploader

`FSUploader` uploads WASM to the chain from local files.

#### FetchUploader

`FetchUploader`, uploads WASM to the chain from remote URLs.

### Upload events

```typescript
```

### Upload errors

```typescript
```

---

```typescript
import assert from 'node:assert'
```
