import { test, todo } from 'tap'

import { ScrtAgentJS_1_0 } from '@fadroma/scrt-1.0'
import { ScrtAgentJS_1_2 } from '@fadroma/scrt-1.2'
import { MockChain } from './mocks'

;(()=>{
  for (const Agent of [ ScrtAgentJS_1_0, ScrtAgentJS_1_2 ]) {
    validateImplementation(Agent)
  }
})()

function validateImplementation (Agent: any) {

  todo(
    `create ${Agent.name} from mnemonic`,
    async ({ match }) => {
      const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const chain = await new MockChain().ready
      const agent = await Agent.create({ chain, mnemonic })
      match(agent.mnemonic, mnemonic)
      match(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
      match(agent.pubkey, {
        type:  'tendermint/PubKeySecp256k1',
        value: 'AoHyO3IEIOuffrGJoxwcYQnK+G1uMX/vQkzrjTXxMqTv' })
      chain.close() })

  //todo(`create ${Agent.name} from keypair`, async () => {})

  //todo(`create ${Agent.name} from signing pen`, async () => {})

  //todo(`${Agent.name} has name`, async () => {})

  todo(
    `${Agent.name} reads state and can wait for next block`,
    async ({ match }) => {
      const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const chain = await new MockChain().ready
      const agent = await Agent.create({ chain, mnemonic })
      const [ {header:{height:block1}}, account1, balance1 ] =
        await Promise.all([ agent.block, agent.account, agent.balance ])
      await agent.nextBlock
      const [ {header:{height:block2}}, account2, balance2 ] =
        await Promise.all([ agent.block, agent.account, agent.balance ])
      match(block1 + 1, block2)
      match(account1, account2)
      match(balance1, balance2)
      chain.close() })

  todo(
    `${Agent.name} supports native token`,
    async ({ match }) => {
      const mnemonic1 = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const mnemonic2 = 'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing';
      const chain = await new MockChain().ready
      const agent1 = await Agent.create({ chain, mnemonic: mnemonic1 })
      const agent2 = await Agent.create({ chain, mnemonic: mnemonic2 })
      chain.state.balances = { [agent1.address]: BigInt("2000"), [agent2.address]: BigInt("3000") }
      match(await agent1.balance, "2000")
      match(await agent2.balance, "3000")
      await agent1.send(agent2.address, "1000")
      match(await agent1.balance, "1000")
      match(await agent2.balance, "4000")
      await agent2.send(agent1.address, 500)
      match(await agent1.balance, "1500")
      match(await agent2.balance, "3500")
      chain.close() })

  //todo(`${Agent.name} can send native token to many recipients`, async () => {})

  test(
    `${Agent.name} uploads, instantiates, queries, and transacts with contract`,
    async ({ match }) => {
      const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const chain = await new MockChain().ready
      const agent = await Agent.create({ chain, mnemonic })
      const uploadReceipt = await agent.upload('empty.wasm')
      match(uploadReceipt, {})
      const initReceipt = await agent.instantiate(uploadReceipt.codeId, 'contract label', {})
      match(initReceipt, {})
      const address = initReceipt.contractAddress
      const queryResult = await agent.query({ address }, 'status')
      match(queryResult, { votes: [
        ["Marxism-Nixonism",                      0],
        ["Third-Worldist Neoconservatism",        0],
        ["Transhumanist Dynastic Muskism",        0],
        ["Trans-Supremacist Catgirl Syndicalism", 0],
        ["I just wanna grill",                    0] ] })
      const txResult = await agent.execute({ address }, 'vote', { option: "IJustWannaGrill" })
      match(txResult, {})
      match(queryResult, { votes: [
        ["Marxism-Nixonism",                      0],
        ["Third-Worldist Neoconservatism",        0],
        ["Transhumanist Dynastic Muskism",        0],
        ["Trans-Supremacist Catgirl Syndicalism", 0],
        ["I just wanna grill",                    1] ] }) })

}
