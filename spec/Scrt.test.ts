import assert from 'node:assert'
import * as Scrt from '@fadroma/scrt'
import { Agent, ChainId, Address } from '@fadroma/agent'

import './Scrt.spec.ts.md'

const SecretJS = (Scrt.SecretJS as any).default
const joinWith = (sep: string, ...strings: string[]) => strings.join(sep)
let chain: any // for mocking
let agent: Agent

const mnemonic = 'define abandon palace resource estate elevator relief stock order pool knock myth brush element immense task rapid habit angry tiny foil prosper water news'

;(async () => {

  await testScrtDevnet()

  await testScrtFees()

  await testScrtBatches()

  await testScrtPermits()

  await testScrtConsole()

})()

async function testScrtDevnet () {

  chain = {
    SecretJS,
    getApi: () => ({}),
    isDevnet: true,
    devnet: {
      start: () => Promise.resolve(),
      getAccount: ()=>Promise.resolve({ mnemonic } as any)
    } as any,
  }

  assert.equal(
    mnemonic,
    (await new Scrt.Agent({
      name:     'genesis',
      mnemonic: 'if name is passed mnemonic is ignored',
      chain
    }).ready).mnemonic,
    joinWith(' ',
      'the "name" constructor property of ScrtAgent can be used',
      'to get a devnet genesis account')
  )

}

async function testScrtFees () {

  assert.ok(

    await new Scrt.Agent({
      fees: false as any,
      chain: {
        SecretJS,
        getApi: () => ({}),
        fetchLimits: ()=>Promise.resolve({gas: 'max'}),
        id: 'test',
      } as any,
    }).ready,

    [ 'if fees=false is passed to ScrtAgent, ',
      'fees are fetched from the chain' ].join()

  )

}

async function testScrtBatches () {

  const someBatch = () => new Scrt.Agent({
    chain: {
      SecretJS,
      getApi: () => ({
        encryptionUtils: {
          encrypt: () => Promise.resolve(new Uint8Array())
        },
        query: { auth: { account: () => Promise.resolve({
          account: { account_number: 0, sequence: 0 }
        }) } },
        tx: {
          broadcast: () => Promise.resolve({ code: 0 }),
          simulate: () => Promise.resolve({ code: 0 })
        }
      })
    } as any
  }).batch(async (batch)=>{
    assert(batch instanceof Scrt.Batch)
    await batch.instantiate({ codeId: 'id', codeHash: 'hash', msg: {} } as any)
    await batch.execute({ address: 'addr', codeHash: 'hash', msg: {} } as any, {})
  })

  assert.ok(
    await someBatch().save('test'),
    [ '"saving" a batch outputs it to the console in the format ',
    , 'of a multisig message' ].join()
  )
  assert.ok(
    await someBatch().submit('test'),
    'submitting a batch',
  )
  assert(
    someBatch() instanceof Scrt.Batch,
    'ScrtBatch is returned'
  )

}

async function testScrtPermits () {

  Scrt.PermitSigner.createSignDoc('chain-id', {foo:'bar'})

  new Scrt.PermitSignerKeplr('chain-id', 'address', { signAmino })
    .sign({ permit_name: 'permit_name', allowed_tokens: [], permissions: [] })

  async function signAmino (
    chain_id: ChainId,
    address:  Address,
    signDoc:  Scrt.SignDoc,
    options: { preferNoSetFee: boolean, preferNoSetMemo: boolean }
  ) {
    return {
      signature: {
        pub_key: 'pub_key' as any, signature: 'signature'
      },
      params: {
        permit_name: 'permit_name', allowed_tokens: [], chain_id: 'chain-id', permissions: []
      }
    }
  }

}

async function testScrtConsole () {

  new Scrt.Console()
    .noMemos()
    .ignoringMnemonic()
    .defaultGas([])
    .submittingBatchFailed(new Error())

}
