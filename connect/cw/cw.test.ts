import { throws, rejects, deepEqual } from 'node:assert'

import * as Devnets from '../../ops/devnets'
import * as CW from '.'
import { Mode, Token } from '@fadroma/agent'
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['chain',  testCWChain],
  ['devnet', testCWDevnet],
  ['okp4',   testCWOKP4],
  ['signer', testCWSigner],
])

export async function testCWChain () {
  rejects(()=>new CW.Agent().authenticate())
  rejects(()=>new CW.Agent().authenticate({}))
  rejects(()=>new CW.Agent().authenticate({ signer: {}, mnemonic: 'x' }))
}

export async function testCWDevnet () {
  const devnet = await new Devnets.Container({
    platform: 'okp4_5.0',
    genesisAccounts: {
      Alice: 123456789,
      Bob: 987654321,
    }
  })
  const [alice, bob] = await Promise.all([
    devnet.authenticate('Alice'),
    devnet.authenticate('Bob'),
  ])
  deepEqual(await alice.balance, {
    uknow: 123456789
  })
  deepEqual(await bob.balance, {
    uknow: 987654321
  })
}

export async function testCWOKP4 () {
  const agent = new CW.Agent()
  new CW.OKP4.Cognitarium({}, agent)
  new CW.OKP4.Objectarium({}, agent)
  new CW.OKP4.LawStone({}, agent)
  CW.OKP4.testnet()
}

export async function testCWSigner () {
  const devnet = await new Devnets.Container({ platform: 'okp4_5.0' })
  // FIXME call these automatically
  const chain = new CW.Agent({ devnet, coinType: 118, bech32Prefix: 'okp4', hdAccountIndex: 0 })
  const agent = await chain.authenticate({ mnemonic: [
    'define abandon palace resource estate elevator',
    'relief stock order pool knock myth',
    'brush element immense task rapid habit',
    'angry tiny foil prosper water news'
  ].join(' ') })
  //@ts-ignore
  const signed = await agent.signer!.signAmino("", { test: 1 })
}
