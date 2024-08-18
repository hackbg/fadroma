<div align="center">

# Fadroma Agent for Secret Network

[![](https://img.shields.io/npm/v/@fadroma/scrt?color=%2365b34c&label=%40fadroma%2Fscrt&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/scrt)

This package lets you use Fadroma Agent on Secret Network using
the SecretJS client library.

See https://fadroma.tech for more info.

</div>

---

## Quick start

```typescript
import * as Scrt from '@fadroma/scrt'

// connect to mainnet:
const scrt = Scrt.mainnet()
const scrt = Scrt.mainnet({ url })
const scrt = Scrt.mainnet({ identity: { mnemonic } })
const scrt = Scrt.mainnet({ identity: { encryptionUtils } })

// connect to testnet:
const scrt = Scrt.testnet(/* same as above */)

// connect to custom endpoint:
const scrt = new Scrt.Connection({ chainId, url, identity })

// upload code:
const uploaded = await scrt.upload('./path/to.wasm')
const uploaded = await scrt.upload('file:///path/to.wasm')
const uploaded = await scrt.upload('https:///path/to.wasm')
const uploaded = await scrt.upload(new Uint8Array([/*raw waasm*/]))

// instantiate code:
const contract = await scrt.instantiate(codeId, { label, initMsg })
const contract = await scrt.instantiate(uploaded, { label, initMsg })
const contract = await scrt.instantiate({ codeId }, { label, initMsg })

// obtain handle to existing contract:
const contract = scrt.getContract('address')
const contract = scrt.getContract({ address })

// call contract methods:
const response = await contract.query(message)
const resultTx = await contract.execute(message)
```
