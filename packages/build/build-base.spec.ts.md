```typescript
import * as Testing from '../../TESTING.ts.md'
import * as Fadroma from '@fadroma/client'
import $ from '@hackbg/kabinet'
import assert, { ok, equal, deepEqual, throws } from 'assert'
```

## Specifying projects and sources

The `Contract` class has the following properties for specifying the source.
Use `contract.provide({ key: value })` to define their values.
This returns a new copy of `contract` without modifying the original one.

* `contract.repository: Path|URL` points to the Git repository containing the contract sources.
  * This is all you need if your smart contract is a single crate.
* `contract.revision: string` can points to a Git reference (branch or tag).
  * This defaults to `HEAD`, i.e. the currently checked out working tree
  * If set to something else, the builder will check out and build a past commit.
* `contract.workspace: Path|URL` points to the Cargo workspace containing the contract sources.
  * This may or may not be equal to `contract.repo`,
  * This may be empty if the contract is a single crate.
* `contract.crate: string` points to the Cargo crate containing the individual contract source.
  * If `contract.workspace` is set, this is required.

```typescript
import { Contract, HEAD } from '@fadroma/client'
const contract = new Fadroma.Contract({
  repo:      '/tmp/fadroma-test',
  workspace: '/tmp/fadroma-test'
})
const contractWithSource = contract.provide({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE'
})
equal(contractWithSource.repository, 'REPO')
equal(contractWithSource.revision,   'REF')
equal(contractWithSource.workspace,  'WORKSPACE')
equal(contractWithSource.crate,      'CRATE')
equal(contractWithSource.revision, 'REF')
```

