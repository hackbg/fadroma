# [OKP4](https://okp4.network/) support in [Fadroma](https://fadroma.tech)

OKP4 is an Open Knowledge Platform For decentralized ontologies.

```typescript
import { OKP4 } from '@fadroma/cw'

// select chain and authenticate
const okp4 = await OKP4.testnet().getAgent({ mnemonic: '...' }).ready

// deploy cognitarium
const { address: cognitariumAddress } = await okp4.instantiate(OKP4.Cognitarium.init())

// select cognitarium
const cognitarium = okp4.cognitarium(cognitariumAddress, okpAgent)

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

// deploy objectarium
const { address: objectariumAddress } = await okp4.instantiate(OKP4.Objectarium.init('fadroma'))

// select objectarium
const objectarium = okp4.objectarium(objectariumAddress, okpAgent)

// use objectarium
const { id: objectariumDataId } = await objectarium.store(false, 'somedatainbase64')
await objectarium.pin(id)
await objectarium.unpin(id)
await objectarium.forget(id)

// deploy law stone
const { address: lawStoneAddress } = await okp4.instantiate(OKP4.LawStone.init('okp1...', `
   admin_addr('${okp4.address}').
`))

// select law stone
const lawStone = okp4.lawStone(lawStoneAddress, okpAgent)

// use law stone
await lawStone.ask(`admin_addr(${okp4.address})`)
await lawStone.break()
```
