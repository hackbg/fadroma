# `@fadroma/scrt` Agent classes

```typescript
import assert from 'assert'
const ScrtAgentSpec = {}
const test = tests => Object.assign(ScrtAgentSpec, tests)
export default ScrtAgentSpec
```

## Agents

```typescript
import { ScrtAgentJS, ScrtAgentTX } from './ScrtAgent'
test({
  async 'wait for next block' () {
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
  },
  async 'native token balance and transactions' () {
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
  },
  async 'from mnemonic' () {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const chain = await new MockChain().ready
    const agent = await Agent.create({ chain, mnemonic })
    same(agent.mnemonic, mnemonic)
    same(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
    same(agent.pubkey, {
      type:  'tendermint/PubKeySecp256k1',
      value: 'AoHyO3IEIOuffrGJoxwcYQnK+G1uMX/vQkzrjTXxMqTv' })
    chain.close()
  }
})
```

## Bundles

```typescript
import { BroadcastingScrtBundle, MultisigScrtBundle } from './ScrtAgent'
```

## Chain API Mock

```typescript
import freePort from 'freeport-async'
import Express from 'express'
import bodyParser from 'body-parser'
export async function mockAPIEndpoint (port) {

  const state = {
    block: {
      height: 1
    },
    balances: {
      uscrt: []
    },
    contracts: {
    }
  }

  port = port || await freePort(10000 + Math.floor(Math.random()*10000))

  const app = new Express()

  app.use(bodyParser.json())

  app.use((req, res, next)=>{
    console.debug(`${req.method} ${req.url}`)
    next()
  })

  const respond = (fn) => (req, res, next) => res.status(200).send(JSON.stringify(fn(req.params, req.body))).end()

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
          "coins": [
            { "denom": "uscrt", "amount": String(state.state.balances[address]||0) }
          ],
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
        txhash,
        raw_log: "",
        logs
      }
    }
    const mockAddr = () => 'secret1l3j38zr0xrcv4ywt7p87mpm93vh7erly3yd0nl'
    const mockHandlers = {
      'cosmos-sdk/MsgSend' () {
        const {from_address, to_address, amount} = value
        for (const {denom, amount: x} of amount) {
          if (denom === 'uscrt') {
            state.balances[from_address] -= BigInt(x)
            state.balances[to_address]   += BigInt(x)
          }
        }
        mockTx()
      },
      'wasm/MsgStoreCode' () {
        mockTx([{events:[{type:'message',attributes:[{key:'code_id',value:1}]}]}])
      },
      'wasm/MsgInstantiateContract' () {
        mockTx([{events:[{type:'message',attributes:[{key:'contract_address',value:mockAddr()}]}]}])
      }
      'wasm/MsgExecuteContract' () {
        throw 'TODO'
      }
    }
    for (const {type, value} of req.body.tx.msg) {
      const mockHandler = mockHandlers[type]
      if (mockHandler) {
        mockHandler(value)
      } else {
        console.warn(type, value)
      }
    }
    return { txhash }
  }))

  app.get('/txs/:txhash', (req, res, next)=>{
    const response = state.txs[req.params.txhash]
    console.debug('response', response)
    if (response) {
      res.status(200).send(JSON.stringify(response)).end()
    } else {
      res.status(404).end()
    }
  })

  app.get('/wasm/code/:id/hash', respond(()=>({
    result: 'e87c2d9ec2cc89f19b60e4b927b96d4e6b5a309200f4f303f96b666546dcea33'
  })))

  app.get('/wasm/contract/:address/code-hash', respond(()=>({
    result: 'e87c2d9ec2cc89f19b60e4b927b96d4e6b5a309200f4f303f96b666546dcea33'
  })))

  // echoes input query
  app.get('/wasm/contract/:address/query/:query', async(req, res, next)=>{
    const encrypted = req.params.query
    const nonce = encrypted.slice(0, 32)
    console.debug('--------------==================', encrypted)
    const step1 = encoding_1.Encoding.fromHex(responseData.result.smart)
    console.debug(1,{step1_fromHex:step1})
    const step2 = await this.enigmautils.decrypt(step1, nonce)
    console.debug(2,{step2_decrypt:step2})
    const step3 = encoding_1.Encoding.fromUtf8(step2)
    console.debug(3,{step3_fromutf8:step3})

    let query = req.params.query
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
    res.status(200).send(JSON.stringify({ result: { smart: query } })).end()
  })

  app.get('/reg/consensus-io-exch-pubkey', respond(()=>({
    result: { ioExchPubkey: "0jyiOQXsuaJzXX7KzsZJRsPqA8XQyt79mpciYm4uPkE=" }
  })))

  // new in 1.2
  app.get('/bank/balances/:address', respond(() => ({
    height: state.block.height,
    result: 0
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
      console.debug(`listening on ${url}`)
      resolve
    })
  })

  return {
    url,
    port,
    state,
    close () {
      clearTimeout(this.blockIncrement)
      server.close()
    }
  }

}
```
