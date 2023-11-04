import { throws, rejects, deepEqual, equal } from 'node:assert'

import * as Devnets from '../../ops/devnets'
import { fixture } from '../../fixtures/fixtures'
import * as CW from '.'
import { Mode, Token } from '@fadroma/agent'
import { Suite } from '@hackbg/ensuite'

const mnemonic = [
  'define abandon palace resource estate elevator',
  'relief stock order pool knock myth',
  'brush element immense task rapid habit',
  'angry tiny foil prosper water news'
].join(' ')

export default new Suite([
  ['chain',  testCWChain],
  ['devnet', testCWDevnet],
  ['okp4',   testCWOKP4],
  ['signer', testCWSigner],
])

export async function testCWChain () {
  throws(()=>new CW.Agent().authenticate())
  throws(()=>new CW.Agent().authenticate({}))
  throws(()=>new CW.Agent().authenticate({
    signer: {} as any,
    mnemonic
  }))
}

export async function testCWDevnet () {
  const devnet = await new Devnets.Container({
    platform: 'okp4_5.0',
    genesisAccounts: { Alice: 123456789, Bob: 987654321, }
  })
  const [alice, bob] = await Promise.all([
    devnet.authenticate('Alice'),
    devnet.authenticate('Bob'),
  ])
  await alice.height
  equal(await alice.balance, '122456789')
  equal(await bob.balance,   '987654321')

  const result = await alice.upload(fixture('fadroma-example-echo@HEAD.wasm'))
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
  await devnet.start()
  const agent = new CW.Agent({
    devnet, coinType: 118, bech32Prefix: 'okp4', hdAccountIndex: 0
  }).authenticate({
    mnemonic
  })
  //@ts-ignore
  const signed = await agent.signer!.signAmino("", { test: 1 })
}
