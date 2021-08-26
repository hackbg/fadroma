import { Console, bold } from './command'
import { readFile } from './system'
import { Agent, Identity } from './types'
import { Contract } from './contract'
import { Scrt } from './chain'
import { ScrtGas, defaultFees } from './gas'

import { Bip39 } from '@cosmjs/crypto'
import { EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient,
         encodeSecp256k1Pubkey, pubkeyToAddress,
         makeSignBytes } from 'secretjs'

const console = Console(import.meta.url)

/** Queries and transacts on an instance of the Secret Chain */
export class ScrtJSAgent implements Agent {

  /** Create a new agent with its signing pen, from a mnemonic or a keyPair.*/
  static async create (options: Identity) {
    const { name = 'Anonymous', ...args } = options
    let { mnemonic, keyPair } = options
    if (mnemonic) {
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== (Bip39.encode(keyPair.privkey) as any).data) {
        console.warn(`keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null } }
    else if (keyPair) {
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data }
    else {
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair  = EnigmaUtils.GenerateNewKeyPair()
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data }
    const pen = await Secp256k1Pen.fromMnemonic(mnemonic)
    return new ScrtJSAgent({name, mnemonic, keyPair, pen, ...args}) }

  readonly chain:    Scrt
  readonly API:      SigningCosmWasmClient
  readonly name:     string
  readonly keyPair:  any
  readonly mnemonic: any
  readonly pen:      any
  readonly sign:     any
  readonly pubkey:   any
  readonly seed:     any
  readonly address:  string
  fees = defaultFees

  /** Create a new agent from a signing pen. */
  constructor (options: Identity) {
    this.chain    = options.chain as Scrt
    this.name     = options.name || ''
    this.keyPair  = options.keyPair
    this.mnemonic = options.mnemonic
    this.pen      = options.pen
    this.fees     = options.fees || defaultFees

    this.pubkey  = encodeSecp256k1Pubkey(options.pen.pubkey)
    this.address = pubkeyToAddress(this.pubkey, 'secret')
    this.sign    = this.pen.sign.bind(this.pen)
    this.seed    = EnigmaUtils.GenerateNewSeed()

    this.API = new SigningCosmWasmClient(
      this.chain.url, this.address, this.sign, this.seed, this.fees) }

  // block time //

  /**`await` this to pause until the block height has increased.
   * (currently this queries the block height in 1000msec intervals) */
  get nextBlock () {
    return this.API.getBlock().then(({header:{height}})=>new Promise<void>(async resolve=>{
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const now = await this.API.getBlock()
        if (now.header.height > height) {
          resolve()
          break } } })) }

  /**`await` this to get info about the current block of the chain. */
  get block () {
    return this.API.getBlock() }

  // native token //

  /**`await` this to get the account info for this agent's address.*/
  get account () {
    return this.API.getAccount(this.address) }

  /**`await` this to get the current balance in the native
   * coin of the chain, in its most granular denomination */
  get balance () {
    return this.getBalance('uscrt') }

  /**Get the current balance in a specified denomination.
   * TODO support SNIP20 tokens */
  async getBalance (denomination: string) {
    const account = await this.account
    const balance = account.balance || []
    const inDenom = ({denom}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return 0
    return balanceInDenom.amount }

  /**Send some `uscrt` to an address.
   * TODO support sending SNIP20 tokens */
  async send (recipient: any, amount: string|number, denom = 'uscrt', memo = "") {
    if (typeof amount === 'number') amount = String(amount)
    return await this.API.sendTokens(recipient, [{denom, amount}], memo) }

  /**Send `uscrt` to multiple addresses.
   * TODO support sending SNIP20 tokens */
  async sendMany (txs = [], memo = "", denom = 'uscrt', fee = new ScrtGas(500000 * txs.length)) {
    if (txs.length < 0) {
      throw new Error('tried to send to 0 recipients') }
    const from_address = this.address
    //const {accountNumber, sequence} = await this.API.getNonce(from_address)
    let accountNumber: any
      , sequence:      any
    const msg = await Promise.all(txs.map(async ([to_address, amount])=>{
      ({accountNumber, sequence} = await this.API.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom, amount}]}
      return { type: 'cosmos-sdk/MsgSend', value } }))
    const signBytes = makeSignBytes(msg, fee, this.chain.chainId, memo, accountNumber, sequence)
    return this.API.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] }) }

  // compute //

  /** Upload a compiled binary to the chain, returning the code ID (among other things). */
  async upload (pathToBinary: string) {
    const data = await readFile(pathToBinary)
    return this.API.upload(data, {}) }

  /** Instantiate a contract from a code ID and an init message. */
  async instantiate (instance: Contract) {
    const { codeId, initMsg = {}, label = '' } = instance
    instance.agent = this

    console.debug(`⭕${this.address} ${bold('init')} ${label}`, { codeId, label, initMsg })
    const initTx = instance.initTx = await this.API.instantiate(codeId, initMsg, label)

    console.debug(`⭕${this.address} ${bold('instantiated')} ${label}`, { codeId, label, initTx })
    instance.codeHash = await this.API.getCodeHashByContractAddr(initTx.contractAddress)

    instance.save()
    return instance }

  /** Query a contract. */
  query = (
    { label, address }, method = '', args = null
  ) => {
    const msg = (args === null) ? method : { [method]: args }
    console.debug(`❔ ${this.address} ${bold('query')} ${method}`,
      { label, address, method, args })
    const response = this.API.queryContractSmart(
      address, msg as any)
    console.debug(`❔ ${this.address} ${bold('response')} ${method}`,
      { address, method, response })
    return response }

  /**Execute a contract transaction. */
  execute = (
    { label, address }, method='', args = null, memo: any, transferAmount: any, fee: any
  ) => {
    const msg = (args === null) ? method : { [method]: args }
    console.debug(`❗ ${this.address} ${bold('execute')} ${method}`,
      { label, address, method, args, memo, transferAmount, fee })
    const result = this.API.execute(
      address, msg as any, memo, transferAmount, fee)
    console.debug(`❗ ${this.address} ${bold('result')} ${method}`,
      { label, address, method, result })
    return result } }
