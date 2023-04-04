# Fadroma Project Scope

## Creating a project

```shell
$ npx fadroma project create
```

```typescript
import Project from './Project'

const project = new Project('my-project', './examples/project', {
  name: 'test',
  contracts: {
    contract1: {},
  }
}).create()
```

## Adding contracts to the project scope

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

|Env var              |Default path              |Description                               |
|---------------------|--------------------------|------------------------------------------|
|`FADROMA_CONFIG`     |`@/fadroma.json`          |Checksums of compiled contracts by version|
|`FADROMA_ARTIFACTS`  |`@/artifacts.sha256`      |Checksums of compiled contracts by version|
|`FADROMA_UPLOADS`    |`@/state/uploads.csv`     |Checksums of compiled contracts by version|
|`FADROMA_DEPLOYMENTS`|`@/state/deployments.csv` |Checksums of compiled contracts by version|

### Build artifacts

* **Deploy receipts**: records of one or more deployed contract instances.
* **Upload receipts**: records of a single uploaded contract binary.
