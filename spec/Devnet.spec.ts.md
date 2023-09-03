# Fadroma Guide: Devnet

Fadroma Devnet is the feature which enables fully local
development of projects - no remote testnet needed!

Fadroma contains container images based on `localsecret`,
for versions of Secret Network 1.2 to 1.9.

## Devnet CLI

Normally, you would interact with a devnet no different than any other
**Chain** instance: through your **Deployment** class.

When using the Fadroma CLI, Chain instances are provided automatically.
So, when `FADROMA_CHAIN` is set to `ScrtDevnet`, the provided Chain
is a Devnet.

As a shortcut, in projects created via the Fadroma CLI, the `devnet`
NPM script is an alias to `FADROMA_CHAIN=ScrtDevnet fadroma`.
So, to deploy your project to a local devnet, you would just run:

```sh
$ npm run devnet deploy
```

The `reset` command stops the devnet and erases its state.

```sh
$ npm run devnet reset
```

## Devnet state

Each **devnet** is a stateful local instance of a chain node
(such as `secretd` or `okp4d`).

1. A container named `fadroma-KIND-ID`, where:

  * `KIND` is what kind of devnet it is. (For now, the only valid
    value is `devnet`. In future releases, this will be changed to
    contain the chain name and maybe the chain version.)

  * `ID` is a random 8-digit hex number so that when you have
    multiple devnets of the same kind, you can distinguish them
    from one another.

  * The name of the container corresponds to the chain ID of the
    contained devnet.

2. State files under `your-project/state/fadroma-KIND-ID/`:

  * `devnet.json` contains metadata about the devnet, such as
    the chain ID, container ID, connection port, and container
    image to use.

  * `wallet/` contains JSON files with the addresses and mnemonics
    of the **genesis accounts** that are created when the devnet
    is initialized. These are the initial holders of the devnet's
    native token, and you can use them to execute transactions.

  * `upload/` and `deploy/` contain **upload and deploy receipts**.
    These work the same as for remote testnets and mainnets,
    and enable reuse of uploads and deployments.

## Devnet API

### In `@fadroma/agent`

The Chain class, defined in `@fadroma/agent`,
supports devnets in the following ways:

* One of the supported values for `chain.mode: ChainMode` is `Devnet`.

* The `chain.isDevnet: boolean` getter identifies whether the selected Chain is a devnet

* The optional `chain.devnet: DevnetHandle` property exposes a handful of devnet-specific
  properties and methods:

  * `chain.devnet.running: boolean` is `true` if the container is running

  * `chain.devnet.start(): Promise<this>` starts the devnet container

  * `chain.devnet.getAccount(name): Promise<Partial<Agent>>` returns the
    address and mnemonic for a named genesis account

  * `chain.devnet.assertPresence(): Promise<void>` throws if the devnet
    container ID is known, but the container itself is not found.

### In `@hackbg/fadroma`

The actual logic for managing devnet containers is implemented in the
`@hackbg/fadroma` package, which defines a `Devnet` class.

Under the hood, the implementation uses the library [`@hackbg/dock`](https://www.npmjs.com/package/@hackbg/dock)
to manage Docker images and containers.

An easy way to get a fully populated devnet is the `getDevnet` method.

```typescript
import { Devnet, getDevnet } from '@hackbg/fadroma'
let devnet: Devnet
```

This is how to get a devnet that will keep running after your script exits:

```typescript
devnet = getDevnet({ persistent: true })

assert(devnet instanceof Devnet)
```

This is how to get a devnet that will delete all trace of itself
after your script exits:

```typescript
devnet = getDevnet({ deleteOnExit: true })

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
  getDevnet({ deleteOnExit: true, accounts: [ 'Alice', 'Bob' ] }).accounts,
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
