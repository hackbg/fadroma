import { Mode, Token, Test } from '@fadroma/agent'
import * as CW from '.'
import * as Devnets from '../../ops/devnets'
import { fixture } from '../../fixtures/fixtures'
import { throws, rejects, deepEqual, equal } from 'node:assert'
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['chain',  testCWChain],
])

export async function testCWChain () {
  const { devnet, alice, bob, guest } = await Test.testChainSupport(
    CW.OKP4.Agent,
    Devnets.OKP4Container,
    'v5.0',
    'uknow',
    fixture('cw-null.wasm')
  )

  new CW.OKP4.Cognitarium({}, alice)
  new CW.OKP4.Objectarium({}, bob)
  new CW.OKP4.LawStone({}, guest)
  //CW.OKP4.testnet()
}
