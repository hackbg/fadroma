# Test context

## Test fixtures

* Files with a fixed content that are used in the test suites.
* Stored in [./fixtures](./fixtures).
* TODO use `fetch` instead of Node FS API

```typescript
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
export const here    = dirname(fileURLToPath(import.meta.url))
export const fixture = x => resolve(here, '..', x)
```

## Mock of Dockerode API

The next best thing after booting rootless Docker in GitHub Actions.

Fadroma uses Docker for **build** and **devnet** containers.

```typescript
export function mockDockerode (callback = () => {}) {
  return {
    getImage () { return { async inspect () { return } } },
    getContainer (options) { return mockDockerodeContainer(callback) }
    async pull () {},
    async createContainer (options) { return mockDockerodeContainer(callback) },
    async run (...args) { callback({run:args}); return [{Error:null, StatusCode:0}, Symbol()] },
  }
}
export function mockDockerodeContainer (callback = () => {}) {
  return {
    id: 'mockmockmock',
    logs (options, cb) { cb(...(callback({ createContainer: options })||[])) },
    async start   () {}
    async attach  () { return {setEncoding(){},pipe(){}} },
    async wait    () { return {Error: null, StatusCode: 0}}
    async inspect () { return {Image:' ',Name:null,Args:null,Path:null,State:{Running:null}}}
  }
}
```

## Mock of Secret Network 1.2 HTTP API

> Not to be confused with the [Mocknet](./Mocknet.ts.md)

This construct simulates the responses returned by the Secret Network HTTP API (Amino),
in order to ensure that the client code (secretjs+fadroma stack) handles them correctly.

```typescript
import freePort from 'freeport-async'
import Express from 'express'
import bodyParser from 'body-parser'
import { randomHex } from '@fadroma/ops'

export async function withMockAPIEndpoint (cb) {
  const endpoint = await mockAPIEndpoint()
  try {
    await Promise.resolve(cb(endpoint))
  } catch (e) {
    console.warn(e)
    throw e
  } finally {
    endpoint.close()
  }
}

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
  app.get('/wasm/contract/:address/query/:query', respond(echoQuery))

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
    server = app.listen(port, () => {
      url = `http://localhost:${port}`
      //console.debug(`Mock Scrt listening on ${url}`)
      resolve()
    })
  })

  const blockIncrement = setInterval(()=>{state.block.height+=1}, 2000)

  return {
    url,
    port,
    state,
    close () {
      console.info(`Closing ${url}`)
      clearInterval(blockIncrement)
      server.close()
    }
  }

}
```

### A mock query response which echoes the input

```typescript
async function echoQuery ({query}) {
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
}
```

```javascript
import Agent   from './Agent.spec'
import Build   from './Build.spec'
import Chain   from './Chain.spec'
import Client  from './Client.spec'
import Deploy  from './Deploy.spec'
import Devnet  from './Devnet.spec'
import Operate from './Operate.spec'
import Mocknet from './Mocknet.spec'
import Upload  from './Upload.spec'

const Specification = {
  Agent,
  Build,
  Chain,
  Client,
  Deploy,
  Devnet,
  Operate,
  Mocknet,
  Upload,
}

export default Specification
```

### Mock of devnet manager

```typescript
import { spawn } from 'child_process'
const devnetManager = resolve(here, '../packages/ops-scrt/devnet-manager.mjs')
const devnetInitScript = resolve(here, '_mock-devnet-init.mjs')
export async function mockDevnetManager (port) {
  port = port || await freePort(10000 + Math.floor(Math.random()*10000))
  const manager = spawn(process.argv[0], [devnetManager], {
    stdio: 'inherit',
    env: {
      PORT: port,
      FADROMA_DEVNET_INIT_SCRIPT: devnetInitScript
      PATH: process.env.path
    }
  })
  await new Promise(ok=>setTimeout(ok, 1000)) // FIXME flimsy!
  return {
    url: `http://localhost:${port}`,
    port,
    close () {
      manager.kill()
    }
  }
}
```
