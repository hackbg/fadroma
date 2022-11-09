```typescript
import assert from 'node:assert'
import { Task } from '@hackbg/komandi'
import { defineInstance, ContractInstance } from './core-deploy-instance'

const a = defineInstance()
assert(a instanceof ContractInstance) 

const b = a()
assert(b instanceof Task)
assert(b.context instanceof ContractInstance)
```
