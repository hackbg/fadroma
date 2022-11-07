# Fadroma Core Spec: Contract code handling

```typescript
import assert from 'node:assert'
const contract = { address: 'addr' }
const agent = { getHash: async x => 'hash', getCodeId: async x => 'id' }
```

## Code hashes

The code hash uniquely identifies the compiled code that underpins a contract.

```typescript
import { fetchCodeHash, assertCodeHash, codeHashOf } from '@fadroma/core'

assert.ok(assertCodeHash({ codeHash: 'hash' }))
assert.throws(()=>assertCodeHash({}))

assert.ok(await fetchCodeHash(contract, agent))
assert.ok(await fetchCodeHash(contract, agent, 'hash'))
assert.rejects(fetchCodeHash(contract, agent, 'unexpected'))

assert.equal(codeHashOf({ codeHash: 'hash' }), 'hash')
assert.equal(codeHashOf({ code_hash: 'hash' }), 'hash')
assert.throws(()=>codeHashOf({ code_hash: 'hash1', codeHash: 'hash2' }))
```

## Code ids

The code id is also an unique identifier for compiled code uploaded to a chain.

```typescript
import { fetchCodeId } from '@fadroma/core'

assert.ok(await fetchCodeId(contract, agent))
assert.ok(await fetchCodeId(contract, agent, 'id'))
assert.rejects(fetchCodeId(contract, agent, 'unexpected'))
```

### ICC structs

```typescript
import { templateStruct, linkStruct } from '@fadroma/core'
assert.deepEqual(
  templateStruct({ codeId: '123', codeHash: 'hash'}),
  { id: 123, code_hash: 'hash' }
)
assert.deepEqual(
  linkStruct({ address: 'addr', codeHash: 'hash'}),
  { address: 'addr', code_hash: 'hash' }
)
```

