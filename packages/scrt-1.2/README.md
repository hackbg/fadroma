<div align="center">

![](/doc/logo.svg)

# Fadroma Ops for Secret Network 1.2

Made with 💚  at [Hack.bg](https://hack.bg).

---

</div>

**Fadroma Ops for Secret Network 1.2** implements the [**Fadroma Ops**](../ops) APIs
for Secret Network 1.2. This is the module you're looking for if you want to
quickly and easily deploy and use smart contracts on Secret Network.

## How to use

Install `@fadroma/scrt-1.2` via your package manager.

> 🐘 ℹ️  This library is written in the form of [literate](https://github.com/hackbg/ganesha)
> modules with the `.ts.md` extension. That's right, TypeScript in Markdown!
> When you download it from NPM, you get the usual compiled `*.js` and `*.d.ts`,
> as well as the documented source code, which can be compiled on demand with [Ganesha](https://github.com/hackbg/ganesha).

## Table of contents

Fadroma Ops for Secret Network 1.2 defines the following entities. Some of them are isomorphic, and
work the same in Node.js and browsers. Others only make sense outside of a browser - mainly because
the workflows that they represent depend on command-line tools such as `secretcli` or `docker`.

<div align="center">

|Interface                                                     |Description                                                |Works in Node.js|Works in browsers|
|--------------------------------------------------------------|-----------------------------------------------------------|----------------|-----------------|
|[`ScrtAgentJS_1_2`](./src/ScrtAgentJS_1_2.ts.md)              |[Agent](../ops/src/Agent.ts.md) based on **secretcli**     |🟩 Yes          |❌ No            |
|[`ScrtContract_1_2`](./src/ScrtContract_1_2.ts.md)            |[Agent](../ops/src/Agent.ts.md) based on **SecretJS**      |🟩 Yes          |🟩 Yes           |
|[`DockerizedScrtNode_1_2`](./src/DockerizedScrtNode_1_2.ts.md)|[ChainNode](../ops/src/ChainNode.ts.md) with Scrt 1.2 image|🟩 Yes          |🟩 Yes           |

</div>
