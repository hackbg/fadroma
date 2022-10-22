```typescript
import * as Testing from '../../TESTING.ts.md'
import * as Fadroma from '@fadroma/client'
import $ from '@hackbg/kabinet'
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
import { ContractSource, HEAD } from '@fadroma/client'
const contract = new ContractSource({
  repo:      '/tmp/fadroma-test',
  workspace: '/tmp/fadroma-test'
})
const contractWithSource = contract.define({
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

## Build caching

* When **builder.caching == true**, each build call first checks in `./artifacts`
  for a corresponding pre-existing build and reuses it if present.

```typescript
/* TODO: equal(typeof new BuildConfig().getBuilder().caching, 'boolean') */
```

## Build caching

The `LocalBuilder` abstract class makes sure that,
if a compiled artifact for the requested build
already exists in the project's `artifacts` directory,
the build is skipped.

Set the `FADROMA_REBUILD` environment variable to bypass this behavior.

```typescript
/* TODO: import { LocalBuilder } from '.'
builder = new class TestLocalBuilder extends LocalBuilder {
  async build (source) { return {} }
}
//await assert.throws(()=>builder.prebuild({}))
equal(builder.prebuild('', 'empty'), null) */
```
