# Fadroma Devnet Tests

```typescript
import assert from 'assert'
const DevnetSpec = {}
const test = tests => Object.assign(DevnetSpec, tests)
export default DevnetSpec
```

## Devnets are persistent

```typescript
test({
  async 'save/load Devnet state' () {
    throw 'TODO'
  }
})
```

## Dockerode devnet

```typescript
import { DockerodeDevnet } from './Devnet'
test({
  async 'pass names of accounts to prefund on genesis' () {
    throw 'TODO'
  },
})
```

## Managed devnet

```typescript
import { ManagedDevnet } from './Devnet'
test({
  async 'ManagedDevnet.getOrCreate' () {
    const devnet = ManagedDevnet.getOrCreate()
  },
})
```

### Mock managed devnet API

```typescript
export async function mockDevnetEndpoint () {
  throw 'TODO'
}
```
