# Fadroma: Secret Network support

Fadroma's support for Secret Network is achieved in this package,
by implementing the Fadroma Agent API (`Chain`, `Agent`, `Bundle`),
as well as SN-specific features (`ViewingKeyClient`).

Note that this package should be kept isomorphic (see `@fadroma/core`).
Platform-specific logic and artifacts for Secret Network also exists
in `@fadroma/devnet`.

```typescript
import Scrt from '@fadroma/scrt'
```

## Configuring

Several options are exposed as environment variables.

```typescript
const config = new Scrt.Config()
```

## Connecting

To connect to Secret Network with Fadroma, use one of the following:

```typescript
const mainnet = Scrt.Mainnet()
const testnet = Scrt.Testnet()
const devnet  = Scrt.Devnet()
const mocknet = Scrt.Mocknet()
```

## Authenticating

Then, to authenticate:

* With a mnemonic:

```typescript
const agent1 = await mainnet.getAgent({ mnemonic: '...' })
ok(agent instanceof Scrt.Agent)
```

* With Keplr:

```typescript
const agent2 = await mainnet.fromKeplr() // TODO
ok(agent2 instanceof Scrt.Agent)
```

* With secretcli:

```typescript
const agent3 = await mainnet.fromSecretCli() // TODO
ok(agent3 instanceof Scrt.Agent)
```

## Viewing keys

Since viewing keys are a Secret Network-specific feature, they are also implemented here:

```typescript
const client = new Scrt.ViewingKeyClient()
```

## Internals

### Transaction bundling

A Secret Network-specific implementation of message bundling is included:

```typescript
const bundle = agent.bundle()
ok(bundle instanceof Scrt.Bundle)
```
