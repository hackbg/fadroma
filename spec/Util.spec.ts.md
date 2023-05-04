# Fadroma Guide: Utilities

### Lazy evaluation

### Generic collections

```typescript
import { into, intoArray, intoRecord } from '@fadroma/agent'

assert.equal(await into(1), 1)
assert.equal(await into(Promise.resolve(1)), 1)
assert.equal(await into(()=>1), 1)
assert.equal(await into(async ()=>1), 1)

assert.deepEqual(
  await intoArray([1, ()=>1, Promise.resolve(1), async () => 1]),
  [1, 1, 1, 1]
)

assert.deepEqual(await intoRecord({
  ready:   1,
  getter:  () => 2,
  promise: Promise.resolve(3),
  asyncFn: async () => 4
}), {
  ready:   1,
  getter:  2,
  promise: 3,
  asyncFn: 4
})
```

### Validation against expected value

Case-insensitive.

```typescript
import { validated } from '@fadroma/agent'
assert.ok(validated('test', 1))
assert.ok(validated('test', 1, 1))
assert.ok(validated('test', 'a', 'A'))
assert.throws(()=>validated('test', 1, 2))
assert.throws(()=>validated('test', 'a', 'b'))
```

### Overrides and fallbacks

Only work on existing properties.

```typescript
import { override, fallback } from '@fadroma/agent'
assert.deepEqual(
  override({ a: 1, b: 2 }, { b: 3, c: 4 }),
  { a: 1, b: 3 }
)
assert.deepEqual(
  fallback({ a: 1, b: undefined }, { a: undefined, b: 3, c: 4 }),
  { a: 1, b: 3 }
)
```

### Tabular alignment

For more legible output.

```typescript
assert.equal(getMaxLength(['a', 'ab', 'abcd', 'abc', 'b']), 4)
function getMaxLength (strings: string[]): number {
  return Math.max(...strings.map(string=>string.length))
}
```

```typescript
import assert from 'node:assert'
```

