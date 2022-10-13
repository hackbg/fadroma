# Fadroma Build History

```typescript
import { ok, throws } from 'node:assert'
```

If `.git` directory is present, builders can check out and build a past commits of the repo,
as specifier by `contract.revision`.

```typescript
import { Contract } from '@fadroma/client'
import { getGitDir, DotGit } from '@fadroma/build'

throws(()=>getGitDir(new Contract()))

const contractWithSource = new Contract({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE'
})

ok(getGitDir(contractWithSource) instanceof DotGit)
```
