import { Mode, Token, Test } from '@fadroma/agent'
import * as CW from '.'
import { Devnets } from '@hackbg/fadroma'
import { fixture } from '@fadroma/fixtures'
import { throws, rejects, deepEqual, equal } from 'node:assert'
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['chain', testCWChain],
])

export async function testCWChain () {
  const { devnet, alice, bob, guest } = await Test.testChainSupport(
    CW.OKP4.Agent,
    Devnets.OKP4Container,
    'v5.0',
    'uknow',
    fixture('cw-null.wasm')
  )

  new CW.OKP4.Agent({ signer: {}, mnemonic: 'x' } as any)
  throws(()=>new CW.OKP4.Agent({ address: 'foo', mnemonic: [
    'define abandon palace resource estate elevator',
    'relief stock order pool knock myth',
    'brush element immense task rapid habit',
    'angry tiny foil prosper water news'
  ] } as any))

  new CW.OKP4.Cognitarium({}, alice)
  new CW.OKP4.Objectarium({}, bob)
  new CW.OKP4.LawStone({}, guest)
  //CW.OKP4.testnet()
}
