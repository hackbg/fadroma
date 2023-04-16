# Fadroma Project Scope

## Project CLI

```shell
$ npx fadroma project create
$ npx fadroma project contract add
$ npx fadroma project contract list
$ npx fadroma project contract del
```

### Project configuration

|Env var|Default path|Description|
|-|-|-|
|`FADROMA_CONFIG`     |`@/fadroma.json`          |Global project configuration|
|`FADROMA_ARTIFACTS`  |`@/artifacts.sha256`      |Checksums of compiled contracts by version|
|`FADROMA_UPLOADS`    |`@/state/uploads.csv`     |Receipts of uploaded contracts|
|`FADROMA_DEPLOYMENTS`|`@/state/deployments.csv` |Receipts of instantiated (deployed) contracts|

## Project API

### Creating a project

```typescript
import { Project } from '@fadroma/ops'

const project = new Project({
  name: 'my-project',
  root: './examples/project',
  contracts: {
    contract1: {},
  }
}).create()
```

### Adding contracts to the project scope

```shell
$ npx fadroma contract list
$ npx fadroma contract add
$ npx fadroma contract del
```

```typescript
const contract1 = project.addContract('contract')
assert(contract1 instanceof Template)

const contract2 = project.getContract('contract')
assert(contract2 instanceof Template)
```

## Project state

### Build artifacts

Checksums of compiled contracts by version.

### Upload receipts

Records of a single uploaded contract binary.

### Deploy receipts

Records of one or more deployed contract instances.

```typescript
import assert from 'node:assert'
import { Template } from '@fadroma/agent'
```
