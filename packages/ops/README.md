<div align="center">
<table><tr><td valign="middle" style="vertical-align:bottom">

[<img src="https://github.com/hackbg/fadroma/raw/22.01/doc/logo.svg" width="300">](https://fadroma.tech)

</td><td valign="center">

# Fadroma Ops
Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

</td></tr></table>

This package models the lifecycle of a smart contract,
as illustrated below.

![](./.pix/Figure_1.png)

By defining the following entities, this package aims to enable
the modeling and orchestration of reproducible deployment procedures
on current generation write-only smart contract platforms.

<table>
<tr><td width="50%" valign="top">

### [**`Contract`**](./Contract.ts)

Represents a smart contract.

</td><td width="50%">

#### Fadroma 22.01:
```typescript
import { BaseContract } from '@fadroma/ops'
class AContract extends Contract {}
const contract = new AContract()
```
#### Fadroma 23:
In Fadroma 23, state will be moved out of `BaseContract`
and into individual, smaller domain objects
(`Source`, `Artifact`, `Template`, `Instance`, `Client`).

Inheriting from `BaseContract` will remain a convenient place
to define baseline contract parameters.

</td></tr>


<tr><td width="50%" valign="top">

### **`Source`**

Represents the source code of a smart contract.

</td><td width="50%">

#### Fadroma 22.01:
This entity is new to Fadroma 23.
In Fadroma 22.01, its role is served by `Contract`/`BaseContract`.
#### Fadroma 23:
```typescript
contract.source = new LocalSource.Crate(__dirname)
contract.source = new LocalSource.Workspace(__dirname, 'a-contract')
contract.source = new RemoteSource.Crate('https://foo/bar.git')
contract.source = new RemoteSource.Workspace('ssh://git@foo/bar.git', 'a-contract')
```

</td></tr>


<tr><td width="50%" valign="top">

### [**`Builder`**](./Build.ts)

Calls the compiler on a `Contract`,
setting its `artifact` field.

`New in Fadroma 23` Calls the compiler on a `Source`,
producing an `Artifact`.

</td><td width="50%">

#### Fadroma 22.01:
```typescript
import { Builder } from '@fadroma/ops'
const builder  = new Builder(contract)
const artifact = await builder.build()
```
#### Fadroma 23:
```typescript
contract.artifact = await new RawBuilder().build(contract.source)
contract.artifact = await new DockerizedBuilder().build(contract.source)
```

</td></tr>


<tr><td width="50%" valign="top">

### **`Artifact`**

Represents a WASM blob compiled from
the source code of a smart contract.

</td><td width="50%">

#### Fadroma 22.01:
In 22.01, `artifact` is a string field of `Contract`.
#### Fadroma 23:
```typescript
contract.artifact = new LocalArtifact('/path/to/blob.wasm', checksum)
contract.artifact = new RemoteArtifact('https://path/to/blob.wasm', checksum)
```

</td></tr>

<tr><td width="50%" valign="top">

### **`Chain`**

Represents an existing blockchain.

</td><td width="50%">

```typescript
// TODO
import Fadroma from '@hackbg/fadroma'
const chain = await Fadroma.connect()
```

</td></tr>


<tr><td width="50%" valign="top">

### **`Agent`**

Represents a controllable identity on a chain.

</td><td width="50%">

```typescript
const agent = await chain.getAgent()
```

</td></tr>


<tr><td width="50%" valign="top">

### [**`Uploader`**](./Upload.ts)

Uploads a `Contract` to a `Chain`,
setting its `codeId` field.

TODO: Uploads an `Artifact` to a `Chain`,
producing a `Template`.

</td><td width="50%">

```typescript
import { Uploader, Chain, Agent } from '@fadroma/ops'
const chain = await Chain.init() // TODO
const agent = await chain.getAgent()
const uploader = new Uploader(contract)
const artifact = uploader.upload(chain, agent)
```

```typescript
// TODO:
contract.template = await new Uploader(agent).upload(contract.artifact)
```

</td></tr>


<tr><td width="50%" valign="top">

### **`Instance`**

TODO. For now `Contract` serves the role of this class.

</td><td width="50%">

</td></tr>


<tr><td width="50%" valign="top">

### [**`Deploy`**](./Deploy.ts)

</td><td width="50%">

</td></tr>


<tr><td width="50%" valign="top">

### [**`Init`**](./Init.ts)

</td><td width="50%">

</td></tr>


<tr><td width="50%" valign="top">

### [**`Client`**](./Client.ts)

</td><td width="50%">

</td></tr>

</table>

</div>
