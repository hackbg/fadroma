//import { bold, assign, Chain, Connection } from '@hackbg/fadroma'
//import type { Address, Message, CodeId, CodeHash, Token, ChainId } from '@hackbg/fadroma'
//import { Console, Error } from './TMBase'

//import { CWAgent, CWSigningConnection, CWIdentity, CWMnemonicIdentity, CWSignerIdentity } from './CWIdentity'
//import { CWBlock, CWBatch } from './CWTX'
//import * as CWBank    from './CWBank'
//import * as CWCompute from './CWCompute'
//import * as CWStaking from './CWStaking'

//import { Amino, Proto, CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'
//import type { Block } from '@hackbg/cosmjs-esm'

//class TendermintChain extends Chain {
  //constructor (
    //properties: ConstructorParameters<typeof Chain>[0]
      //& Pick<TendermintChain, 'coinType'|'bech32Prefix'|'hdAccountIndex'|'connections'>
  //) {
    //super(properties)
    //this.coinType       = properties.coinType
    //this.bech32Prefix   = properties.bech32Prefix
    //this.hdAccountIndex = properties.hdAccountIndex
    //this.connections    = properties.connections
  //}

  //static async connect (
    //properties: ({ url: string|URL }|{ urls: Iterable<string|URL> }) & {
      //chainId?:        ChainId,
      //bech32Prefix?:   string
      //coinType?:       number,
      //hdAccountIndex?: number
    //}
  //): Promise<TendermintChain> {
    //const {
      //chainId, url, urls = [ url ], bech32Prefix, coinType, hdAccountIndex
    //} = (properties || {}) as any
    //const chain = new this({
      //chainId,
      //connections: [],
      //bech32Prefix,
      //coinType,
      //hdAccountIndex,
    //})
    //const connections: TendermintConnection[] = urls
      //.filter(Boolean)
      //.map(async (url: string|URL)=>new this.Connection({
        //api: await CosmWasmClient.connect(String(url)),
        //chain,
        //url: String(url)
      //}))
    //if (connections.length === 0) {
      //new Console(this.constructor.name).warn(
        //'No connection URLs provided. RPC operations will fail.'
      //)
    //}
    //chain.connections = await Promise.all(connections)
    //return chain
  //}

  //[>* The bech32 prefix for the account's address  <]
  //bech32Prefix:     string
  //[>* The coin type in the HD derivation path <]
  //coinType?:        number
  //[>* The account index in the HD derivation path <]
  //hdAccountIndex?:  number

  //connections: TendermintConnection[]

  //getConnection (): TendermintConnection {
    //if (!this.connections[0]) {
      //throw new Error('No active connection.')
    //}
    //return this.connections[0]
  //}

  //async authenticate (
    //...args: Parameters<Chain["authenticate"]>
  //): Promise<CWAgent> {
    //let identity: CWIdentity
    //if (!args[0]) {
      //identity = new CWMnemonicIdentity({
        //bech32Prefix:   this.bech32Prefix,
        //coinType:       this.coinType,
        //hdAccountIndex: this.hdAccountIndex
      //})
    //} else if (typeof (args[0] as any).mnemonic === 'string') {
      //identity = new CWMnemonicIdentity({
        //mnemonic: (args[0] as any).mnemonic,
        //bech32Prefix:   this.bech32Prefix,
        //coinType:       this.coinType,
        //hdAccountIndex: this.hdAccountIndex
      //})
    //} else if (args[0] instanceof CWIdentity) {
      //identity = args[0]
    //} else if (typeof args[0] === 'object') {
      //identity = new CWIdentity(args[0] as Partial<CWIdentity>)
    //} else {
      //throw Object.assign(new Error('Invalid arguments'), { args })
    //}
    //return new CWAgent({
      //chain: this,
      //identity,
      //connection: new CWSigningConnection({
        //chain: this,
        //identity,
        //api: await SigningCosmWasmClient.connectWithSigner(
          //this.getConnection().url,
          //identity.signer,
        //)
      //})
    //})
  //}
//}

//interface TendermintConnection extends Connection {
  //readonly api: CosmWasmClient
  //readonly queryClient: ReturnType<CosmWasmClient["getQueryClient"]>
  //readonly tendermintClient: ReturnType<CosmWasmClient["getTmClient"]>
  //abciQuery <T> (path: string, params?: Uint8Array): Promise<T>
//}

//[>* Read-only client for CosmWasm-enabled chains. <]
////class TendermintConnection extends Connection {
  ////[>* API connects asynchronously, so API handle is a promise. <]
  ////declare api: CosmWasmClient

  ////constructor (properties: ConstructorParameters<typeof Connection>[0] & { api: CosmWasmClient }) {
    ////super(properties)
    ////this.api = properties.api
    //////if (!this.url) {
      //////throw new Error('No connection URL.')
    //////}
    //////if (this.identity?.signer) {
      //////this.log.debug('Connecting and authenticating via', bold(this.url))
      //////this.api = SigningCosmWasmClient.connectWithSigner(
        //////this.url,
        //////this.identity.signer
      //////)
    //////} else {
      //////this.log.debug('Connecting anonymously via', bold(this.url))
      //////this.api = CosmWasmClient.connect(this.url)
    //////}
  ////}

  ////[>* Handle to the API's internal query client. <]
  ////get queryClient (): Promise<ReturnType<CosmWasmClient["getQueryClient"]>> {
    ////return Promise.resolve(this.api).then(api=>(api as any)?.queryClient)
  ////}

  ////[>* Handle to the API's internal Tendermint transaction client. <]
  ////get tendermintClient (): Promise<ReturnType<CosmWasmClient["getTmClient"]>> {
    ////return Promise.resolve(this.api).then(api=>(api as any)?.tmClient)
  ////}

  ////abciQuery (path: string, params = new Uint8Array()) {
    ////return this.queryClient.then(async client=>{
      ////this.log.debug('ABCI query:', path)
      ////const { value } = await client!.queryAbci(path, params)
      ////return value
    ////})
  ////}

  ////async fetchBlockImpl (parameter?: { height: number|bigint }|{ hash: string }):
    ////Promise<CWBlock>
  ////{
    ////const api = await this.api
    ////if ((parameter as { height: number|bigint })?.height) {
      ////const { id, header, txs } = await api.getBlock((parameter as { height: number }).height)
      ////return new CWBlock({
        ////chain: this.chain,
        ////hash: id,
        ////height: BigInt(header.height),
        ////transactions: [],
        ////rawTransactions: txs as Uint8Array[],
      ////})
    ////} else if ((parameter as { hash: string })?.hash) {
      ////throw new Error('TendermintConnection.fetchBlock({ hash }): unimplemented!')
    ////} else {
      ////const { id, header, txs } = await api.getBlock()
      ////return new CWBlock({
        ////chain: this.chain,
        ////hash: id,
        ////height: BigInt(header.height),
        ////transactions: [],
        ////rawTransactions: txs as Uint8Array[],
      ////})
    ////}
  ////}

  ////async fetchHeightImpl () {
    ////const { height } = await this.fetchBlockImpl()
    ////return height!
  ////}

  ////[>* Query native token balance. <]
  ////fetchBalanceImpl (...args: Parameters<Connection["fetchBalanceImpl"]>) {
    ////return CWBank.fetchBalance(this, ...args)
  ////}

  ////fetchCodeInfoImpl (...args: Parameters<Connection["fetchCodeInfoImpl"]>) {
    ////return CWCompute.fetchCodeInfo(this, ...args)
  ////}

  ////fetchCodeInstancesImpl (...args: Parameters<Connection["fetchCodeInstancesImpl"]>) {
    ////return CWCompute.fetchCodeInstances(this, ...args)

  ////}

  ////fetchContractInfoImpl (...args: Parameters<Connection["fetchContractInfoImpl"]>) {
    ////return CWCompute.fetchContractInfo(this, ...args)
  ////}

  ////override async queryImpl <T> (
    ////...args: Parameters<Connection["queryImpl"]>
  ////) {
    ////return await CWCompute.query(this, ...args) as T
  ////}

  ////fetchValidatorsImpl ({ fetchDetails = false }: {
    ////fetchDetails?: boolean
  ////} = {}) {
    ////return this.tendermintClient.then(()=>CWStaking.fetchValidatorList(this, { fetchDetails }))
  ////}

  ////fetchValidatorInfoImpl (address: Address): Promise<CWStaking.Validator> {
    ////return Promise.all([
      ////this.queryClient,
      ////this.tendermintClient
    ////]).then(()=>new CWStaking.Validator({
      ////chain: this.chain,
      ////address
    ////}).fetchDetails())
  ////}
////}

//export {
  //TendermintChain as Chain,
//}

//export type {
  //TendermintConnection as Connection,
//}
