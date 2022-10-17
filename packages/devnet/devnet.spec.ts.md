# Fadroma Devnet Spec

```typescript
import { defineDevnet, getDevnet } from '@fadroma/devnet'
//await defineDevnet()()
getDevnet()
```

## Base definitions

```typescript
import './devnet-base.spec.ts.md'
```

## Docker-based implementation

```typescript
import './devnet-docker.spec.ts.md'
```

The devnet is a temporary self-hosted instance of the selected blockchain network,
with a user-specified chain id.

* Devnets are persistent, and can be started and stopped,
  thanks to the file **devnet.nodeState** which contains
  info about the devnet container:
