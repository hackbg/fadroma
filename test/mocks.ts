import { Identity, Agent, Chain } from '@fadroma/ops'
import freePort from 'freeport-async'
import Express from 'express'

export class MockChain extends Chain {
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

    app.use((req, res, next)=>{
      console.log(req.url)
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
            "address": "secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy",
            "coins": [ { "denom": "uscrt", "amount": "79347500" } ],
            "public_key": "secretpub1addwnpepqghcej6wkd6gazdkx55e920tpehu906jdzpqhtgjuct9gvrzcfjeclrccvm",
            "account_number": 1073,
            "sequence": 1801 } }
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
  get block () { return Promise.resolve()}
  get account () { return Promise.resolve()}
  get balance () { return Promise.resolve()}
  async send () {}
  async sendMany () {}
  async upload () {}
  async instantiate () {}
  async query () {}
  async execute () {}
}
