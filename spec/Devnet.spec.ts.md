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

The easiest way to start using Fadroma Devnet from a script
is the `getDevnet` function.

```typescript
import { Devnet, getDevnet } from '@hackbg/fadroma'
let devnet: Devnet
```

This is how to get a devnet that will keep running after the script exits:

```typescript
devnet = getDevnet({ persistent: true })

assert(devnet instanceof Devnet)
```

This is how to get a devnet that will delete all trace of itself
after the script exits:

```typescript
devnet = getDevnet({ removeOnExit: true })

assert(devnet instanceof Devnet)
```

And how to manage its lifecycle:

```typescript
await devnet.create()
await devnet.start()
await devnet.save()
await devnet.pause()
await devnet.delete()
```

To get a `Chain` for operating on the `Devnet`:

```typescript
const chain = devnet.getChain()

import { Chain } from '@fadroma/agent'
assert(devnet.getChain() instanceof Chain)
assert.equal(devnet.getChain().mode, Chain.Mode.Devnet)
```

Devnet URL defaults to localhost:

```typescript
// specifying devnet port:
const url = getDevnet({ port: '1234' }).url.toString()
assert.equal(url, 'http://localhost:1234/')
```

Devnet is stateful. It's represented in the project by e.g. `state/fadroma-devnet/devnet.json`.

```typescript
import { JSONFile, OpaqueDirectory } from '@hackbg/file'
assert.ok(devnet.stateDir)
assert.ok(devnet.save())
assert.ok(await Devnet.load(devnet.stateDir))
```

### Using genesis accounts

On devnet, Fadroma creates named genesis accounts for you,
which you can use by passing `name` to `getAgent`:

```typescript
// specifying genesis accounts:
assert.deepEqual(
  getDevnet({ removeOnExit: true, accounts: [ 'Alice', 'Bob' ] }).accounts,
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
project.resetDevnets()
```

---

```typescript
import assert from 'node:assert'
```
