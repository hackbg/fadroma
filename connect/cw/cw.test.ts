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
  const sendFee   = new Token.Fee( "1000000", "uknow")
  const uploadFee = new Token.Fee("10000000", "uknow")
  const initFee   = new Token.Fee("10000000", "uknow")
  // Just a devnet with a couple of genesis users.
  const devnet = await new Devnets.Container({
    platform: 'okp4_5.0',
    genesisAccounts: { Alice: "123456789000", Bob: "987654321000", }
  })
  // Get a couple of accounts from the devnet.
  // This creates and launches the devnet in
  // order to be able to access the wallets.
  const [alice, bob] = await Promise.all([
    devnet.authenticate('Alice'),
    devnet.authenticate('Bob'),
  ])
  // Query block height
  await alice.height
  // Query balance in default native token
  equal(await alice.balance, '123455789000')
  equal(await bob.balance,   '987654321000')
  // Permissionsless: anyone can authenticate with their public key
  const guest = new CW.OKP4.Agent({ devnet }).authenticate({ mnemonic })
  // Starting out with zero balance
  equal(await guest.balance, '0')
  // Which may be topped up by existing users
  await alice.send(guest, [new Token.Coin("1", "uknow")], { sendFee })
  equal(await guest.balance, '1')
  await bob.send(guest, [new Token.Coin("10", "uknow")], { sendFee })
  equal(await guest.balance, '11')
  // User with balance may upload contract code
  const uploaded = await alice.upload(fixture('fadroma-example-cw-null@HEAD.wasm'))
  // Which is immediately queryable by other users
  equal(await bob.getCodeHashOfCodeId(uploaded.codeId), uploaded.codeHash)
  // Who can create instances of the uploaded contract code
  const label = 'my-contract-label'
  const initMsg = null as any // actually a valid init message
  const instance = await bob.instantiate(uploaded, { label, initMsg, initFee })
  // Which are immediately visible to all
  equal(await guest.getCodeHashOfAddress(instance.address), uploaded.codeHash)
  // And can execute transactions for users
  const txResult = await alice.execute(instance, null as any)
  console.info('txResult:', txResult)
  // FIXME: Execute query (oops, empty string is not valid json)
  //const qResponse = await alice.query(instance, null as any) 
  //console.log({qResponse})

  //@ts-ignore
  const signed = await guest.signer!.signAmino("", { test: 1 })
}

export async function testCWOKP4 () {
  const agent = new CW.Agent()
  new CW.OKP4.Cognitarium({}, agent)
  new CW.OKP4.Objectarium({}, agent)
  new CW.OKP4.LawStone({}, agent)
  CW.OKP4.testnet()
}
