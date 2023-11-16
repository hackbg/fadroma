import type { Connection, Backend } from './connec'
import { Console, bold } from '@hackbg/logs'
import ok from 'node:assert'
export async function testChainSupport <
  A extends typeof Connection,
  D extends typeof Backend
> (
  Chain: A, Backend: D, version: string, token: string, code: string
) {
  const console = new Console(`Testing ${bold(Chain.name)} + ${bold(Backend.name)}`)

  const { equal, throws, rejects } = await import('node:assert')
  const sendFee   = Chain.gas(1000000).asFee()
  const uploadFee = Chain.gas(10000000).asFee()
  const initFee   = Chain.gas(10000000).asFee()
  const execFee   = Chain.gas(10000000).asFee()

  const genesisAccounts = { Alice: "123456789000", Bob: "987654321000" }
  const $B = Backend as any
  const backend = new $B({ version, genesisAccounts })

  const [alice, bob] = await Promise.all([backend.connect('Alice'), backend.connect('Bob')])
  ok(alice.identity?.address && bob.identity?.address)

  console.info('Querying block height...')
  await alice.height

  console.info('Querying balances...')
  const [aliceBalance, bobBalance] = await Promise.all([alice.balance, bob.balance])
  console.log({aliceBalance, bobBalance})

  console.info('Authenticating a non-genesis account...')
  const guest = await backend.connect({
    name: 'Guest',
    mnemonic: [
      'define abandon palace resource estate elevator',
      'relief stock order pool knock myth',
      'brush element immense task rapid habit',
      'angry tiny foil prosper water news'
    ].join(' ')
  })

  console.info('Querying non-genesis account balance...')
  equal((await guest.balance)??'0', '0')

  console.info('Topping up non-genesis account balance from genesis accounts...')
  await alice.send(guest, [Chain.gas(1)], { sendFee })
  equal(await guest.balance, '1')
  await bob.send(guest, [Chain.gas(11)], { sendFee })
  equal(await guest.balance, '12')

  console.info('Uploading code...')
  const uploaded = await alice.upload(code)

  console.info('Querying code upload...')
  equal(await bob.getCodeHashOfCodeId(uploaded.codeId), uploaded.codeHash)
  rejects(()=>bob.getCodeHashOfCodeId('missing'))

  console.info('Instantiating code...')
  const label = 'my-contract-label'
  const initMsg = null as any // actually a valid init message
  const instance = await bob.instantiate(uploaded, { label, initMsg, initFee })

  console.info('Querying code hash of instance...')
  equal(await guest.getCodeHashOfAddress(instance.address), uploaded.codeHash)

  console.info('Executing transaction...')
  const txResult = await alice.execute(instance, null as any, { execFee })

  console.info('Executing query...')
  const qResult = await alice.query(instance, null as any)

  return { backend, alice, bob, guest }
}
