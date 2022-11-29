# Fadroma Build History

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
