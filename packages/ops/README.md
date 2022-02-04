<div align="center">
<table><tr><td valign="middle" style="vertical-align:bottom">

[<img src="https://github.com/hackbg/fadroma/raw/22.01/doc/logo.svg" width="300">](https://fadroma.tech)

</td><td valign="center">

# Fadroma Ops
Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

</td></tr></table>

This crate models the lifecycle of a smart contract,
as illustrated below.

![](./.pix/Figure_1.png)

<table>
<tr><td width="50%" valign="top">

### [**`Contract`**](./Contract.ts)

Represents a smart contract.

</td><td width="50%">

```typescript
import { Contract } from '@fadroma/ops'
class AContract extends Contract {}
const contract = new AContract()
```

</td></tr>


<tr><td width="50%" valign="top">

### **`Source`**

Represents the source code of a smart contract.

**TODO** For now `BaseContract` serves the function of this class.

</td><td width="50%">

```typescript
// TODO
contract.source = new Source(__dirname, contract)
```

</td></tr>


<tr><td width="50%" valign="top">

### [**`Builder`**](./Build.ts)

Calls the compiler on a `Contract`,
setting its `artifact` field.

TODO: Calls the compiler on a `Source`,
producing an `Artifact`.

</td><td width="50%">

```typescript
import { Builder } from '@fadroma/ops'
const builder  = new Builder(contract)
const artifact = await builder.build()
```

```
// TODO:
contract.artifact = await new DockerBuilder().build(contract.source)
```

</td></tr>


<tr><td width="50%" valign="top">

### **`Artifact`**

Represents a WASM blob compiled from
the source code of a smart contract..

**TODO** For now `artifact` is a string field of `Contract`.

</td><td width="50%">

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
// TODO: contract.template = await new Uploader(agent).upload(contract.artifact)
```

</td></tr>


<tr><td width="50%" valign="top">

### **`Instance`**

TODO. For now `Contract` serves the function of this class.

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
