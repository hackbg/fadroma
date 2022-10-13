# Fadroma Build History

If `.git` directory is present, builders can check out and build a past commits of the repo,
as specifier by `contract.revision`.

```typescript
import { getGitDir, DotGit } from '@fadroma/build'
import { Contract } from '@fadroma/client'

const contract = new Contract({
  repo:      '/tmp/fadroma-test',
  workspace: '/tmp/fadroma-test'
})

throws(()=>getGitDir(contract))

const contractWithSource = contract.define({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE'
})

ok(getGitDir(contractWithSource) instanceof DotGit)
```
