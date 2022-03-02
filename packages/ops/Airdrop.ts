import type { Chain } from './Chain'
import type { Agent } from './Agent'
import { taskmaster } from '@hackbg/tools'

export type Airdrop = {
  /** Taskmaster. TODO replace with generic observability mechanism (RxJS?) */
  task?:       Function
  /** How many identities to create */
  count?:      number
  /** How many native tokens to send to each identity */
  budget?:     bigint
  /** On which chain is this meant to happen? */
  chain?:      Chain
  /** Agent that distributes the tokens -
   *  needs to have sufficient balance
   *  e.g. genesis account on devnet) */
  agent?:      Agent
  /** Map of specific recipients to receive funds. */
  recipients?: Record<any, {agent: Agent}>
  /** Map of specific identities to receive funds.
   *  FIXME redundant with the above*/
  identities?: any
}

/** In testing scenarios requiring multiple agents,
 * this function distributes funds among the extra agents
 * so as to create them on-chain. */
export async function airdrop (options: Airdrop = {}) {

  let { budget  = BigInt("5000000")
      , chain = 'testnet' } = options

  // allow passing strings:
  budget = BigInt(budget)
  if (typeof chain === 'string') {
    if (!['devnet','testnet','mainnet'].includes(chain)) {
      throw new Error(`invalid chain: ${chain}`)
    } else {
      throw new Error('im old!')
      /*chain = await Chain[chain]({stateRoot: process.cwd()})*/
    }

  const { task      = taskmaster()
        , count     = 16 // give or take
        , agent      = await Promise.resolve((chain as Chain).getAgent())
        // {address:{agent,address}}
        , recipients = await getDefaultRecipients()
        // [[address,budget]]
        , identities    = await recipientsToWallets(recipients)
        } = options

  // check that admin has enough balance to create the wallets
  const {balance} = await fetchAdminAndRecipientBalances()
      , fee = BigInt(agent.fees.send)
      , total = fee + BigInt(identities.length) * budget
  if (total > balance) {
    const message =
      `admin wallet does not have enough balance to preseed test wallets ` +
     `(${balance.toString()} < ${total.toString()}); can't proceed.\n\n` +
      `on devnet, it's easiest to clear the state and redo the genesis.\n` +
      `on testnet, use the faucet at https://faucet.secrettestnet.io/ twice\n` +
      `with ${agent.address} to get 200 testnet SCRT`
    console.error(message)
    process.exit(1) }

  await task(`ensure ${identities.length} test accounts have balance`, async (report: Function) => {
    const tx = await agent.sendMany(identities, 'create recipient accounts')
    report(tx.transactionHash)})

  await fetchAdminAndRecipientBalances()

  async function getDefaultRecipients () {
    const recipients = {}
    const identities = agent.chain.identities.list()
      .filter(x=>x.endsWith('.json'))
      .map(x=>readFileSync(resolve(agent.chain.identities.path, x), 'utf8'))
      .map(x=>JSON.parse(x))
    const chain = agent.chain
    for (const {address, mnemonic} of identities) {
      const agent = await chain.getAgent({address, mnemonic})
      assert(address === agent.address)
      recipients[address] = { agent, address } }
    return recipients }

  async function recipientsToWallets (recipients: Record<any, any>) {
    return Promise.all(Object.values(recipients).map(({address, agent})=>{
      return agent.balance.then((balance:any)=>[address, budget, BigInt(balance) ]) })) }

  async function fetchAdminAndRecipientBalances () {
    const balance = BigInt(await agent.balance)
        , recipientBalances = []
    console.info('Admin balance:', balance.toString())
    console.info('\nRecipient balances:')
    for (const {agent} of Object.values(recipients)) {
      recipientBalances.push([agent.name, BigInt(await agent.balance)])
      /*console.info(agent.name.padEnd(10), fmtSCRT(balance))*/ }
    return {balance, recipientBalances}
  }

}
