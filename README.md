<div align="center">

[![Fadroma](./homepage/logo.svg)](https://fadroma.tech)

*Level the landscape.*

**Groundwork** for **dApp development** with **Rust** and **TypeScript** on **Secret Network**.

[![](https://img.shields.io/npm/v/@hackbg/fadroma?color=%2365b34c&label=%40hackbg%2Ffadroma&style=for-the-badge)](https://www.npmjs.com/package/@hackbg/fadroma)

---

Start exploring:

[**Getting Started Guide**](./guide/basic-project-setup.md) — [Rust Smart Contract API](https://fadroma.tech/rs/fadroma/index.html) — [TypeScript Operations API](https://fadroma.tech/js/modules.html)

[**Executable Specification**](./SPEC.ts.md) — [Future Roadmap](./ROADMAP.ts.md) — [Contribution Guidelines](CONTRIBUTING.md)

---

**Fadroma** aims to take the CosmWasm Compute module and spin it into a fully integrated app platform.

This repository contains assorted **Rust** libraries for smart contracts
and a **TypeScript** system for building, deploying, and interacting with them.

Check out our [**example project**](https://github.com/hackbg/fadroma-example) to see how to
build your dApp with Fadroma.

---

Fadroma models the domain of interacting with Cosmos-like APIs
in 3 layers of value objects:

* API connection and transactions:
  * [`Chain`](./fadroma.client.spec.ts.md#Chain)
  * [`Agent`](./fadroma.client.spec.ts.md#Agent)
  * [`Bundle`](./fadroma.client.spec.ts.md#Bundle)

* Contract lifecycle:
  * [`Source`](./fadroma.contract.spec.ts.md#Source)
  * [`Template`](./fadroma.contract.spec.ts.md#Template)
  * [`Client`](././fadroma.contract.spec.ts.md#Client)

* Contract lifecycle transformers:
  * [`Builder`](./client.spec.ts.md#Builder)
  * [`Uploader`](./client.spec.ts.md#Uploader)
  * [`Contract`](./client.spec.ts.md#Contract)

---

```
"The reasonable man adapts himself to the world;
 the unreasonable one persists in trying to adapt the world to himself.
 Therefore, all progress depends on the unreasonable man."
                                    - Marvin Heemeyer
```

---

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

</div>
