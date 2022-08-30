# Fadroma Core

[![](https://img.shields.io/npm/v/@fadroma/client?color=%2365b34c&label=%40fadroma%2Fclient&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/client)

Base layer for isomorphic dAPI clients.

Models the domain of interacting with Cosmos-like APIs
in 3 layers of value objects:

* API connection and transactions:
  * [`Chain`](./client.spec.ts.md#Chain)
  * [`Agent`](./client.spec.ts.md#Agent)
  * [`Bundle`](./client.spec.ts.md#Bundle)

* Contract lifecycle:
  * [`Source`](./client.spec.ts.md#Source)
  * [`Template`](./client.spec.ts.md#Template)
  * [`Client`](./client.spec.ts.md#Client)

* Contract lifecycle transformers:
  * [`Builder`](./client.spec.ts.md#Builder)
  * [`Uploader`](./client.spec.ts.md#Uploader)
  * [`Contract`](./client.spec.ts.md#Contract)
