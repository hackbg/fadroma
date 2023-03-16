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

* With a fresh wallet (randomly generated mnemonic)

```typescript
const agent0 = await mainnet.getAgent()

ok(agent0 instanceof Scrt.Agent)
ok(agent0.chain instanceof Scrt.Chain)
ok(agent0.mnemonic)
ok(agent0.address)
```

* With a mnemonic:

```typescript
const agent1 = await mainnet.getAgent({ mnemonic: '...' })

ok(agent1 instanceof Scrt.Agent)
ok(agent1.chain instanceof Scrt.Chain)
ok(agent1.mnemonic)
ok(agent1.address)
```

* With Keplr:

```typescript
const agent2 = await mainnet.fromKeplr() // TODO

ok(agent2 instanceof Scrt.Agent)
ok(agent2.chain instanceof Scrt.Chain)
ok(agent2.mnemonic)
ok(agent2.address)
```

* With secretcli:

```typescript
const agent3 = await mainnet.fromSecretCli() // TODO

ok(agent3 instanceof Scrt.Agent)
ok(agent3.chain instanceof Scrt.Chain)
ok(agent3.mnemonic)
ok(agent3.address)
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
