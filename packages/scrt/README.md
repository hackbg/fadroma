<div align="center">

![](/doc/logo.svg)

# Fadroma Ops for Secret Network

Made with 💚  at [Hack.bg](https://hack.bg).

---

</div>

**Fadroma Ops for Secret Network** implements the [**Fadroma Ops**](../ops) APIs
for Secret Network. This module contains the shared parts between
(current) [**Fadroma Ops for Secret Network 1.2**](../scrt-1.0) and
(legacy) [**Fadroma Ops for Secret Network 1.0**](../scrt-1.2).

## How to use

Not directly. You need to install [`@fadroma/scrt-1.2`](../scrt-1.2),
which extends this module with support for **Secret Network 1.2**.
There also exists `@fadroma/scrt-1.0` (legacy).

> 🐘 ℹ️  This library is written in the form of [literate](https://github.com/hackbg/ganesha)
> modules with the `.ts.md` extension. That's right, TypeScript in Markdown!
> When you download it from NPM, you get the compiled `*.js` and `*.d.ts`,
> as well as the documented source code.

## Table of contents

Fadroma Ops for Secret Network defines the following entities. Some of them are isomorphic, and
work the same in Node.js and browsers. Others only make sense outside of a browser - mainly because
the workflows that they represent depend on command-line tools such as `secretcli` or `docker`.

<div align="center">

|Interface                                     |Description                                                                  |Works in Node.js|Works in browsers|
|----------------------------------------------|-----------------------------------------------------------------------------|----------------|-----------------|
|[`ScrtAgentCLI`](./src/ScrtAgentCLI.ts.md)    |[Agent](../ops/src/Agent.ts.md) based on **secretcli**                       |🟩 Yes          |❌ No            |
|[`ScrtAgentJS`](./src/ScrtAgentJS.ts.md)      |[Agent](../ops/src/Agent.ts.md) based on **SecretJS**                        |🟩 Yes          |🟩 Yes           |
|[`ScrtChain`](./src/ScrtChain.ts.md)          |[Chain](../ops/src/Chain.ts.md) with addresses and ids of known Secret chains|🟩 Yes          |🟩 Yes           |
|[`ScrtChainNode`](./src/ScrtChainNode.ts.md)  |[ChainNode](../ops/src/ChainNode.ts.md) with Scrt image                      |🟩 Yes          |❌ No            |
|[`ScrtContract`](./src/ScrtContract.ts.md)    |[Contract](../ops/src/ContractBuild.ts.md) with Scrt build image             |🟩 Yes          |❌ No            |
|[`ScrtGas`](./src/ScrtGas.ts.md)              |[Gas](../ops/src/Gas.ts.md) denominated in `uscrt`                           |🟩 Yes          |🟩 Yes           |

</div>
