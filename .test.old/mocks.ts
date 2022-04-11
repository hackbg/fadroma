import * as net from 'net'
import { Identity, Agent, Chain } from '@fadroma/ops'
import { randomHex } from '@hackbg/tools'

import { fromUtf8, fromHex, fromBase64, toBase64 } from '@iov/encoding'

import freePort from 'freeport-async'
import Express from 'express'
import bodyParser from 'body-parser'

export class MockChain extends Chain {

  state = {
    balances: {},
    txs: {}
  }

  async init () { return this }

  async getAgent (options?: Identity) { return MockAgent.create(options) }

  getContract<T> (API: new()=>T, address: string, agent: any) { return new API() }

  printStatusTables () {}

  get url () { return this.#url }
  #url: string = ''

  close: Function = ()=>{}

  #blockHeight: number = 1
  blockIncrement = setInterval(()=>{
    this.#blockHeight++ }, 2000)

  get ready () { return this.#ready }
  #ready: Promise<this> = new Promise(async resolve=>{
    const port = await freePort(10000 + Math.floor(Math.random()*10000))
    const app = new Express()

    app.use(bodyParser.json())

    app.use((req, res, next)=>{
      console.debug(`${req.method} ${req.url}`)
      next() })

    app.get('/blocks/latest', (req, res, next)=>{
      res.status(200).send(JSON.stringify({
        "block_id": {
          "hash": "B68EEA55C2D625EEE3BC8687ECC1916835A4A10E1CEB2A6311D24D2B19FB80D5",
          "parts": {
            "total": "1",
            "hash": "AB43292CC17EA03B3B4B08F147AC463295B42A35202AEA1A320345EC544C23C8" } },
        "block": {
          "header": {
            "version": {
              "block": "10",
              "app": "0" },
            "chain_id": "holodeck-2",
            "height": this.#blockHeight,
            "time": "2021-09-20T11:39:44.298475782Z",
            "last_block_id": {
              "hash": "57BC78337AE1FC54EE9EE21DE96B2D4BA7A15A8964EF8B4210DA30BFFF2002B6",
              "parts": {
                "total": "1",
                "hash": "1E6DF3126BAB0BCBF8CD4FF962BD4EDAAFCE5418D48E874A99954D8C9C00F7C8" } },
            "last_commit_hash": "C92123DBB6426C7007F7ED3A7B26EAAE625FF663C603AA035762EC4180802C9C",
            "data_hash": "",
            "validators_hash": "56FA56ACB90F13913EFEB6EF430A07A97403AA968375F154BDC257B7BEAC3FA5",
            "next_validators_hash": "56FA56ACB90F13913EFEB6EF430A07A97403AA968375F154BDC257B7BEAC3FA5",
            "consensus_hash": "048091BC7DDC283F77BFBF91D73C44DA58C3DF8A9CBC867405D8B7F3DAADA22F",
            "app_hash": "15881420BF47EF298DE32EE3CF96069BDA1D96D743344B35B4C0E86E24E893A3",
            "last_results_hash": "",
            "evidence_hash": "",
            "proposer_address": "3988E90BEF9EDC708165E22590CC535344293CB1" },
          "data": {
            "txs": null },
          "evidence": {
            "evidence": null },
          "last_commit": {
            "height": "4682853",
            "round": "0",
            "block_id": {
              "hash": "57BC78337AE1FC54EE9EE21DE96B2D4BA7A15A8964EF8B4210DA30BFFF2002B6",
              "parts": {
                "total": "1",
                "hash": "1E6DF3126BAB0BCBF8CD4FF962BD4EDAAFCE5418D48E874A99954D8C9C00F7C8" } },
            "signatures": [
              { "block_id_flag": 2,
                "validator_address": "3988E90BEF9EDC708165E22590CC535344293CB1",
                "timestamp": "2021-09-20T11:39:44.197475092Z",
                "signature": "NLPdwangTW5xWKNT3v02JMxxzm/bD+FZgRWQnVFwUrG7Tr66vLUhMPZXP8tvt9aJWZ+QisuQDRMH7DIQrOQpBg==" },
              { "block_id_flag": 2,
                "validator_address": "C3184F0A9A08CD1C0A37D1AABF9E87179EA4ED24",
                "timestamp": "2021-09-20T11:39:44.298475782Z",
                "signature": "5XRdkoHsHKZRDbMVIgAsW9zgiYZwywKAlWFg5rROzOq40nz8iOeNeJzHTyRYp5eRVmMtwr4sYTFTp0SYssuiAQ==" } ] } }
      })).end() })

    app.get('/auth/accounts/:address', (req, res, next)=>{
      res.status(200).send(JSON.stringify({
        "height": this.#blockHeight,
        "result": {
          "type": "cosmos-sdk/Account",
          "value": {
            "address": req.params.address,
            "coins": [ { "denom": "uscrt", "amount": String(this.state.balances[req.params.address]) } ],
            "public_key": "secretpub1addwnpepqghcej6wkd6gazdkx55e920tpehu906jdzpqhtgjuct9gvrzcfjeclrccvm",
            "account_number": 1073,
            "sequence": 1801 } }
      })).end() })

    app.get('/node_info', (req, res, next)=>{
      res.status(200).send(JSON.stringify({
        "node_info": {
          "protocol_version": {
            "p2p": "7",
            "block": "10",
            "app": "0" },
          "id": "64b03220d97e5dc21ec65bf7ee1d839afb6f7193",
          "listen_addr": "tcp://0.0.0.0:26656",
          "network": "holodeck-2",
          "version": "0.33.8",
          "channels": "4020212223303800",
          "moniker": "ChainofSecretsBootstrap",
          "other": {
            "tx_index": "on",
            "rpc_address": "tcp://0.0.0.0:26657" } },
        "application_version": {
          "name": "SecretNetwork",
          "server_name": "secretd",
          "client_name": "secretcli",
          "version": "1.0.4-2-ge24cdfde",
          "commit": "e24cdfde5cd3b4bdd9b6ca429aafaa552b95e2bf",
          "build_tags": "netgo ledger hw develop",
          "go": "go version go1.13.4 linux/amd64" }
      })).end() })

    app.post('/txs', (req, res, next)=>{
      const txhash = randomHex(16).toUpperCase()
      for (const {type, value} of req.body.tx.msg) {
        switch (type) {
          case 'cosmos-sdk/MsgSend':
            const {from_address, to_address, amount} = value
            for (const {denom, amount: x} of amount) {
              if (denom === 'uscrt') {
                this.state.balances[from_address] -= BigInt(x)
                this.state.balances[to_address]   += BigInt(x) } }
            this.state.txs[txhash] = {
              txhash,
              raw_log: "" }
            break
          case 'wasm/MsgStoreCode':
            this.state.txs[txhash] = {
              txhash, raw_log: "", logs: [{
                events: [{
                  type:'message',
                  attributes:[{
                    key:'code_id',
                    value:1}]}] }] }
            break
          case 'wasm/MsgInstantiateContract':
            this.state.txs[txhash] = {
              txhash, raw_log: "", logs: [{
                events: [{
                  type:'message',
                  attributes:[{
                    key:'contract_address',
                    value:'secret1l3j38zr0xrcv4ywt7p87mpm93vh7erly3yd0nl'}]}] }] }
          default:
            console.warn(type, value) } }
      res.status(200).send(JSON.stringify({ txhash })).end() })

    app.get('/txs/:txhash', (req, res, next)=>{
      const response = this.state.txs[req.params.txhash]
      console.debug('response', response)
      if (response) {
        res.status(200).send(JSON.stringify(response)).end() }
      else {
        res.status(404).end() } })

    app.get('/wasm/code/:id/hash', (req, res, next)=>{
      res.status(200).send(JSON.stringify({
        result: 'e87c2d9ec2cc89f19b60e4b927b96d4e6b5a309200f4f303f96b666546dcea33'
      })).end() })

    app.get('/wasm/contract/:address/code-hash', (req, res, next)=>{
      res.status(200).send(JSON.stringify({
        result: 'e87c2d9ec2cc89f19b60e4b927b96d4e6b5a309200f4f303f96b666546dcea33'
      })).end() })

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
      res.status(200).send(JSON.stringify({
        result: { smart: query }
      })).end() })

    app.get('/reg/consensus-io-exch-pubkey', (req, res, next)=>{
      res.status(200).send(JSON.stringify({
        result: { ioExchPubkey: "0jyiOQXsuaJzXX7KzsZJRsPqA8XQyt79mpciYm4uPkE=" }
      })).end() })

    // new in 1.2
    app.get('/bank/balances/:address', (req, res, next) => {
      res.status(200).send(JSON.stringify({
        height: this.#blockHeight,
        result: 0 })).end() })

    // new in 1.2
    app.get('/reg/tx-key', (req, res, next)=>{
      res.status(200).send(JSON.stringify({
        result: { TxKey: "0jyiOQXsuaJzXX7KzsZJRsPqA8XQyt79mpciYm4uPkE=" }
      })).end() })

    const server = app.listen(port, 'localhost', () => {
      this.#url = `http://localhost:${port}`
      console.debug(`listening on ${this.url}`)
      resolve(this) })

    this.close = () => {
      clearTimeout(this.blockIncrement)
      server.close()
    } }) }

export class MockAgent extends Agent {
  static async create (options?: Identity) { return new this() }
  get nextBlock () { return Promise.resolve() }
  get block     () { return Promise.resolve()}
  get account   () { return Promise.resolve()}
  get balance   () { return Promise.resolve()}
  async send        () {}
  async sendMany    () {}
  async upload      () {}
  async instantiate () {}
  async query       () {}
  async execute     () {}
}

export class MockDocker {

  getImage () {
    return {
      async inspect () {}
    }
  }

  pull (_image: any, callback: Function) {
    callback()
  }

  modem = {
    followProgress (
      _stream: any,
      callback: Function,
      _progress: Function
    ) {
      callback()
    }
  }

  getContainer (_id: any) {
    return {
      id: 'mockGottenContainer',
      async start () {},
    }
  }

  createContainer (options: any) {
    return {
      id: 'mockCreatedContainer',
      logs (_container: any, callback: Function) {
        const port = Object.keys(options.ExposedPorts)[0].split('/')[0]
        const server = net.createServer()
        server.on('connection', () => server.close())
        server.listen(port, 'localhost', () => {
          callback(null, { on (_, callback) {
            callback('GENESIS COMPLETE')
          } })
        })
      }
    }
  }

}
