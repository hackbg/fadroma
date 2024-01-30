import { ok, throws, rejects, deepEqual, equal } from 'node:assert'
import { Token } from '@fadroma/agent'
import * as Devnet from '@fadroma/devnet'
import { fixture, testConnectionWithBackend } from '@fadroma/fixtures'
import * as CW from './cw'
import { Suite } from '@hackbg/ensuite'

export default new Suite([
  ['chain', testCWChain],
])

export async function testCWChain () {
  new CW.OKP4.Cognitarium({})
  new CW.OKP4.Objectarium({})
  new CW.OKP4.LawStone({})
  new CW.OKP4.MnemonicIdentity()
  new CW.SignerIdentity({ signer: {} as any })

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
  const { backend, alice, bob, guest } = await testConnectionWithBackend({
    Connection:      CW.OKP4.Connection,
    Identity:        CW.OKP4.MnemonicIdentity,
    Backend:         Devnet.DevnetContainer,
    container:       Devnet.Platform.OKP4.versions['6.0.0'].container,
    platformName:    'okp4',
    platformVersion: '6.0',
    gasToken:        'uknow',
    code:            fixture('cw-null.wasm')
  })
  //new CW.OKP4.Connection({ signer: {}, mnemonic: 'x' } as any)
  //throws(()=>new CW.OKP4.Connection({ address: 'foo', mnemonic: [
    //'define abandon palace resource estate elevator',
    //'relief stock order pool knock myth',
    //'brush element immense task rapid habit',
    //'angry tiny foil prosper water news'
  //] } as any))
  //CW.OKP4.testnet()
}
