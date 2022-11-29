# How contracts are built

```typescript
import assert from 'node:assert'
```

## The `ContractSource` class

Represents the source code of a contract.
  * Compiling a source populates the `artifact` property.
  * Uploading a source creates a `ContractTemplate`.

```typescript
import { ContractSource } from '@fadroma/core'
let source: ContractSource = new ContractSource()
let builder = { build: async x => x }
assert.ok(await source.define({ builder }).compiled)
```

## Building from history

```typescript
import { ok, throws } from 'node:assert'
```

If `.git` directory is present, builders can check out and build a past commits of the repo,
as specifier by `contract.revision`.

```typescript
import { ContractSource } from '@fadroma/core'
import { getGitDir, DotGit } from '@fadroma/build'

throws(()=>getGitDir(new ContractSource()))

const contractWithSource = new ContractSource({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE'
})

ok(getGitDir(contractWithSource) instanceof DotGit)
```
