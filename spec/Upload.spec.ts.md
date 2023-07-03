# Fadroma Upload

Fadroma takes care of **uploading WASM files to get code IDs**.

Like builds, uploads are *idempotent*: if the same code hash is
known to already be uploaded to the same chain (as represented by
an upload receipt in `state/$CHAIN/uploads/$CODE_HASH.json`,
Fadroma will skip the upload and reues the existing code ID.

## Upload CLI

The `fadroma upload` command (available through `npm run $MODE upload`
in the default project structure) lets you access Fadroma's `Uploader`
implementation from the command line.

```shell
$ fadroma upload CONTRACT   # nil if same contract is already uploaded
$ fadroma reupload CONTRACT # always reupload
```

## Upload API

The client package, `@fadroma/agent`, exposes a base `Uploader` class,
which the global `fetch` method to obtain code from any supported URL
(`file:///` or otherwise).

This `fetch`-based implementation only supports temporary, in-memory
upload caching: if you ask it to upload the same contract many times,
it will upload it only once - but it will forget all about that
as soon as you refresh the page.

The backend package, `@hackbg/fadroma`, provides `FSUploader`.
This extension of `Uploader` uses Node's `fs` API instead, and
writes upload receipts into the upload state directory for the
given chain (e.g. `state/$CHAIN/uploads/`).

Let's try uploading an example WASM binary:

```typescript
import { fixture } from './fixtures/Fixtures.ts.md'
const artifact = fixture('fadroma-example-kv@HEAD.wasm') // replace with path to your binary
```

* Uploading with default configuration (from environment variables):

```typescript
import { upload } from '@hackbg/fadroma'
await upload({ artifact })
```

* Passing custom options to the uploader:

```typescript
import { getUploader } from '@hackbg/fadroma'
await getUploader({ /* options */ }).upload({ artifact })
```

---

```typescript
import assert from 'node:assert'
//await import('./Upload.test.ts')
```
