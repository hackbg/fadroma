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
    genesisAccounts: { Alice: "123456789000", Bob: "987654321000", }
  })
  const [alice, bob] = await Promise.all([
    devnet.authenticate('Alice'),
    devnet.authenticate('Bob'),
  ])
  await alice.height
  equal(await alice.balance, '123455789000')
  equal(await bob.balance,   '987654321000')

  const uploaded = await alice.upload(fixture('fadroma-example-cw-null@HEAD.wasm'))
  const instance = await bob.instantiate(uploaded, {
    label: 'test',
    initMsg: null as any,
    initFee: new Token.Fee("10000000", "uknow")
  })

  const agent = new CW.Agent({
    devnet, coinType: 118, bech32Prefix: 'okp4', hdAccountIndex: 0
  }).authenticate({
    mnemonic
  })
  //@ts-ignore
  const signed = await agent.signer!.signAmino("", { test: 1 })
}

export async function testCWOKP4 () {
  const agent = new CW.Agent()
  new CW.OKP4.Cognitarium({}, agent)
  new CW.OKP4.Objectarium({}, agent)
  new CW.OKP4.LawStone({}, agent)
  CW.OKP4.testnet()
}
