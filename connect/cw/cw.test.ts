import { Token, Tester } from '@fadroma/agent'
import * as CW from '.'
import { Devnets } from '@hackbg/fadroma'
import { fixture } from '@fadroma/fixtures'
import { throws, rejects, deepEqual, equal } from 'node:assert'
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['chain', testCWChain],
])

export async function testCWChain () {
  const { backend, alice, bob, guest } = await Tester.testChainSupport(
    CW.OKP4.Connection,
    Devnets.OKP4Container,
    'v5.0',
    'uknow',
    fixture('cw-null.wasm')
  )

  new CW.OKP4.Connection({ signer: {}, mnemonic: 'x' } as any)
  throws(()=>new CW.OKP4.Connection({ address: 'foo', mnemonic: [
    'define abandon palace resource estate elevator',
    'relief stock order pool knock myth',
    'brush element immense task rapid habit',
    'angry tiny foil prosper water news'
  ] } as any))

  new CW.OKP4.Cognitarium({ connection: alice }) 
  new CW.OKP4.Objectarium({ connection: bob })
  new CW.OKP4.LawStone({ connection: guest })
  //CW.OKP4.testnet()
}
