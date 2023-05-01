## Introductory example

FIXME: add to spec (fix imports)

```typescript
import { Scrt } from '@hackbg/fadroma'
import { ExampleContract } from '@example/project'

export default async function main () {
  const chain    = new Scrt()
  const agent    = await chain.getAgent().ready
  const address  = "secret1..."
  const contract = new Client({ agent, address: "secret1..." })
  const response = await contract.myQuery()
  const result   = await contract.myTransaction()
  return result
}
```

## The three-tier model

Now we're getting somewhere! There are a few things going on in the above example -
most importantly, it demonstrates the three-tier model of Fadroma Client.

When using a client class, you're broadcasting transactions from a **specific address** on a
**specific chain**, to a **specific smart contract** on the **same chain**. This is specified
in terms of the following entities:

### `Chain`s

Chain objects correspond to separate execution environments, i.e. **they represent blockchains**.

Chains inherit from the base `Chain` class exported by `@fadroma/agent`.

`Scrt` is the **chain class** representing the Secret Network mainnet.

### `Agent`s

Agent objects correspond to identities operating in a specific environment, i.e.
**they represent wallets**.

Agents inherit from the base `Agent` class exported by `@fadroma/agent`.

Calling `chain.getAgent()` returns an instance of `ScrtRPCAgent`.
This is the **agent class** that uses `secretjs@beta` to talk to Secret Network API
via signed transactions.

Of course, you can have multiple authenticated agents with different addresses and keys,
and interact with the chain as different identities from the same script.

### `Client`s

Client objects are interfaces to programs deployed in a specific environment, i.e.
**they represent smart contracts**.

Clients inherit from the base `Client` class exported by `@fadroma/agent`.

Calling `agent.getClient(MyContract, address)` returns an instance of `MyContract` that is bound
to the contract at `address`. You can now query and make transactions, and the transactions will
be signed with the agent's key and broadcast from the agent's address.
