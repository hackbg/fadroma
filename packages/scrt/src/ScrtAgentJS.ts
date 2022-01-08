/// # SecretJS-based agent

import { Console, readFile, bold } from '@fadroma/tools'
const console = Console(import.meta.url)

import { Bip39 } from '@cosmjs/crypto'
import {
  EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient,
  encodeSecp256k1Pubkey, pubkeyToAddress,
  makeSignBytes, BroadcastMode
} from 'secretjs/src/index.ts'

import { BaseAgent, IAgent, Identity } from '@fadroma/ops'
import { ScrtGas, defaultFees } from './ScrtGas'
import type { Scrt } from './ScrtChainAPI'

/** Queries and transacts on an instance of the Secret Chain */
export abstract class ScrtAgentJS extends BaseAgent {

  /** Create a new agent with its signing pen, from a mnemonic or a keyPair.*/
  static async createSub (
    AgentClass: new(...args:any)=>IAgent,
    options: Identity
  ): Promise<IAgent> {
    const { name = 'Anonymous', ...args } = options
    let { mnemonic, keyPair } = options
    let info = ''

    if (mnemonic) {
      info = `Creating SecretJS agent ${bold(name)} from mnemonic`
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== (Bip39.encode(keyPair.privkey) as any).data) {
        console.warn(`ScrtAgentJS: Keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null
      }
    } else if (keyPair) {
      info = `ScrtAgentJS: generating mnemonic from keypair for agent ${bold(name)}`
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    } else {
      info = `ScrtAgentJS: creating new SecretJS agent: ${bold(name)}`
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair  = EnigmaUtils.GenerateNewKeyPair()
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    }

    console.info(info)

    const pen = await Secp256k1Pen.fromMnemonic(mnemonic)
    return new AgentClass({name, mnemonic, keyPair, pen, ...args})

  }

  readonly API: SigningCosmWasmClient

  readonly chain:    Scrt
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
  constructor (APIConstructor: APIConstructor, options: Identity) {
    super(options)
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

    this.API = new APIConstructor(
      this.chain.url, this.address,
      this.sign, this.seed, this.fees,
      BroadcastMode.Sync
    )
  }

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
          break
        }
      }
    }))
  }

  /**`await` this to get info about the current block of the chain. */
  get block () {
    return this.API.getBlock()
  }

  // native token //

  /**`await` this to get the account info for this agent's address.*/
  get account () {
    return this.API.getAccount(this.address)
  }

  /**`await` this to get the current balance in the native
   * coin of the chain, in its most granular denomination */
  get balance () {
    return this.getBalance('uscrt')
  }

  /**Get the current balance in a specified denomination.
   * TODO support SNIP20 tokens */
  async getBalance (denomination: string) {
    const account = await this.account
    const balance = account.balance || []
    const inDenom = ({denom}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return 0
    return balanceInDenom.amount
  }

  /**Send some `uscrt` to an address.
   * TODO support sending SNIP20 tokens */
  async send (recipient: any, amount: string|number, denom = 'uscrt', memo = "") {
    if (typeof amount === 'number') amount = String(amount)
    return await this.API.sendTokens(recipient, [{denom, amount}], memo)
  }

  /**Send `uscrt` to multiple addresses.
   * TODO support sending SNIP20 tokens */
  async sendMany (
    txs   = [],
    memo  = "",
    denom = 'uscrt',
    fee   = new ScrtGas(500000 * txs.length)
  ) {
    if (txs.length < 0) {
      throw new Error('tried to send to 0 recipients')
    }

    const from_address = this.address
    //const {accountNumber, sequence} = await this.API.getNonce(from_address)

    let accountNumber: any
    let sequence:      any
    const msg = await Promise.all(txs.map(async ([to_address, amount])=>{
      ({accountNumber, sequence} = await this.API.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom, amount}]}
      return { type: 'cosmos-sdk/MsgSend', value }
    }))

    const signBytes = makeSignBytes(msg, fee, this.chain.chainId, memo, accountNumber, sequence)

    return this.API.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }

  // compute //

  /** Upload a compiled binary to the chain, returning the code ID (among other things). */
  async upload (pathToBinary: string) {
    return await this.API.upload(await readFile(pathToBinary), {})
  }

  /** Get the code hash of the contract code corresponding to a code id. */
  async getHashById (codeId: number) {
    return await this.API.getCodeHashByCodeId(codeId)
  }

  /** Get the code hash of the contract at an address. */
  async getHashByAddress (address: string) {
    return await this.API.getCodeHashByContractAddr(address)
  }

  /** Instantiate a contract from a code ID and an init message. */
  async instantiate (codeId: number, label: string, initMsg: any) {
    const from = this.address
    console.debug(`${bold('> INIT >')} ${this.constructor.name} ${label}`, { from, codeId, label, initMsg })
    const initTx = await this.API.instantiate(codeId, initMsg, label)
    Object.assign(initTx, { contractAddress: initTx.logs[0].events[0].attributes[4].value })
    console.debug(`${bold('< INIT <')} ${this.constructor.name} ${label}`, { from, codeId, label, initTx })
    return initTx
  }

  /** Query a contract. */
  query (
    { label, address },
    method = '',
    args   = null
  ) {
    const from = this.address
    const msg = (args === null) ? method : { [method]: args }
    console.debug(`${bold('> QUERY >')} ${this.constructor.name}::${method}`, { from, label, address, method, args })
    const response = this.API.queryContractSmart(address, msg as any)
    console.debug(`${bold('< QUERY <')} ${this.constructor.name}::${method}`, { from, address, method, response })
    return response
  }

  /** Execute a contract transaction. */
  execute (
    { label, address },
    method = '',
    args   = null,
    memo:   any,
    amount: any,
    fee:    any
  ) {
    const from = this.address
    const msg = (args === null) ? method : { [method]: args }
    console.debug(`${bold('> TX >')} ${this.constructor.name}::${method}`, { from, label, address, method, args, memo, amount, fee })
    const result = this.API.execute(address, msg as any, memo, amount, fee)
    console.debug(`${bold('< TX <')} ${this.constructor.name}::${method}`, { from, label, address, method, result })
    return result
  }
}
