import assert from 'node:assert'
import * as Scrt from '@fadroma/scrt'
import { Agent, ChainId, Address } from '@fadroma/agent'

const SecretJS = (Scrt.SecretJS as any).default
const joinWith = (sep: string, ...strings: string[]) => strings.join(sep)
let chain: any // for mocking
let agent: Agent

/// DEVNET

chain = {
  SecretJS,
  getApi: () => ({}),
  isDevnet: true,
  devnet: {
    start: () => Promise.resolve(),
    getAccount: ()=>Promise.resolve({ mnemonic: 'the genesis account mnemonic' } as any)
  } as any,
}

assert.equal(
  'the genesis account mnemonic',
  (await new Scrt.Agent({
    name:     'genesis',
    mnemonic: 'if name is passed mnemonic is ignored',
    chain
  }).ready).mnemonic,
  joinWith(' ',
    'the "name" constructor property of ScrtAgent can be used',
    'to get a devnet genesis account')
)

/// FEES

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

/// BUNDLES

const someBundle = () => new Scrt.Agent({
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
}).bundle(async (bundle)=>{
  assert(bundle instanceof Scrt.Bundle)
  await bundle.instantiate({ codeId: 'id', codeHash: 'hash', msg: {} } as any)
  await bundle.execute({ address: 'addr', codeHash: 'hash', msg: {} } as any, {})
})

assert.ok(
  await someBundle().save('test'),
  [ '"saving" a bundle outputs it to the console in the format ',
  , 'of a multisig message' ].join()
)
assert.ok(
  await someBundle().submit('test'),
  'submitting a bundle',
)
assert(
  someBundle() instanceof Scrt.Bundle,
  'ScrtBundle is returned'
)

/// PERMITS

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

/// CONSOLE

new Scrt.Console()
  .warn.noMemos()
  .warn.ignoringMnemonic()
  .warn.defaultGas([])
  .submittingBundleFailed(new Error())
