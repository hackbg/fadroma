import { taskmaster, resolve, bold, bignum } from '@fadroma/utilities'
import SecretNetwork from './network.js'
import colors from 'colors/safe.js'

/** In testing scenarios requiring multiple agents,
 * this function distributes funds among the extra agents
 * so as to create them on-chain. */
export default async function fundAgents (options = {}) {

  let { recipientGasBudget = bignum("5000000")
      , connection         = 'testnet' } = options

  // allow passing strings:
  recipientGasBudget = bignum(recipientGasBudget)
  if (typeof connection === 'string') {
    assert(['localnet','testnet','mainnet'].indexOf(connection) > -1)
    connection = await SecretNetwork[connection]({stateBase})
  }

  const { task  = taskmaster()
        , n     = 16 // give or take
        // connection defaults to testnet because localnet
        // wallets are not worth keeping (they don't even
        // transfer between localnet instances)
        , agent      = connection.agent
        // {address:{agent,address}}
        , recipients = await getDefaultRecipients()
        // [[address,budget]]
        , wallets    = await recipientsToWallets(recipients)
        } = options

  // check that admin has enough balance to create the wallets
  const {balance, recipientBalances} = await fetchAdminAndRecipientBalances()
  const fee = bignum(agent.fees.send)
  const preseedTotal = fee.plus(bignum(wallets.length).times(recipientGasBudget))
  if (preseedTotal.gt(balance)) {
    const message =
      `admin wallet does not have enough balance to preseed test wallets ` +
     `(${balance.toString()} < ${preseedTotal.toString()}); can't proceed.\n\n` +
      `on localnet, it's easiest to clear the state and redo the genesis.\n` +
      `on testnet, use the faucet at https://faucet.secrettestnet.io/ twice\n` +
      `with ${agent.address} to get 200 testnet SCRT`
    console.error(message)
    process.exit(1) }

  await task(`ensure ${wallets.length} test accounts have balance`, async report => {
    const tx = await agent.sendMany(wallets, 'create recipient accounts')
    report(tx.transactionHash)})

  await fetchAdminAndRecipientBalances()

  async function getDefaultRecipients () {
    const recipients = {}
    const wallets = readdirSync(agent.network.wallets)
      .filter(x=>x.endsWith('.json'))
      .map(x=>readFileSync(resolve(agent.network.wallets, x), 'utf8'))
      .map(JSON.parse)
    for (const {address, mnemonic} of wallets) {
      const agent = await agent.network.getAgent({mnemonic})
      assert(address === agent.address)
      recipients[address] = { agent, address }
    }
    return recipients
  }

  async function recipientsToWallets (recipients) {
    return Promise.all(Object.values(recipients).map(({address, agent})=>{
      return agent.balance.then(balance=>[address, recipientGasBudget, bignum(balance) ])
    }))
  }

  async function fetchAdminAndRecipientBalances () {
    const balance = bignum(await agent.balance)
    console.info('Admin balance:', balance.toString())
    const withBalance = async ({agent}) => [agent.name, bignum(await agent.balance)]
    const recipientBalances = []
    console.info('\nRecipient balances:')
    for (const {agent} of Object.values(recipients)) {
      recipientBalances.push([agent.name, bignum(await agent.balance)])
      //console.info(agent.name.padEnd(10), fmtSCRT(balance))
    }
    return {balance, recipientBalances}
  }
}
