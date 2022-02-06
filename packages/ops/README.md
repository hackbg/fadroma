<div align="center">
<table><tr><td valign="middle" style="vertical-align:bottom">

[<img src="https://github.com/hackbg/fadroma/raw/22.01/doc/logo.svg" width="300">](https://fadroma.tech)

</td><td valign="center">

# Fadroma Ops ![](https://img.shields.io/badge/version-22.01-blueviolet)

**This package models the lifecycle of a smart contract,
and allows the user to compile and deploy source code to a blockchain.**

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

</td></tr></table>

![](./.pix/Figure_1.png)

By defining the following entities, this package aims to enable
the modeling and orchestration of reproducible deployment procedures
on current generation write-only smart contract platforms.

<table>

<tr><td width="50%" valign="top">

### [**`Client`**](./Client.ts)
* `.agent`
* `.address`
* `.codeHash`
* `.query(msg)`
* `.execute(msg)`
* `.instantiate(template, label, initMsg)`
* `.bundle()`

</td><td width="50%">

Defines the operations (queries and transactions) that can be
invoked on a smart contract. Allows a specific `Agent` to call
them on a specific `Address` + `CodeHash` pair.

```typescript
import { Client } from '@fadroma/ops'

class SimpleClient extends Client {
  getSomething () {
    return this.query("something")
  }
  setSomething (something) {
    return this.execute({something})
  }
}

new SimpleClient(agent, address, codeHash).setSomething("foo")
```

![](https://img.shields.io/badge/-protip-blueviolet?style=for-the-badge)
Use this pattern to support different contract API versions:

```typescript
abstract class VersionedClient extends Client {
  abstract version
  static "v1" = class VersionedClient_v1 extends VersionedClient {
    version = "v1"
    setSomething (something) {
      return this.execute({something})
    }
  }
  static "v2" = class VersionedClient_v2 extends VersionedClient {
    version = "v2"
    setSomething (value) {
      return this.execute({something:{value}})
    }
  }
  static "latest" = VersionedClient["v2"]
}

new VersionedClient["v1"](agent, address, codeHash).setSomething("foo")
new VersionedClient["v2"](agent, address, codeHash).setSomething("foo")
new VersionedClient["latest"](agent, address, codeHash).setSomething("foo")
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### [**`Contract`**](./Contract.ts)
  * `Builder`
  * `builder`
  * `build(builder?)`
  * `Uploader`
  * `uploader`
  * `upload(agent: Agent)`
  * `Client`
  * `client(agent: Agent)`

</td><td width="50%">

Manages the deployment of a smart contract.

```typescript
import { Contract } from '@fadroma/ops'

class SimpleContract extends Contract<SimpleClient> {
  source = { workspace, crate: 'simple-contract' }
}

new SimpleContract().client(agent).setSomething("foo")
```

![](https://img.shields.io/badge/-protip-blueviolet?style=for-the-badge)
Use this pattern to return the appropriate versioned `Client`:

```typescript
abstract class VersionedContract extends Contract<VersionedClient> {
  abstract version
  abstract Client
  static "v1" = class VersionedContract_v1 extends VersionedClient {
    version = "v1"
    source = { workspace, crate: 'simple-contract', ref: "v1.0.15" }
    Client = VersionedClient["v1"]
    // ..
  }
  static "v2" = class VersionedContract_v2 extends VersionedClient {
    version = "v2"
    source = { workspace, crate: 'simple-contract', ref: "v2.12.1" }
    Client = VersionedClient["v1"]
    // ..
  }
  static "latest" = VersionedContract["v2"]
}

new VersionedContract["v1"]().client(agent).setSomething("foo")
new VersionedContract["v2"]().client(agent).setSomething("foo")
new VersionedContract["latest"]().client(agent).setSomething("foo")
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### **`Source`**

* `.path`
  Local FS path to the root of the source repo.
* `.crate?`
  Name of the crate. Implies the repo is a workspace.
* `.ref?`
  Reference to specific Git commit to build.
* `.repo?`
  Git remote to fetch the commit if not present in working tree.
* `.features?[]`
  List of build flags.
* `.build(Builder)`

</td><td width="50%">

This interface is **new to Fadroma 23**. In **Fadroma 22.01**, its
functionality is covered by `Contract`.

In **Fadroma 23**, it represents the source code of a smart contract:
```typescript
import { Source } from '@fadroma/ops'
contract.source =
  new Source.Local.Crate(__dirname)                      ||
  new Source.Local.Workspace(__dirname, 'a-contract')    ||
  new Source.Remote.Crate('https://foo/bar.git', 'main') ||
  new Source.Remote.Workspace(
    'ssh://git@foo/bar.git',
    'v1.2.3',
    'a-contract'
  )
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### [**`Builder`**](./Build.ts)

* Raw
* Dockerized
  * `image`
  * `tag`
  * `script`
* Remote

</td><td width="50%">

In **Fadroma 22.01**, this calls the dockerized compiler (contract optimizer) on a `Contract`,
setting the contract's `artifact` field.
```typescript
import { Builder } from '@fadroma/ops'
const builder  = new Builder(contract)
const artifact = await builder.build()
```
In **Fadroma 23**, this calls the compiler on a `Source`, producing an `Artifact`.
```typescript
import { Builder } from '@fadroma/ops'
contract.artifact =
  await new Builder.Raw().build(contract.source)        ||
  await new Builder.Dockerized().build(contract.source) ||
  await new Builder.Remote('ssh://foo@bar').build(contract.source)
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### **`Artifact`**

</td><td width="50%">

In **Fadroma 22.01**, `artifact` is a string field of `Contract`.
In **Fadroma 23**, it is an object that represents a WASM blob
previously compiled from a `Source`.
```typescript
contract.artifact =
  new Artifact.Local('/path/to/blob.wasm', checksum) ||
  new Artifact.Remote('https://path/to/blob.wasm', checksum)
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### [**`Chain`**](./Chain.ts)

* `id` The chain id
* `async getAgent ()` Get an Agent

### [**`Agent`**](./Agent.ts)

* `async send()`
* `async instantiate()`
* `async execute()`
* `async query()`
* `async bundle()`
  * [**`Bundled<Agent>`**](./Agent.ts)

</td><td width="50%">

In **Fadroma 22**, these represent an existing blockchain,
and a controllable identity on it (i.e. an address for which
you have the signing key).

In **Fadroma 23** operations begin with the following:
```typescript
import Fadroma from '@hackbg/fadroma'
const chain = await Fadroma.connect()
const agent = await chain.getAgent()
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### [**`Uploader`**](./Upload.ts)

</td><td width="50%">

In **Fadroma 22.01**, this uploads a `Contract` to a `Chain`, setting its `codeId` field.
```typescript
import { Uploader } from '@fadroma/ops'
const uploader = new Uploader(contract)
const artifact = uploader.upload(chain, agent)
```
In **Fadroma 23**, this uploads an `Artifact` to a `Chain`, producing a `Template`.
```typescript
import { Uploader } from '@fadroma/ops'
contract.template =
  await new Uploader(agent).upload(contract.artifact)
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### **`Template`**

* `chainId`
* `codeId`
* `codeHash`
* `uploader?`
  A reference to the `Uploader` which produced this `Template`, if present.

</td><td width="50%">

This interface is **new to Fadroma 23**.

In **Fadroma 22.01**, `Contract` covers its functionality.

In **Fadroma 23**, it groups the `chainId`, `codeId` and `codeHash`
that are needed to instantiate an uploaded contract.

It can be produced by a `Uploader` by passing it an `Artifact`.

It and can be passed to a `Deployer` to get a new `Instance`.

```rust
contract.template = new Template({ chainId, codeId, codeHash })
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### [**`Deploy`**](./Deploy.ts)

</td><td width="50%">

#### Fadroma 22.01:
#### Fadroma 23:

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### [**`Init`**](./Init.ts)

</td><td width="50%">

#### Fadroma 22.01:
#### Fadroma 23:

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### **`Instance`**

* `chainId`
* `codeId`
* `codeHash`
* `address`

</td><td width="50%">

This interface is **new to Fadroma 23**.

In **Fadroma 22.01**, `Contract` covers its functionality.

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### [**`Client`**](./Client.ts)

* `agent`
* `address`
* `codeHash`
* `instance?`

</td><td width="50%">

This interface is **new to Fadroma 23**.

In **Fadroma 22.01**, `Contract` covers its functionality.

</td></tr>

</table>

</div>
