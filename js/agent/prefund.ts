import assert from 'assert'

import { taskmaster } from '@fadroma/cli'
import { resolve, readdirSync, readFileSync } from '@fadroma/sys'

import { Agent } from './agent'
import { Network, Scrt } from './network'

export type Prefund = {
  task?:       Function
  count?:      number
  budget?:     bigint

  network?:    Network|string
  agent?:      Agent

  recipients?: Record<any, {agent: Agent}>
  wallets?:    any
}

/** In testing scenarios requiring multiple agents,
 * this function distributes funds among the extra agents
 * so as to create them on-chain. */
export async function prefund (options: Prefund = {}) {

  let { budget  = BigInt("5000000")
      , network = 'testnet' } = options

  // allow passing strings:
  budget = BigInt(budget)
  if (typeof network === 'string') {
    if (!['localnet','testnet','mainnet'].includes(network)) {
      throw new Error(`invalid network: ${network}`)}
    network = await Scrt[network]({stateBase: process.cwd()}) }

  const { task      = taskmaster()
        , count     = 16 // give or take
        , agent      = (network as Network).getAgent()
        // {address:{agent,address}}
        , recipients = await getDefaultRecipients()
        // [[address,budget]]
        , wallets    = await recipientsToWallets(recipients)
        } = options

  // check that admin has enough balance to create the wallets
  const {balance} = await fetchAdminAndRecipientBalances()
      , fee = BigInt(agent.fees.send)
      , total = fee + BigInt(wallets.length) * budget
  if (total > balance) {
    const message =
      `admin wallet does not have enough balance to preseed test wallets ` +
     `(${balance.toString()} < ${total.toString()}); can't proceed.\n\n` +
      `on localnet, it's easiest to clear the state and redo the genesis.\n` +
      `on testnet, use the faucet at https://faucet.secrettestnet.io/ twice\n` +
      `with ${agent.address} to get 200 testnet SCRT`
    console.error(message)
    process.exit(1) }

  await task(`ensure ${wallets.length} test accounts have balance`, async (report: Function) => {
    const tx = await agent.sendMany(wallets, 'create recipient accounts')
    report(tx.transactionHash)})

  await fetchAdminAndRecipientBalances()

  async function getDefaultRecipients () {
    const recipients = {}
    const wallets = readdirSync(agent.network.wallets)
      .filter(x=>x.endsWith('.json'))
      .map(x=>readFileSync(resolve(agent.network.wallets, x), 'utf8'))
      .map(x=>JSON.parse(x))
    const network = agent.network
    for (const {address, mnemonic} of wallets) {
      const agent = network.getAgent(address, {mnemonic})
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
    return {balance, recipientBalances} } }
