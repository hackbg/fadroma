### `ContractTemplate`

```typescript
import assert from 'node:assert'
```

## The `ContractTemplate` class

Represents an uploaded contract that is not yet instantiated.
  * Can have `codeId` and `codeHash` but no `address`.
  * Instantiating a template creates a `ContractInstance`.

```typescript
import { ContractSource, ContractTemplate } from '@fadroma/client'
let template: ContractTemplate = new ContractTemplate()
let builder  = { build: async x => x }
let agent    = { chain: { id: 'test' }, getHash: async x => 'hash' }
let uploader = { agent, upload: async x => x }
assert.ok(template.asUploadReceipt)
const uploaded = template.define({ builder, uploader }).uploaded
assert.equal(uploaded, template.uploaded)
assert.ok(template.define({ codeId: '123', codeHash: 'hash' }).asInfo)
assert.ok(await uploaded)
```
