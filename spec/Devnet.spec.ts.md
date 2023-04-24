# Devnets: local development backends

The **devnet** (a.k.a. localnet) is a local instance of the selected chain.
Devnets are persistent, and can be started and stopped; info about contracts
deployed to a devnet is stored in your project's state.

The abstract logic of managing a devnet is implemented in the `Devnet` class.
There's currently a single concrete devnet implementation, based on `@hackbg/dock`,
which uses Docker or Podman for running a devnet container.

Fadroma contains container images based on `localsecret`,
for versions of Secret Network 1.2 to 1.7.

## Devnet CLI

```sh
$ npx fadroma devnet start
$ npx fadroma devnet stop
$ npx fadroma devnet export
$ npx fadroma devnet clear
```

## Devnet API

```typescript
import { getDevnet } from '@fadroma/ops'

// unleash the kraken:
const devnet = await getDevnet({ /* options */ })

// but be ready to kill it if you unleash it:
process.on('exit', () => devnet.erase())

await devnet.spawn()
await devnet.save()
await devnet.kill()
await devnet.load()
await devnet.respawn()
await devnet.kill()
await devnet.export()
await devnet.erase()

import { Devnet } from '@fadroma/ops'
assert(devnet instanceof Devnet)

import { JSONFile, OpaqueDirectory } from '@hackbg/file'
assert.ok(devnet.nodeState instanceof JSONFile)
assert.ok(devnet.stateRoot instanceof OpaqueDirectory)
```

### Connecting to a devnet

```typescript
const chain = devnet.getChain()

import { Chain } from '@fadroma/agent'
assert(chain instanceof Chain)
```

### Using genesis accounts

On devnet, Fadroma creates named genesis accounts for you,
which you can use by passing `name` to `getAgent`:

```typescript
const alice = await chain.getAgent({ name: 'Alice' })

import { Agent } from '@fadroma/agent'
assert(alice instanceof Agent)
```

### Exporting a devnet with deployed contracts

### Resetting the devnet

---

```typescript
import assert from 'node:assert'
```

```typescript
assert.equal(new Devnet({ port: '1234' }).url.toString(), 'http://localhost:1234/')
assert.ok(new Devnet().save())
assert.ok(await new Devnet().load())
assert.deepEqual(new Devnet({ identities: [ 'ALICE', 'BOB' ] }).genesisAccounts, [ 'ALICE', 'BOB' ])
import { DevnetCommands } from '@fadroma/ops'
const commands = new DevnetCommands()
commands.status()
commands.reset()
```
