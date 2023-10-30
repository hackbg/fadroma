import assert from 'node:assert'
import * as Scrt from './scrt'
import { Devnet } from '../../fadroma'

export async function testScrtChain () {
  Scrt.mainnet()
  Scrt.testnet()

  const chain = new Scrt.Chain({ id: 'mocknet', mode: Scrt.Chain.Mode.Mocknet })
  await chain.ready
  assert(await chain.api instanceof Scrt.SecretJS.SecretNetworkClient)

  const agent = chain.getAgent({})
  console.log({agent})
  await agent.ready
  assert(await agent.api instanceof Scrt.SecretJS.SecretNetworkClient)
}

export async function testScrtDevnet () {
  const devnet = await new Devnet({ platform: 'scrt_1.9' }).create()
  const chain = await (devnet.getChain() as Scrt.Chain).ready
  assert.ok(await chain.block)
  assert.ok(await chain.height)
  assert.ok(await chain.fetchLimits())
  const alice = await chain.getAgent({ name: 'Alice' }).ready
  const bob = await chain.getAgent({ name: 'Bob' }).ready
  assert.ok(alice.address)
  assert.ok((alice as Scrt.Agent).api instanceof Scrt.SecretJS.SecretNetworkClient)
  //assert(alice.wallet instanceof SecretJS.Wallet)
  //assert(alice.encryptionUtils instanceof SecretJS.EncryptionUtilsImpl)
  await chain.getBalance(chain.defaultDenom, alice.address!)
  await alice.getBalance(chain.defaultDenom, alice.address!)
  await alice.balance
  await alice.getBalance(chain.defaultDenom, bob.address!)
  await alice.upload({}, {})
}

export async function testScrtBatch () {
  const devnet = await new Devnet({ platform: 'scrt_1.9' }).create()
  const chain = await (devnet.getChain() as Scrt.Chain).ready
  const alice = await chain.getAgent({ name: 'Alice' }).ready
  const batch = () => alice.batch(async (batch)=>{
    assert(batch instanceof Scrt.Batch)
    await batch.instantiate('id', {
      label:    'label',
      initMsg:  {},
      codeHash: 'hash',
    } as any)
    await batch.execute('addr', {
      address:  'addr',
      codeHash: 'hash',
      message:  {}
    } as any, {})
  })
  assert(batch() instanceof Scrt.Batch, 'ScrtBatch is returned')
  assert.ok(await batch().save('test'))
  assert.ok(await batch().submit('test'))
}
