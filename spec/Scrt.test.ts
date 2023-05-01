import assert from 'node:assert'
import * as Scrt from '@fadroma/scrt'

assert.equal(

  'the genesis account mnemonic',

  (await new Scrt.Agent({
    name:     'genesis',
    mnemonic: 'if name is passed mnemonic is ignored',
    chain: {
      SecretJS: Scrt.SecretJS.default,
      getApi: () => ({}),
      isDevnet: true,
      devnet: {
        respawn: () => Promise.resolve(),
        getGenesisAccount: ()=>Promise.resolve({
          mnemonic: 'the genesis account mnemonic'
        })
      },
    }
  }).ready).mnemonic,

  [ 'the "name" constructor property of ScrtAgent can be used'
  , 'to get a devnet genesis account' ].join()

)
              // what is up with this syntax highlighting ?
assert.ok(

  await new Scrt.Agent({
    fees: false,
    chain: {
      SecretJS: Scrt.SecretJS.default,
      getApi: () => ({}),
      fetchLimits: ()=>Promise.resolve({gas: 'max'}),
      id: 'test',
    },
  }).ready,

  [ 'if fees=false is passed to ScrtAgent, ',
    'fees are fetched from the chain' ].join()

)

const someBundle = () => new Scrt.Agent({
  chain: {
    SecretJS: Scrt.SecretJS.default,
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
  }
}).bundle(async (bundle: Scrt.Bundle)=>{
  await bundle.instantiate({ codeId: 'id', codeHash: 'hash', msg: {} })
  await bundle.execute({ address: 'addr', codeHash: 'hash', msg: {} })
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
