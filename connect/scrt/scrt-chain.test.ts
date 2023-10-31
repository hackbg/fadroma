import assert from 'node:assert'
import * as Scrt from './scrt'
import { Devnet } from '../../ops/devnet'
import { Mode } from '@fadroma/agent'

export async function testScrtChain () {
  Scrt.mainnet()
  Scrt.testnet()
  const chain = new Scrt.Agent({ chainId: 'scrt' })
  assert(chain.api instanceof Scrt.SecretJS.SecretNetworkClient)
  const agent = await chain.authenticate({})
  assert(agent.api instanceof Scrt.SecretJS.SecretNetworkClient)
}

export async function testScrtDevnet () {
  const chain = Scrt.devnet({ platform: 'scrt_1.9' })
  assert.ok(await chain.devnet.start())
  assert.ok(await chain.block)
  assert.ok(await chain.height)
  assert.ok(await chain.fetchLimits())
  const alice = await chain.authenticate({ name: 'Alice' })
  const bob   = await chain.authenticate({ name: 'Bob' })
  assert.ok(alice.address)
  assert.ok((alice as Scrt.Agent).api instanceof Scrt.SecretJS.SecretNetworkClient)
  //assert(alice.wallet instanceof SecretJS.Wallet)
  //assert(alice.encryptionUtils instanceof SecretJS.EncryptionUtilsImpl)
  await chain.getBalance(alice.address, chain.defaultDenom)
  await alice.getBalance(alice.address, chain.defaultDenom)
  await alice.balance
  await alice.getBalance(bob.address, chain.defaultDenom)
  await alice.upload({}, {})
}

export async function testScrtBatch () {
  const alice = await Scrt.devnet({ platform: 'scrt_1.9' }).authenticate({ name: 'Alice' })
  const batch = () => alice.batch(async (batch: Batch)=>{
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
