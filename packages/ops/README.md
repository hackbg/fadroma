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

### [**`Contract`**](./Contract.ts)

</td><td width="50%">

**In Fadroma 22.01:** Represents a smart contract.
```typescript
import { BaseContract } from '@fadroma/ops'
abstract class AContract extends BaseContract {
  workspace = __dirname
  crate     = 'a-contract'
  static v1 = class AContract_v1 extends AContract {
    get version () { return 'v1' }
    name = 'AContract[v1]'
  }
  static v2 = class AContract_v2 extends AContract {
    get version () { return 'v2' }
    name = 'AContract[v2]'
  }
}
const contract = new AContract['v1']()
```
**In Fadroma 23,** state and logic will be moved
out of `BaseContract` and into domain objects
(`Source`, `Artifact`, `Template`, `Instance`, `Client`).

Inheriting from `BaseContract` will remain a convenient place
to define baseline contract parameters.

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### **`Source`**

</td><td width="50%">

#### Fadroma 22.01:
This entity is new to Fadroma 23.
In Fadroma 22.01, its role is served by `Contract`/`BaseContract`.
#### Fadroma 23:
Represents the source code of a smart contract.
```typescript
import { Source } from '@fadroma/ops'
contract.source = new Source.Local.Crate(__dirname)
contract.source = new Source.Local.Workspace(__dirname, 'a-contract')
contract.source = new Source.Remote.Crate('https://foo/bar.git')
contract.source = new Source.Remote.Workspace('ssh://git@foo/bar.git', 'a-contract')
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### [**`Builder`**](./Build.ts)

</td><td width="50%">

#### Fadroma 22.01:
Calls the compiler on a `Contract`, setting its `artifact` field.
```typescript
import { Builder } from '@fadroma/ops'
const builder  = new Builder(contract)
const artifact = await builder.build()
```
#### Fadroma 23:
Calls the compiler on a `Source`, producing an `Artifact`.
```typescript
import { Builder } from '@fadroma/ops'
contract.artifact = await new Builder.Raw().build(contract.source)
contract.artifact = await new Builder.Dockerized().build(contract.source)
contract.artifact = await new Builder.Remote('ssh://foo@bar').build(contract.source)
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### **`Artifact`**

</td><td width="50%">

#### Fadroma 22.01:
In 22.01, `artifact` is a string field of `Contract`.
#### Fadroma 23:
Represents a WASM blob compiled from
the source code of a smart contract.
```typescript
contract.artifact = new Artifact.Local('/path/to/blob.wasm', checksum)
contract.artifact = new Artifact.Remote('https://path/to/blob.wasm', checksum)
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### [**`Chain`**](./Chain.ts) and [**`Agent`**](./Agent.ts)

</td><td width="50%">

Represent an existing blockchain,
and a controllable identity on it.
#### Fadroma 23:
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

#### Fadroma 22.01:
Uploads a `Contract` to a `Chain`,
setting its `codeId` field.
```typescript
import { Uploader, Chain, Agent } from '@fadroma/ops'
const chain = await Chain.init() // TODO
const agent = await chain.getAgent()
const uploader = new Uploader(contract)
const artifact = uploader.upload(chain, agent)
```
#### Fadroma 23:
Uploads an `Artifact` to a `Chain`, producing a `Template`.
```typescript
contract.template = await new Uploader(agent).upload(contract.artifact)
```

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### **`Template`**

</td><td width="50%">

#### Fadroma 22.01:
New in Fadroma 23. In 22.01, `Contract` serves the role of this class.
#### Fadroma 23:

</td></tr>
<tr></tr>
<tr><td width="50%" valign="top">

### **`Instance`**

</td><td width="50%">

#### Fadroma 22.01:
New in Fadroma 23. In 22.01, `Contract` serves the role of this class.
#### Fadroma 23:

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

### [**`Client`**](./Client.ts)

</td><td width="50%">

#### Fadroma 22.01:
#### Fadroma 23:

</td></tr>

</table>

</div>
