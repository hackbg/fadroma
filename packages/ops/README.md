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
<tr><td width="50%">

### [**`Contract`**](./Contract.ts)

</td><td width="50%">

```typescript
import { Contract } from '@fadroma/ops'
class AContract extends Contract {}
const contract = new AContract()
```

</td></tr>
<tr><td width="50%">

### **`Source`**

</td><td width="50%">

Represents the source code of a smart contract.

**TODO** For now `Contract` serves the function of this class.

```typescript
//TODO: contract.source = new Source(__dirname, 'contract)
```

</td></tr>
<tr><td width="50%">

### [**`Build`**](./Build.ts)

</td><td width="50%">

```typescript
import { Builder } from '@fadroma/ops'
const builder  = new Builder(contract)
const artifact = await builder.build()
// TODO: contract.artifact = await new DockerBuilder().build(contract.source)
```

</td></tr>

<tr><td width="50%">

### **`Artifact`**

</td><td width="50%"><center>

**TODO** For now `artifact` a string field of `Contract`.

<center></td></tr>

<tr><td width="50%">

### [**`Upload`**](./Upload.ts)

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

<tr><td width="50%">

### **`Instance`**

</td><td width="50%"><center>

TODO. For now `Contract` serves the function of this class.

</coenter></td></tr>

<tr><td width="50%">

### [**`Deploy`**](./Deploy.ts)

</td><td width="50%">

</td></tr>

<tr><td width="50%">

### [**`Init`**](./Init.ts)

</td><td width="50%">

</td></tr>

<tr><td width="50%">

### [**`Client`**](./Client.ts)

</td><td width="50%">

</td></tr>

</table>

</div>
