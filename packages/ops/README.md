<div align="center">

![](/doc/logo.svg)

# Fadroma Ops

Made with 💚  at [Hack.bg](https://hack.bg).

---

</div>

**Fadroma Ops** is an opinionated framework providing an idiomatic way to
**build, deploy, and interact with smart contracts** on Cosmos-based networks.

## How to use

Not directly. You need to install [`@fadroma/scrt-1.2`](../scrt-1.2),
which extends this module with support for **Secret Network 1.2**. There also exists
`@fadroma/scrt-1.0` (legacy). Both inherit this module through [`@fadroma/scrt`](../scrt).

You only want to install this module if you're implementing support for
another Cosmos-based chain. If you do, we'd love to hear about it -
get in touch at `hello@hack.bg` so we can link to your repo here.

> 🐘 ℹ️  This library is written in the form of [literate](https://github.com/hackbg/ganesha)
> modules with the `.ts.md` extension. That's right, TypeScript in Markdown!
> When you download it from NPM, you get the compiled `*.js` and `*.d.ts`,
> as well as the documented source code.

## Table of contents

<div align="center">

|Interface                                     |Description                                                |Works in Node.js|Works in browsers|
|----------------------------------------------|-----------------------------------------------------------|----------------|-----------------|
|[`ChainNode`](./src/ChainNode.ts.md)          |Runs a temporary blockchain node.                          |🟩 Yes          |❌ No            |
|[`Chain`](./src/Chain.ts.md)                  |Specifies on which localnet, testnet or mainnet to operate.|🟩 Yes          |🟩 Yes           |
|[`Agent`](./src/Agent.ts.md)                  |Specifies under which identity to operate.                 |🟩 Yes          |🟩 Yes           |
|[`Gas`](./src/Gas.ts.md)                      |Specifies the maximum gas fee per operation.               |🟩 Yes          |🟩 Yes           |
|[`ContractBuild`](./src/ContractBuild.ts.md)  |Builds smart contracts from Rust to WASM in Docker.        |🟩 Yes          |❌ No            |
|[`ContractDeploy`](./src/ContractDeploy.ts.md)|Deploys compiled smart contracts to a `Chain`              |🟩 Yes          |⌛ Planned       |
|[`ContractClient`](./src/ContractClient.ts.md)|Talks to smart contracts on a `Chain` via an `Agent`       |🟩 Yes          |🟩 Yes           |

</div>

## Tutorial: Managing a smart contract's lifecycle with Fadroma Ops

`TODO`
