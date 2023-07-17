<div align="center">

# Fadroma Agent for generic CosmWasm

[![](https://img.shields.io/npm/v/@fadroma/scrt?color=%2365b34c&label=%40fadroma%2Fscrt&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/scrt)

This package lets you use Fadroma Agent on CosmWasm-enabled networks.

See https://fadroma.tech for more info.

</div>

## Supported networks

### [OKP4](https://okp4.network/)

OKP4 is an Open Knowledge Platform For decentralized ontologies.

```typescript
import { OKP4 } from '@fadroma/cw'

// select chain
const okp4 = OKP4.testnet()

// authenticate
const okp4Agent = await okp4.getAgent({ mnemonic: '...' }).ready

// select cognitarium
const cognitarium = okp4.cognitarium('okp41...', okpAgent)

// insert triples
await cognitarium.insert('turtle', `
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  @prefix dc: <http://purl.org/dc/elements/1.1/> .
  @prefix ex: <http://example.org/stuff/1.0/> .

  <http://www.w3.org/TR/rdf-syntax-grammar>
    dc:title "RDF/XML Syntax Specification (Revised)" ;
    ex:editor [
      ex:fullname "Dave Beckett";
      ex:homePage <http://purl.org/net/dajobe/>
    ] .
`)

// query triples
const result = await cognitarium.select(1, [
  /* prefixes */
], [
  /* selected variables */
], [
  /* where clauses */
])

// select objectarium
const objectarium = okp4.objectarium('okp41...', okpAgent)

// select lawstone
const lawStone = okp4.lawStone('okp41...', okpAgent)
```

### Others

There is basic support for all chains accessible via `@cosmjs/stargate`.
However, chain-specific features may not be directly available.

```typescript
```
