import { Devnet, CW } from '@hackbg/fadroma'

import testEntrypoint from './testSelector'
export default testEntrypoint(import.meta.url, {
  'docs':   testCWDocs,
  'signer': testCWSigner
})

export async function testCWDocs () {
  //@ts-ignore
  await import('./CW.spec.ts.md')
}

export async function testCWSigner () {

  const devnet = await new Devnet({ platform: 'okp4_5.0' }).create()

  const chain = devnet.getChain()

  const mnemonic = [
    'define abandon palace resource estate elevator',
    'relief stock order pool knock myth',
    'brush element immense task rapid habit',
    'angry tiny foil prosper water news'
  ].join(' ')

  const agent = await chain.getAgent({ mnemonic }).ready as CW.OKP4.Agent

  const signed = await agent.signer.signAmino("", { test: 1 })

}
