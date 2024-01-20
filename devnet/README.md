## Fadroma Devnet API

### Obtaining a Devnet

```typescript
import * as Devnet from '@fadroma/devnet'
const devnet = new Devnet.ScrtContainer.version["1.9"]()
```

### Creating the devnet

When scripting with the Fadroma API outside of the standard CLI/deployment
context, you can use the `getDevnet` method to configure and obtain a `Devnet`
instance.

`getDevnet` supports the following options; their default values can be
set through environment variables.

At this point you have prepared a *description* of a devnet.
To actually launch it, use the `create` then the `start` method:

At this point, you should have a devnet container running,
its state represented by files in your project's `state/` directory.

To operate on the devnet thus created, you will need to wrap it
in a **Chain** object and obtain the usual **Agent** instance.

For this, the **Devnet** class has the **getChain** method.

A `Chain` object which represents a devnet has the following additional API:

### Devnet state

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

### Devnet accounts

Devnet state is independent from the state of mainnet or testnet.
That means existing wallets and faucets don't exist. Instead, you
have access to multiple **genesis accounts**, which are provided
with initial balance to cover gas costs for your contracts.

When getting an **Agent** on the devnet, use the `name` property
to specify which genesis account to use. Default genesis account
names are `Admin`, `Alice`, `Bob`, `Charlie`, and `Mallory`.

This will populate the created Agent with the mnemonic for that
genesis account.

That's it! You are now set to use the standard Fadroma Agent API
to operate on the local devnet as the specified identity.

#### Custom devnet accounts

You can also specify custom genesis accounts by passing an array
of account names to the `accounts` parameter of the **getDevnet**
function.

### Cleaning up

Devnets are local-only and thus temporary.

To delete an individual devnet, the **Devnet** class
provides the **delete** method. This will stop and remove
the devnet container, then delete all devnet state in your
project's state directory.

To delete all devnets in a project, the **Project** class
provides the **resetDevnets** method:

