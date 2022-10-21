# Fadroma Devnet Spec

The **devnet** (a.k.a. localnet) is a local instance of the selected chain.

* Devnets are persistent, and can be started and stopped,
  thanks to the file **devnet.nodeState** which contains
  info about the devnet container:

```typescript
import { defineDevnet, getDevnet } from '@fadroma/devnet'
defineDevnet()
for (const kind of ['scrt_1.2', 'scrt_1.3', 'scrt_1.4']) {
  getDevnet(kind)
}
```

## Base definitions

```typescript
import './devnet-base.spec.ts.md'
```

## Docker-based implementation

```typescript
import './devnet-docker.spec.ts.md'
```
