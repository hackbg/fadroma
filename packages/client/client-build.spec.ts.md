# Fadroma Core Spec: Building contracts from source

```typescript
import assert from 'node:assert'
```

## The `ContractSource` class

Represents the source code of a contract.
  * Compiling a source populates the `artifact` property.
  * Uploading a source creates a `ContractTemplate`.

```typescript
import { ContractSource } from '@fadroma/client'
let source: ContractSource = new ContractSource()
let builder = { build: async x => x }
assert.ok(await source.define({ builder }).compiled)
```

