```typescript
import * as Testing from '../../TESTING.ts.md'
import * as Fadroma from '@fadroma/core'
import $ from '@hackbg/file'
import assert, { ok, equal, deepEqual, throws } from 'assert'
```

## Specifying projects and sources

The `ContractSource` class has the following properties for specifying the source.
Use `contract.define({ key: value })` to define their values.
This returns a new copy of `contract` without modifying the original one.

* `repository: Path|URL` points to the Git repository containing the contract sources.
  * This is all you need if your smart contract is a single crate.
* `revision: string` can points to a Git reference (branch or tag).
  * This defaults to `HEAD`, i.e. the currently checked out working tree
  * If set to something else, the builder will check out and build a past commit.
* `workspace: Path|URL` points to the Cargo workspace containing the contract sources.
  * This may or may not be equal to `contract.repo`,
  * This may be empty if the contract is a single crate.
* `crate: string` points to the Cargo crate containing the individual contract source.
  * If `contract.workspace` is set, this is required.

The outputs of builds are called **artifact**s, and are represented by two properties:
  * `artifact: URL` points to the canonical location of the artifact.
  * `codeHash: string` is a SHA256 checksum of the artifact, which should correspond
    to the **template.codeHash** and **instance.codeHash** properties of uploaded and
    instantiated contracts.

```typescript
import { ContractSource } from '@fadroma/core'

const contract = new ContractSource({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE'
})

equal(contract.repository, 'REPO')
equal(contract.revision,   'REF')
equal(contract.workspace,  'WORKSPACE')
equal(contract.crate,      'CRATE')
```

## Build caching

When **builder.caching == true**, each build call first checks in `./artifacts`
for a corresponding pre-existing build and reuses it if present.

* Set the `FADROMA_REBUILD` environment variable to bypass this behavior.

```typescript
// TODO example
```
