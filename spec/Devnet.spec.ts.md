# Fadroma Guide: Devnet

Fadroma enables fully local development of projects - no remote testnet needed!
This feature is known as **Fadroma Devnet**. 

Normally, you would interact with a devnet no different than any other
`Chain`: through your `Deployment` subclass.

When using the Fadroma CLI, `Chain` instances are provided automatically
to instances `Deployment` subclasses.

So, when `FADROMA_CHAIN` is set to `ScrtDevnet`, your deployment will
be instantiated alongside a local devnet, ready to operate!

As a shortcut, projects created via the Fadroma CLI contain the `devnet`
NPM script, which is an alias to `FADROMA_CHAIN=ScrtDevnet fadroma`.

So, to deploy your project to a local devnet, you would just run:

```sh
$ npm run devnet deploy
```

## Advanced usage

Fadroma Devnet includes container images based on `localsecret`,
for versions of Secret Network 1.2 to 1.9. Under the hood, the
implementation uses the library [`@hackbg/dock`](https://www.npmjs.com/package/@hackbg/dock)
to manage Docker images and containers. There is also experimental
support for Podman.

When scripting with the Fadroma API outside of the standard CLI/deployment
context, you can use the `getDevnet` method to configure and obtain a `Devnet`
instance.

```typescript
import { getDevnet } from '@hackbg/fadroma'

const devnet = getDevnet(/* { options } */)
```

`getDevnet` supports the following options; their default values can be
set through environment variables.

|name|env var|description|
|-|-|-|
|**chainId**|`FADROMA_DEVNET_CHAIN_ID`|**string**: chain ID (set to reconnect to existing devnet)|
|**platform**|`FADROMA_DEVNET_PLATFORM`|**string**: what kind of devnet to instantiate (e.g. `scrt_1.9`)|
|**deleteOnExit**|`FADROMA_DEVNET_REMOVE_ON_EXIT`|**boolean**: automatically remove the container and state when your script exits|
|**keepRunning**|`FADROMA_DEVNET_KEEP_RUNNING`|**boolean**: don't pause the container when your script exits|
|**host**|`FADROMA_DEVNET_HOST`|**string**: hostname where the devnet is running|
|**port**|`FADROMA_DEVNET_PORT`|**string**: port on which to connect to the devnet|

At this point you have prepared a *description* of a devnet.
To actually launch it, use the `create` then the `start` method:

```typescript
await devnet.create()
await devnet.start()
```

At this point, you should have a devnet container running,
its state represented by files in your project's `state/` directory.

To operate on the devnet thus created, you will need to wrap it
in a **Chain** object and obtain the usual **Agent** instance.

For this, the **Devnet** class has the **getChain** method.

```typescript
const chain = devnet.getChain()
```

A `Chain` object which represents a devnet has the following additional API:

|name|description|
|-|-|
|**chain.mode**|**ChainMode**: `"Devnet"` when the chain in question is a devnet|
|**chain.isDevnet**|**boolean:** `true` when the chain in question is a devnet|
|**chain.devnet**|**DevnetHandle**: allows devnet internals to be controlled from your script|
|**chain.devnet.running**|**boolean**: `true` if the devnet container is running|
|**chain.devnet.start()**|**()⇒Promise\<this\>**: starts the devnet container|
|**chain.devnet.getAccount(name)**|**(string)⇒Promise\<Partial\<Agent\>\>**: returns info about a genesis account|
|**chain.devnet.assertPresence()**|**()⇒Promise\<void\>**: throws if the devnet container ID is known, but the container itself is not found|

```typescript
assert(chain.mode === 'Devnet')
assert(chain.isDevnet)
assert(chain.devnet === devnet)
```

### Devnet accounts

Devnet state is independent from the state of mainnet or testnet.
That means existing wallets and faucets don't exist. Instead, you
have access to multiple **genesis accounts**, which are provided
with initial balance to cover gas costs for your contracts.

When getting an **Agent** on the devnet, use the `name` property
to specify which genesis account to use. Default genesis account
names are `Admin`, `Alice`, `Bob`, `Charlie`, and `Mallory`.

```typescript
const alice = chain.getAgent({ name: 'Alice' })
await alice.ready
```

This will populate the created Agent with the mnemonic for that
genesis account.

```typescript
assert(
  alice instanceof Agent
)

assert.equal(
  alice.name,
  'Alice'
)

assert.equal(
  alice.address,
  $(chain.devnet.stateDir, 'wallet', 'Alice.json').as(JSONFile).load().address,
)

assert.equal(
  alice.mnemonic,
  $(chain.devnet.stateDir, 'wallet', 'Alice.json').as(JSONFile).load().mnemonic,
)
```

That's it! You are now set to use the standard Fadroma Agent API
to operate on the local devnet as the specified identity.

You can also specify custom genesis accounts by passing an array
of account names to the `accounts` parameter of the **getDevnet**
function.

```typescript
const anotherDevnet = getDevnet({
  accounts: [ 'Alice', 'Bob' ],
  deleteOnExit: true, // this is just for the test's sake
})

assert.deepEqual(
  anotherDevnet.accounts,
  [ 'Alice', 'Bob' ]
)
```

### Devnet state and lifecycle

Each **devnet** is a stateful local instance of a chain node
(such as `secretd` or `okp4d`), and consists of two things:

1. A container named `fadroma-KIND-ID`, where:

  * `KIND` is what kind of devnet it is. For now, the only valid
    value is `devnet`. In future releases, this will be changed to
    contain the chain name and maybe the chain version.

  * `ID` is a random 8-digit hex number. This way, when you have
    multiple devnets of the same kind, you can distinguish them
    from one another.

  * The name of the container corresponds to the chain ID of the
    contained devnet.

```typescript
assert.ok(
  chain.id.match(/fadroma-devnet-[0-9a-f]{8}/)
)

assert.equal(
  chain.id,
  chain.devnet.chainId
)

assert.equal(
  (await chain.devnet.container).name,
  `/${chain.id}`
)
```

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

```typescript
assert.equal(
  $(chain.devnet.stateDir).name,
  chain.id
)

assert.deepEqual(
  $(chain.devnet.stateDir, 'devnet.json').as(JSONFile).load(),
  {
    chainId:     chain.id,
    containerId: chain.devnet.containerId,
    port:        chain.devnet.port,
    imageTag:    chain.devnet.imageTag
  }
)

assert.deepEqual(
  $(chain.devnet.stateDir, 'wallet').as(JSONDirectory).list(),
  chain.devnet.accounts
)
```

### Exporting a devnet snapshot

An exported devnet deployment is a great way to provide a
standardized development build of your project. For example,
you can use one to test the frontend/contracts stack as a
step of your integration pipeline.

To create a snapshot, use the **export** method of the **Devnet** class:

```typescript
await devnet.export()
```

When the active chain is a devnet, the `export` command,
which exports a list of contracts in the current deployment,
also saves the current state of the devnet as **a new container image**.

```sh
$ npm run devnet export
```

The Devnet instance has the following lifecycle methods:

```typescript
await devnet.create()
await devnet.start()
await devnet.save()
await devnet.pause()
```

Devnet URL defaults to localhost:

```typescript
// specifying devnet port:
assert.equal(
  getDevnet({ port: '1234' }).url.toString(),
  'http://localhost:1234/'
)
```

Devnet is stateful. It's represented in the project by e.g. `state/fadroma-devnet/devnet.json`.

```typescript
assert.ok(devnet.stateDir)
assert.ok(devnet.save())
assert.ok(await Devnet.load(devnet.stateDir))
```

## Cleaning up

Devnets are local-only and thus temporary.

To delete an individual devnet, the **Devnet** class
provides the **delete** method. This will stop and remove
the devnet container, then delete all devnet state in your
project's state directory.

```typescript
await devnet.delete()
```

To delete all devnets in a project, the **Project** class
provides the **resetDevnets** method:

```typescript
import Project from '@hackbg/fadroma'
const project = new Project()
project.resetDevnets()
```

The to call **resetDevnets** from the command line, use the
`reset` command:

```sh
$ npm run devnet reset
```

---

```typescript
import assert from 'node:assert'
import { Chain, Agent } from '@fadroma/agent'
import $, { JSONFile, JSONDirectory } from '@hackbg/file'
import { Devnet } from '@hackbg/fadroma'
```
