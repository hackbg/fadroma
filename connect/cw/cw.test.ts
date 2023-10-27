import * as assert from 'node:assert'
import { Devnet, CW } from '@hackbg/fadroma'
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['signer', testCWSigner],
  ['chain',  testCWChain],
  ['okp4',   testCWOKP4]
])

const mnemonic = [
  'define abandon palace resource estate elevator',
  'relief stock order pool knock myth',
  'brush element immense task rapid habit',
  'angry tiny foil prosper water news'
].join(' ')

export async function testCWSigner () {
  const devnet = await new Devnet({ platform: 'okp4_5.0' }).create()
  const chain = devnet.getChain()
  const agent = await chain.getAgent({ mnemonic }).ready as CW.OKP4.Agent
  //@ts-ignore
  const signed = await agent.signer!.signAmino("", { test: 1 })
}

export async function testCWChain () {
  // Throws because devnet instance is not passed:
  assert.throws(()=>new CW.Chain({ mode: CW.Chain.Mode.Devnet }).ready)

  const devnet = await new Devnet({ platform: 'okp4_5.0' }).create()
  const chain = await (devnet.getChain() as CW.OKP4.Chain).ready
  const alice = await chain.getAgent({ name: 'Alice' }).ready as CW.OKP4.Agent
  const bob = await chain.getAgent({ name: 'Bob' }).ready as CW.OKP4.Agent

  assert.throws(()=>alice.mnemonic)
  assert.throws(()=>alice.mnemonic = undefined)

  // FIXME: getBalance signatures (getBalanceIn?)
  assert.rejects(()=>chain.getBalance(CW.OKP4.Chain.defaultDenom, undefined as any))
  await chain.getBalance(CW.OKP4.Chain.defaultDenom, alice.address!)
  await alice.getBalance()
  await alice.getBalance(CW.OKP4.Chain.defaultDenom)
  await alice.getBalance(CW.OKP4.Chain.defaultDenom, alice.address!)
  await alice.getBalance(CW.OKP4.Chain.defaultDenom, bob.address!)

  assert.throws(()=>alice.mnemonic)
  assert.throws(()=>alice.mnemonic = undefined)
}

export async function testCWOKP4 () {
  const agent = new CW.Agent()
  new CW.OKP4.Cognitarium({}, agent)
  new CW.OKP4.Objectarium({}, agent)
  new CW.OKP4.LawStone({}, agent)
  CW.OKP4.testnet()
}
