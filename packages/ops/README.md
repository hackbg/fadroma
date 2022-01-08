# Fadroma Ops

This is an opinionated framework providing an idiomatic way to
**build, deploy, and interact with smart contracts** on Cosmos-based networks.

Currently, only Secret Network is supported via [`@fadroma/scrt`](../scrt),
more specifically the [`@fadroma/scrt-1.0`](../scrt-1.0) and
[`@fadroma/scrt-1.2`](../scrt-1.2) modules.

This library consists of literate modules. The actual library code is contained in
the Markdown files that document it, and is loaded from this Markdown file
via the [`@hackbg/ganesha`](https://github.com/hackbg/ganesha) family of tools.

## Table of contents

* A [ChainNode](./ChainNode.ts.md) lets you run a blockchain node
  running in a container. We call this *localnet*, or *devnet*. 
* A [Chain](./Chain.ts.md) object lets you reference a specific
  localnet, testnet, or mainnet; by creating one, you specify on which
  chain you will be operating.
* An [Agent](./Agent.ts) represents the identity under which
  you are operating, i.e. your crypto wallet and address.
  [`@fadroma/scrt`](../scrt) provides implementations based on SecretJS and secretcli.
* A Smart [Contract](./Contract.ts.md) is a program running on the blockchain.
  This library automates building them from Rust code, deploying them to a specific
  `Chain` in the name of a specific `Agent`, and then interacting with them as
  the same or a different `Agent`.
* The `Agent` that performs a transaction pays for the computational resources
  in gas fees; the [Gas](./Gas.ts.md) module contains types for specifying the
  maximum gas fee per operation.

## Tutorial: Managing a smart contract's lifecycle with Fadroma Ops

`TODO`
