import { ok, throws, rejects, deepEqual, equal } from 'node:assert'
import { Token } from '@fadroma/agent'
import * as Devnets from '@fadroma/devnet'
import { fixture, testConnectionWithBackend } from '@fadroma/fixtures'
import * as CW from './cw'
import { Suite } from '@hackbg/ensuite'

export default new Suite([
  ['chain', testCWChain],
])

export async function testCWChain () {
  new CW.Cognitarium({})
  new CW.Objectarium({})
  new CW.LawStone({})
  new CW.OKP4MnemonicIdentity()
  new CW.CWSignerIdentity({ signer: {} as any })

  throws(()=>CW.encodeSecp256k1Signature(
    new Uint8Array(),
    new Uint8Array()
  ))
  throws(()=>CW.encodeSecp256k1Signature(
    Object.assign(new Uint8Array(33), [0x02, 0x03]),
    new Uint8Array()
  ))
  ok(()=>CW.encodeSecp256k1Signature(
    Object.assign(new Uint8Array(33), [0x02, 0x03]),
    new Uint8Array(64)
  ))
  const { backend, alice, bob, guest } = await testConnectionWithBackend(
    CW.OKP4Connection,
    Devnets.OKP4Container,
    '5.0',
    'uknow',
    fixture('cw-null.wasm')
  )
  //new CW.OKP4.Connection({ signer: {}, mnemonic: 'x' } as any)
  //throws(()=>new CW.OKP4.Connection({ address: 'foo', mnemonic: [
    //'define abandon palace resource estate elevator',
    //'relief stock order pool knock myth',
    //'brush element immense task rapid habit',
    //'angry tiny foil prosper water news'
  //] } as any))
  //CW.OKP4.testnet()
}
