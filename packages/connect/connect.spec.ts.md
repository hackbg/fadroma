# Fadroma Connect Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import * as Fadroma from '@fadroma/connect'
import assert, { ok, equal, deepEqual } from 'assert'
```

## Connect configuration

```typescript
import { ConnectConfig } from '.'
const config = new ConnectConfig({ FADROMA_CHAIN: 'Mocknet' }, '')
```

## Connector: context for a connection to a chain

```typescript
import { Connector, connect } from '.'
ok(await config.getConnector())
ok(await config.getChain())
ok(await config.getAgent())
```

## [Connect variants](./connect-variants.spec.ts.md)

```typescript
import './connect-variants.spec.ts.md'
```

## [Connect logging](./connect-events.spec.ts.md)

```typescript
import './connect-events.spec.ts.md'
```
