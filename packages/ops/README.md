<div align="center">
<table><tr><td valign="middle" style="vertical-align:bottom">

[<img style="vertical-align:text-top" src="https://github.com/hackbg/fadroma/raw/22.01/doc/logo.svg" width="200">](https://fadroma.tech)

</td><td valign="center">

# Fadroma Ops
Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

</td></tr></table>

This crate models the lifecycle of a smart contract,
as illustrated below.

![](./.pix/Figure_1.png)

<table>
<tr><td width="50%">

## [**`Contract`**](./Contract.ts)

</td><td width="50%">

```typescript
class AContract extends Contract {}
```

</td></tr>
<tr><td width="50%">

### **`Source`**

</td><td width="50%">

TODO. For now it's part of `Contract`

</td></tr>
<tr><td width="50%">

### [**`Build`**](./Build.ts)

</td><td width="50%">

```typescript
import { Builder } from '@fadroma/ops'
const contract = new AContract()
const builder  = new Builder(contract)
const artifact = await builder.build()
```

</td></tr>

<tr><td width="50%">

### **`Artifact`**

</td><td width="50%">

TODO. For now it's part of `Contract`

</td></tr>

<tr><td width="50%">

### [**`Upload`**](./Upload.ts)

</td><td width="50%">

```typescript
import { Uploader, Chain, Agent } from '@fadroma/ops'
const chain = await Chain.getCurrent() // TODO
const agent = await chain.getAgent()
const uploader = new Uploader(contract)
const artifact = uploader.upload(chain, agent)
```

</td></tr>

<tr><td width="50%">

### **`Instance`**

</td><td width="50%">

TODO. For now it's part of `Contract`

</td></tr>

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
