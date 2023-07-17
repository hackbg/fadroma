# Guide to implementing support in Fadroma for new chains

To benefit from Fadroma, the blockchain must be roughly OOP-shaped:
"smart contract" is understood as a persistent stateful entity with a
constructor (init procedure) and callable read-only and read-write
transaction methods

Minimum viable glue for supporting any new blockchain to Fadroma:

* The package should live in a subdirectory of `connect/`

* The package should be reexported by `connect/`,
  which is the library for connecting Fadroma Agent
  to any supported chain.

* The official client library (`secretjs`, etc)
  should be a peer dependency of the package.
  This allows the user to upgrade (or pin) the
  version of the client library that they are using
  without depending on the one we use for testing.

So, basically one package under `./connect/` per lower-level library:
`@fadroma/scrt` calls `secretjs`; `@fadroma/cw` calls `@cosmjs/stargate`;
`@fadroma/eth` would call `web3`/`ethers`/`viem`; whether we would want to
support one or more of those and whether that would be 1 or 3 connect modules
is an open-ended question.

* The package should implement the `Chain`, `Agent` and `Bundle`
  classes from `@fadroma/core`.

* `Chain` should be a stateless representation for the whole chain
  (user would create one instance for each mainnet, testnet, etc.
  that they want to connect to during the application run).

* `Agent` is a wrapper binding a wallet to an API client.
  The `upload` and `instantiate` methods allow contracts to
  be created, and `execute` and `query` to transact with them.

* `Bundle` may be implemented if client-side transaction batching
  is to be supported. This is the basis for exporting things like
  multisig transactions to be manually signed and broadcast.

[^1]: The reason it's like that comes from the early days of Sec
