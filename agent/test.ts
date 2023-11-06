import type { Agent, Devnet } from '.'
import { Fee, Coin } from './token'
export async function testChainSupport <
  A extends typeof Agent, D extends typeof Devnet<A>
> (
  Agent: A, Devnet: D, token: string, code: string
) {
  const { equal } = await import('node:assert')
  const sendFee = new Fee( "1000000", "uknow")
  const uploadFee = new Fee("10000000", "uknow")
  const initFee = new Fee("10000000", "uknow")
  const devnet = new (Devnet as any)({
    genesisAccounts: {
      Alice: "123456789000",
      Bob:   "987654321000",
    }
  })

  const [alice, bob] = await Promise.all([
    devnet.connect({ name: 'Alice' }),
    devnet.connect({ name: 'Bob' }),
  ])

  console.log('Querying block height...')
  await alice.height

  console.log('Querying balances...')
  equal(await alice.balance, '123455789000')
  equal(await bob.balance,   '987654321000')

  console.log('Authenticating a non-genesis account...')
  const guest = await devnet.connect({ mnemonic: [
    'define abandon palace resource estate elevator',
    'relief stock order pool knock myth',
    'brush element immense task rapid habit',
    'angry tiny foil prosper water news'
  ].join(' ') })

  console.log('Querying non-genesis account balance...')
  equal((await guest.balance)??'0', '0')

  console.log('Topping up non-genesis account balance from genesis accounts...')
  console.log({alice, guest})
  await alice.send(guest, [new Coin("1", "uknow")], { sendFee })
  equal(await guest.balance, '1')
  await bob.send(guest, [new Coin("10", "uknow")], { sendFee })
  equal(await guest.balance, '11')

  console.log('Uploading code...')
  const uploaded = await alice.upload(code)

  console.log('Querying code upload...')
  equal(await bob.getCodeHashOfCodeId(uploaded.codeId), uploaded.codeHash)

  console.log('Querying code instantiation...')
  const label = 'my-contract-label'
  const initMsg = null as any // actually a valid init message
  const instance = await bob.instantiate(uploaded, { label, initMsg, initFee })

  console.log('Querying contract instance...')
  equal(await guest.getCodeHashOfAddress(instance.address), uploaded.codeHash)

  console.log('Executing transaction...')
  const txResult = await alice.execute(instance, null as any)
  console.debug('txResult:', txResult)

  return { devnet, alice, bob, guest }
}
