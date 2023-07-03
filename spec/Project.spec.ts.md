# Project API

## Configuration

|Env var|Default path|Description|
|-|-|-|
|`FADROMA_ROOT`        |current working directory |Root directory of project|
|`FADROMA_PROJECT`     |`@/ops.ts`                |Project command entrypoint|
|`FADROMA_BUILD_STATE` |`@/wasm`                  |Checksums of compiled contracts by version|
|`FADROMA_UPLOAD_STATE`|`@/state/uploads.csv`     |Receipts of uploaded contracts|
|`FADROMA_DEPLOY_STATE`|`@/state/deployments.csv` |Receipts of instantiated (deployed) contracts|

## Creating a project

```shell
$ npx @hackbg/fadroma@latest create
```

```typescript
import Project from '@hackbg/fadroma'

const root = tmpDir()

let project: Project = new Project({
  root: `${root}/test-project-1`,
  name: 'test-project-1',
  templates: {
    test1: { crate: 'test1' },
    test2: { crate: 'test2' },
  }
})
  .create()
  .status()
  .cargoUpdate()
```

## Defining new contracts

```shell
$ npm exec fadroma add
```

```typescript
const test1 = project.getTemplate('test1')
assert(test1 instanceof Template)

const test3 = project.setTemplate('test3', { crate: 'test2' })
assert(test3 instanceof Template)
```

## Building

```shell
$ npm exec fadroma build CONTRACT [...CONTRACT]
```

Building all templates in the project:

```typescript
await project.build()
```

Building some templates from the project:

```typescript
await project.build('test1')
```

Checksums of compiled contracts by version are stored in the build state
directory, `wasm/`.

## Uploading

```shell
$ npm exec fadroma upload CONTRACT [...CONTRACT]
```

Uploading all templates in the project:

```typescript
await project.upload()
```

Uploading some templates from the project:

```typescript
await project.upload('test2')
```

If contract binaries are not present, the upload command will try to build them first.
Every successful upload logs the transaction as a file called an **upload receipt** under
`state/$CHAIN_ID/upload.`. This contains info about the upload transaction.

The `UploadStore` loads a collection of upload receipts and tells the `Uploader` if a
binary has already been uploaded, so it can prevent duplicate uploads.

## Deploying

```shell
$ npm exec fadroma deploy [...ARGS]
```

Deploying the project:

```typescript
await project.deploy(/* any deploy arguments, if you've overridden the deploy procedure */)
```

Commencing a deployment creates a corresponding file under `state/$CHAIN_ID/deploy`, called
a **deploy receipt**. As contracts are deployed as part of this deployment, their details
will be appended to this file so that they can be found later.

When a deploy receipt is created, that deployment is made active. This is so you can easily
find and interact with the contract you just deployed. The default deploy procedure is
dependency-based, so if the deployment fails, re-running `deploy` should try to resume
where you left off. Running `deploy` on a completed deployment will do nothing.

To start over, use the `redeploy` command:

```shell
$ npm exec fadroma redeploy [...ARGS]
```

```typescript
await project.redeploy(/* ... */)
```

This will create and activate a new deployment, and deploy everything anew.

Keeping receipts of your primary mainnet/testnet deployments in your version control system
will let you keep track of your project's footprint on public networks.

During development, receipts for deployments of a project are kept in a
human- and VCS-friendly YAML format. When publishing an API client,
you may want to include individual deployments as JSON>

```typescript
await project.exportDeployment('state')
```

---

```typescript
import assert from 'node:assert'
import { Template } from '@fadroma/agent'
import { tmpDir } from './fixtures/Fixtures.ts.md'
import './Project.test'
```
