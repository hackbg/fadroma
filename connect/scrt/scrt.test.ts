import assert from 'node:assert'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as SecretJS from '@hackbg/secretjs-esm'
import { Devnet } from '@hackbg/fadroma'
import * as Scrt from '@fadroma/scrt'
import { Agent, ChainId, Address, randomBech32 } from '@fadroma/agent'
import * as Mocknet from './scrt-mocknet'

//@ts-ignore
export const packageRoot = dirname(resolve(fileURLToPath(import.meta.url)))

const joinWith = (sep: string, ...strings: string[]) => strings.join(sep)
let chain: any // for mocking
let agent: Agent
const mnemonic = 'define abandon palace resource estate elevator relief stock order pool knock myth brush element immense task rapid habit angry tiny foil prosper water news'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['chain',   testScrtChain],
  ['permits', testScrtPermits],
  ['console', testScrtConsole],
  ['mocknet', testScrtMocknet],
])

async function testScrtChain () {
  Scrt.mainnet()
  const devnet = await new Devnet({ platform: 'scrt_1.9' }).create()
  const chain = await (devnet.getChain() as Scrt.Chain).ready
  assert(await chain.api instanceof SecretJS.SecretNetworkClient)
  assert.ok(await chain.block)
  assert.ok(await chain.height)
  assert.ok(await chain.fetchLimits())
  const alice = await chain.getAgent({ name: 'Alice' }).ready
  assert.ok(alice.address)
  assert.ok((alice as Scrt.Agent).api instanceof SecretJS.SecretNetworkClient)
  const bob = await chain.getAgent({ name: 'Bob' }).ready
  //assert(alice.wallet instanceof SecretJS.Wallet)
  //assert(alice.encryptionUtils instanceof SecretJS.EncryptionUtilsImpl)
  await chain.getBalance(chain.defaultDenom, alice.address!)
  await alice.getBalance(chain.defaultDenom, alice.address!)
  await alice.balance
  await alice.getBalance(chain.defaultDenom, bob.address!)
  await alice.upload({}, {})
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

async function testScrtPermits () {

  Scrt.PermitSigner.createSignDoc('chain-id', {foo:'bar'})

  const permitSigner = new Scrt.PermitSignerKeplr(
    'chain-id',
    'address',
    {
      signAmino: async function signAmino (
        chain_id: ChainId,
        address:  Address,
        signDoc:  Scrt.SignDoc,
        options: { preferNoSetFee: boolean, preferNoSetMemo: boolean }
      ) {
        return {
          signature: {
            pub_key: 'pub_key' as any,
            signature: 'signature'
          },
          params: {
            permit_name: 'permit_name',
            allowed_tokens: [],
            chain_id: 'chain-id',
            permissions: []
          }
        }
      }
    }
  )

  assert.ok(permitSigner.sign({
    permit_name: 'permit_name',
    allowed_tokens: [],
    permissions: []
  }))

}

async function testScrtConsole () {

  new Scrt.Console()
    .noMemos()
    .ignoringMnemonic()
    .defaultGas([])
    .submittingBatchFailed(new Error())

}

export async function testScrtMocknet () {
  new Mocknet.Console('test message').log('...').trace('...').debug('...')
  // **Base64 I/O:** Fields that are of type `Binary` (query responses and the `data` field of handle
  // responses) are returned by the contract as Base64-encoded strings
  // If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.
  // These functions are used by the mocknet code to encode/decode the base64.
  assert.equal(Mocknet.b64toUtf8('IkVjaG8i'), '"Echo"')
  assert.equal(Mocknet.utf8toB64('"Echo"'), 'IkVjaG8i')
  let key:   string
  let value: string
  let data:  string
}
