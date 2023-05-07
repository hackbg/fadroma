# Fadroma Guide: Devnet

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
import { getDevnet } from '@hackbg/fadroma'

// unleash the kraken:
const devnet = await getDevnet({ /* options */ })

// but be ready to kill it if you unleash it:
process.on('beforeExit', () => devnet.erase())

await devnet.spawn()
await devnet.kill()
await devnet.respawn()
await devnet.kill()
await devnet.erase()

import { Devnet } from '@hackbg/fadroma'
assert(devnet instanceof Devnet)

import { Chain } from '@fadroma/agent'
assert(devnet.getChain() instanceof Chain)
assert.equal(devnet.getChain().mode, Chain.Mode.Devnet)
```

### Connecting to a devnet

```typescript

// specifying devnet port:
assert.equal(
  new Devnet({ port: '1234' }).url.toString(),
  'http://localhost:1234/'
)
```

### Devnet state

Devnet is stateful. It's represented in the project by e.g. `state/fadroma-devnet/devnet.json`.

```typescript
import { JSONFile, OpaqueDirectory } from '@hackbg/file'
assert.ok(devnet.stateFile instanceof JSONFile)
assert.ok(devnet.stateDir instanceof OpaqueDirectory)

assert.ok(devnet.save())
assert.ok(await devnet.load())
```

### Using genesis accounts

On devnet, Fadroma creates named genesis accounts for you,
which you can use by passing `name` to `getAgent`:

```typescript
// specifying genesis accounts:
assert.deepEqual(
  new Devnet({ genesisAccounts: [ 'Alice', 'Bob' ] }).genesisAccounts,
  [ 'Alice', 'Bob' ]
)

const alice = await devnet.getChain().getAgent({ name: 'Alice' })

import { Agent } from '@fadroma/agent'
assert(alice instanceof Agent)

```

### Exporting a devnet snapshot

The `fadroma export` command exports a list of contracts in the current deployment.

When the active chain is a devnet, `fadroma export` also saves the current state of the
Docker container as a new Docker image. This image contains a snapshot of all the deployed
contracts and other activity on the devnet prior to the export.

```typescript
await devnet.export()
```

An exported devnet deployment is a great way to provide a standardized development build
of your project. You can use one to test the frontend<->contracts stack in a separate step
of your integration pipeline.

### Resetting the devnet

The `fadroma reset` command kills and erases the devnet.

```typescript
import Project from '@hackbg/fadroma'
const project = new Project()
project.resetDevnet()
```

---

```typescript
import assert from 'node:assert'
```
