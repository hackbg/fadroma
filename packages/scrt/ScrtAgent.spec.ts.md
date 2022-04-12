# `@fadroma/scrt` Agent classes

```typescript
import assert from 'assert'
const ScrtAgentSpec = {}
const test = tests => Object.assign(ScrtAgentSpec, tests)
export default ScrtAgentSpec
```

## Agents

```typescript
import { ScrtAgent } from './ScrtAgent'
import { toBase64, fromBase64, fromUtf8, fromHex } from '@fadroma/ops'
test({
  async 'from mnemonic' ({ equal, deepEqual }) {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const agent = await ScrtAgent.create({ mnemonic })
    equal(agent.mnemonic, mnemonic)
    equal(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
    deepEqual(agent.pubkey, {
      type:  'tendermint/PubKeySecp256k1',
      value: 'AoHyO3IEIOuffrGJoxwcYQnK+G1uMX/vQkzrjTXxMqTv'
    })
  },
  async 'wait for next block' ({ equal, deepEqual }) {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const [agent, endpoint] = await Promise.all([ScrtAgent.create({ mnemonic }), mockAPIEndpoint()])
    try {
      agent.chain = { url: endpoint.url }
      const [ {header:{height:block1}}, account1, balance1 ] =
        await Promise.all([ agent.block, agent.account, agent.balance ])
      await agent.nextBlock
      const [ {header:{height:block2}}, account2, balance2 ] =
        await Promise.all([ agent.block, agent.account, agent.balance ])
      equal(block1 + 1, block2)
      deepEqual(account1, account2)
      deepEqual(balance1, balance2)
    } finally {
      endpoint.close()
    }
  },
  async 'native token balance and transactions' ({ equal }) {
    const mnemonic1 = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const mnemonic2 = 'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing';
    const [agent1, agent2, endpoint] = await Promise.all([
      ScrtAgent.create({mnemonic: mnemonic1}),
      ScrtAgent.create({mnemonic: mnemonic2}),
      mockAPIEndpoint()
    ])
    try {
      agent1.chain = agent2.chain = { url: endpoint.url }
      endpoint.state.balances = { uscrt: { [agent1.address]: BigInt("2000"), [agent2.address]: BigInt("3000") } }
      equal(await agent1.balance, "2000")
      equal(await agent2.balance, "3000")
      await agent1.send(agent2.address, "1000")
      equal(await agent1.balance, "1000")
      equal(await agent2.balance, "4000")
      await agent2.send(agent1.address, 500)
      equal(await agent1.balance, "1500")
      equal(await agent2.balance, "3500")
    } finally {
      endpoint.close()
    }
  },
  async "full contract lifecycle" ({ ok, equal, deepEqual }) {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const [agent, endpoint] = await Promise.all([ScrtAgent.create({ mnemonic }), mockAPIEndpoint()])
    agent.chain = { id: 'testing', url: endpoint.url }
    try {
      const location = 'examples/empty.wasm'
      const codeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      const artifact = { location, codeHash }
      const template = await agent.upload(artifact)
      equal(artifact.codeHash, template.codeHash)
      equal(template.codeId,   1)
      const label    = `contract_deployed_by_${agent.name}`
      const instance = await agent.instantiate(template, label, {})
      const { address } = instance
      ok(address, 'init tx returns contract address')
      console.debug(`test q ${address}`)
      throw 'TODO - how to decrypt/reencrypt query?'
      const queryResult = await agent.query({ address }, 'status')
      equal(queryResult, 'status')
      console.debug(`test tx ${address}`)
      const txResult = await agent.execute({ address }, 'tx', { option: "value" })
      deepEqual(txResult, {})
    } finally {
      endpoint.close()
    }
  }
})
```

## Bundles

```typescript
import { ScrtBundle } from './ScrtAgent'
test({
  async 'get ScrtBundle from agent' () {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const agent  = await ScrtAgent.create({ mnemonic })
    const bundle = agent.bundle()
    assert(bundle instanceof ScrtBundle)
  }
})
```

## Chain API Mock

```typescript
import freePort from 'freeport-async'
import Express from 'express'
import bodyParser from 'body-parser'
import { randomHex } from '@fadroma/ops'
export async function mockAPIEndpoint (port) {

  const state = {
    block: {
      height: 1
    },
    balances: {
      uscrt: []
    },
    contracts: {
    },
    txs: {
    }
  }

  const getCoins = address => ([
    { "denom": "uscrt", "amount": String(state.balances.uscrt[address]||0) }
  ])

  port = port || await freePort(10000 + Math.floor(Math.random()*10000))

  const app = new Express()

  app.use(bodyParser.json())

  /*app.use((req, res, next)=>{
    console.debug(`${req.method} ${req.url}`)
    next()
  })*/

  const respond = (fn) => (req, res, next) => Promise.resolve(fn(req.params, req.body))
    .then(response=>res.status(200).send(JSON.stringify(response)).end())
    .catch(error=>(typeof error==='number')?res.status(error).end():res.status(500).send(error).end())

  app.get('/blocks/latest', respond(()=>{
    const mockHash40  = () => "3988E90BEF9EDC708165E22590CC535344293CB1"
    const mockHash64  = () => "B68EEA55C2D625EEE3BC8687ECC1916835A4A10E1CEB2A6311D24D2B19FB80D5"
    const mockDate    = () => "2021-09-20T11:39:44.197475092Z"
    const mockBlockId = () => ({
      "hash":  mockHash64(),
      "parts": { "total": "1", "hash": mockHash64() }
    })
    const mockSignature = () => ({
      "block_id_flag":     2,
      "validator_address": mockHash40(),
      "timestamp":         mockDate(),
      "signature":         "NLPdwangTW5xWKNT3v02JMxxzm/bD+FZgRWQnVFwUrG7Tr66vLUhMPZXP8tvt9aJWZ+QisuQDRMH7DIQrOQpBg=="
    })
    return {
      "block_id": mockBlockId(),
      "block": {
        "header": {
          "version":              { "block": "10", "app": "0" },
          "chain_id":             "holodeck-2",
          "height":               state.block.height,
          "time":                 mockDate(),
          "last_block_id":        mockBlockId(),
          "last_commit_hash":     mockHash64(),
          "data_hash":            "",
          "validators_hash":      mockHash64(),
          "next_validators_hash": mockHash64(),
          "consensus_hash":       mockHash64(),
          "app_hash":             mockHash64(),
          "last_results_hash":    "",
          "evidence_hash":        "",
          "proposer_address":     mockHash40()
        },
        "data":     { "txs": null },
        "evidence": { "evidence": null },
        "last_commit": {
          "height":     "4682853",
          "round":      "0",
          "block_id":   mockBlockId(),
          "signatures": [mockSignature(), mockSignature()]
        }
      }
    }
  }))

  app.get('/auth/accounts/:address', respond(({address})=>{
    return {
      "height": state.block.height,
      "result": {
        "type": "cosmos-sdk/Account",
        "value": {
          "address": address,
          "coins": getCoins(address),
          "public_key": "secretpub1addwnpepqghcej6wkd6gazdkx55e920tpehu906jdzpqhtgjuct9gvrzcfjeclrccvm",
          "account_number": 1073,
          "sequence": 1801
        }
      }
    }
  }))

  app.get('/node_info', respond(()=>({
    "node_info": {
      "protocol_version": { "p2p": "7", "block": "10", "app": "0" },
      "id": "64b03220d97e5dc21ec65bf7ee1d839afb6f7193",
      "listen_addr": "tcp://0.0.0.0:26656",
      "network": "holodeck-2",
      "version": "0.33.8",
      "channels": "4020212223303800",
      "moniker": "ChainofSecretsBootstrap",
      "other": {
        "tx_index": "on",
        "rpc_address": "tcp://0.0.0.0:26657"
      }
    },
    "application_version": {
      "name": "SecretNetwork",
      "server_name": "secretd",
      "client_name": "secretcli",
      "version": "1.0.4-2-ge24cdfde",
      "commit": "e24cdfde5cd3b4bdd9b6ca429aafaa552b95e2bf",
      "build_tags": "netgo ledger hw develop",
      "go": "go version go1.13.4 linux/amd64"
    }
  })))

  app.post('/txs', respond((_, {tx:{msg}})=>{
    const txhash = randomHex(16).toUpperCase()
    const mockTx = (logs) => {
      state.txs[txhash] = {
        tx: { value: { init_msg: [], msg: [] } },
        txhash,
        raw_log: "",
        logs,
        msg
      }
    }
    const mockAddr = () => 'secret1l3j38zr0xrcv4ywt7p87mpm93vh7erly3yd0nl'
    const mockHandlers = {
      'cosmos-sdk/MsgSend' ({from_address, to_address, amount}) {
        for (const {denom, amount: x} of amount) {
          if (denom === 'uscrt') {
            state.balances.uscrt[from_address] -= BigInt(x)
            state.balances.uscrt[to_address]   += BigInt(x)
          }
        }
        mockTx()
      },
      'wasm/MsgStoreCode' () {
        mockTx([{events:[{type:'message',attributes:[
          {key:Symbol(),value:Symbol()},
          {key:Symbol(),value:Symbol()},
          {key:Symbol(),value:Symbol()},
          {key:'code_id',value:1} // for upload
        ]}]}])
      },
      'wasm/MsgInstantiateContract' () {
        mockTx([{events:[{type:'message',attributes:[
          {key:Symbol(),value:Symbol()},
          {key:Symbol(),value:Symbol()},
          {key:Symbol(),value:Symbol()},
          {key:Symbol(),value:Symbol()},
          {key:'contract_address',value:mockAddr()}
        ]}]}])
      }
      'wasm/MsgExecuteContract' () {
        throw 'TODO'
      }
    }
    for (const {type, value} of msg) {
      const mockHandler = mockHandlers[type]
      if (mockHandler) {
        mockHandler(value)
      } else {
        console.warn(type, value)
      }
    }
    return { txhash }
  }))

  app.get('/txs/:txhash', respond(({txhash})=>{
    const response = state.txs[txhash]
    console.debug('response', response)
    if (response) {
      return response
    } else {
      throw 404
    }
  }))

  app.get('/wasm/code/:id/hash', respond(()=>({
    result: 'e87c2d9ec2cc89f19b60e4b927b96d4e6b5a309200f4f303f96b666546dcea33'
  })))

  app.get('/wasm/contract/:address/code-hash', respond(()=>({
    result: 'e87c2d9ec2cc89f19b60e4b927b96d4e6b5a309200f4f303f96b666546dcea33'
  })))

  // echoes input query
  app.get('/wasm/contract/:address/query/:query', respond(async ({query})=>{
    try {
      /*let query2 = query

      const encrypted = query
      const nonce = encrypted.slice(0, 32)
      const step1 = fromHex(responseData.result.smart)
      console.debug(1,{step1_fromHex:step1})
      const step2 = await this.enigmautils.decrypt(step1, nonce)
      console.debug(2,{step2_decrypt:step2})
      const step3 = fromUtf8(step2)
      console.debug(3,{step3_fromutf8:step3})

      query = query2
      */

      console.log(1, query)
      query = fromHex(query)
      console.log(2, query.toString())
      query = fromUtf8(query)
      console.log(3, query.toString())
      query = fromBase64(query)
      console.log(4, query.toString())
      query = query.slice(64)
      console.log(5, query.toString())
      query = toBase64(query)
      console.log(6, query.toString())

      return { result: { smart: query } }
    } catch (e) {
      console.error(e)
      process.exit(123)
    }
  }))

  app.get('/reg/consensus-io-exch-pubkey', respond(()=>({
    result: { ioExchPubkey: "0jyiOQXsuaJzXX7KzsZJRsPqA8XQyt79mpciYm4uPkE=" }
  })))

  // new in 1.2
  app.get('/bank/balances/:address', respond(({ address }) => ({
    height: state.block.height,
    result: getCoins(address)
  })))

  // new in 1.2
  app.get('/reg/tx-key', respond(()=>({
    result: { TxKey: "0jyiOQXsuaJzXX7KzsZJRsPqA8XQyt79mpciYm4uPkE=" }
  })))

  let server
  let url
  await new Promise(resolve=>{
    server = app.listen(port, 'localhost', () => {
      url = `http://localhost:${port}`
      console.debug(`Mock Scrt listening on ${url}`)
      resolve()
    })
  })

  const blockIncrement = setInterval(()=>{state.block.height+=1}, 2000)

  return {
    url,
    port,
    state,
    close () {
      clearInterval(blockIncrement)
      server.close()
    }
  }

}
```
