import { test, todo } from 'tap'

import { ScrtAgentJS_1_0, ScrtAgentJS_1_2 } from '@fadroma/scrt'
import { MockChain } from './mocks'

for (const Agent of [ ScrtAgentJS_1_0, ScrtAgentJS_1_2 ]) {
  testAgent(Agent)
}

function testAgent (Agent: any) {

  test(
    `create ${Agent.name} from mnemonic`,
    async ({ same }) => {
      const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const chain = await new MockChain().ready
      const agent = await Agent.create({ chain, mnemonic })
      same(agent.mnemonic, mnemonic)
      same(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
      same(agent.pubkey, {
        type:  'tendermint/PubKeySecp256k1',
        value: 'AoHyO3IEIOuffrGJoxwcYQnK+G1uMX/vQkzrjTXxMqTv' })
      chain.close()
    })

  //todo(`create ${Agent.name} from keypair`, async () => {})

  //todo(`create ${Agent.name} from signing pen`, async () => {})

  //todo(`${Agent.name} has name`, async () => {})

  test(
    `${Agent.name} reads state and can wait for next block`,
    async ({ same }) => {
      const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const chain = await new MockChain().ready
      const agent = await Agent.create({ chain, mnemonic })
      const [ {header:{height:block1}}, account1, balance1 ] =
        await Promise.all([ agent.block, agent.account, agent.balance ])
      await agent.nextBlock
      const [ {header:{height:block2}}, account2, balance2 ] =
        await Promise.all([ agent.block, agent.account, agent.balance ])
      same(block1 + 1, block2)
      same(account1, account2)
      same(balance1, balance2)
      chain.close()
    })

  test(
    `${Agent.name} supports native token`,
    async ({ same }) => {
      const mnemonic1 = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const mnemonic2 = 'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing';
      const chain = await new MockChain().ready
      const agent1 = await Agent.create({ chain, mnemonic: mnemonic1 })
      const agent2 = await Agent.create({ chain, mnemonic: mnemonic2 })
      chain.state.balances = { [agent1.address]: BigInt("2000"), [agent2.address]: BigInt("3000") }
      same(await agent1.balance, "2000")
      same(await agent2.balance, "3000")
      await agent1.send(agent2.address, "1000")
      same(await agent1.balance, "1000")
      same(await agent2.balance, "4000")
      await agent2.send(agent1.address, 500)
      same(await agent1.balance, "1500")
      same(await agent2.balance, "3500")
      chain.close()
    })

  //todo(`${Agent.name} can send native token to many recipients`, async () => {})

  test(
    `${Agent.name} uploads, instantiates, queries, and transacts with contract`,
    async ({ ok, same }) => {
      const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const chain = await new MockChain().ready
      const agent = await Agent.create({ ok, chain, mnemonic })

      // upload ------------------------------------------------------------------------------------
      const { originalSize, originalChecksum,
              compressedSize, compressedChecksum,
              codeId, logs: uploadLogs } = await agent.upload('empty.wasm')
      same(originalSize,       0)
      same(originalChecksum,   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
      same(compressedSize,     20) // lol
      same(compressedChecksum, "f61f27bd17de546264aa58f40f3aafaac7021e0ef69c17f6b1b4cd7664a037ec")
      same(codeId, 1)
      same(uploadLogs, [ { events: [ { type: "message", attributes: [ { key: 'code_id', value: 1 } ] } ] } ])

      // init --------------------------------------------------------------------------------------
      const { contractAddress: address, logs: initLogs } = await agent.instantiate(
        codeId, `contract_deployed_by_${Agent.name}`, {})
      ok(address,
        'init tx returns contract address')
      same(initLogs,
        [ { events: [ { type: "message", attributes: [ { key: "contract_address", value: address } ] } ] } ],
        'init logs contain contract address')

      // query -------------------------------------------------------------------------------------
      console.debug(`test q ${address}`)
      const queryResult = await agent.query({ address }, 'status')
      same(queryResult, 'status')

      // transact ----------------------------------------------------------------------------------
      console.debug(`test tx ${address}`)
      const txResult = await agent.execute({ address }, 'tx', { option: "value" })
      same(txResult, {})
    })

}
