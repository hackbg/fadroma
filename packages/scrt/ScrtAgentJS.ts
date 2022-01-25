/// # SecretJS-based agent

import { Console, readFile, bold } from '@hackbg/tools'
const console = Console('@fadroma/scrt/ScrtAgentJS')

import { Bip39 } from '@cosmjs/crypto'
import {
  EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient,
  encodeSecp256k1Pubkey, pubkeyToAddress,
  makeSignBytes, BroadcastMode
} from 'secretjs/src/index.ts'

import { BaseAgent, IAgent, Identity, IContract, ContractMessage } from '@fadroma/ops'
import { ScrtGas, defaultFees } from './ScrtGas'
import type { Scrt } from './ScrtChainAPI'

export type AgentConstructor = new(...args:any) => IAgent
export type APIConstructor = new(...args:any) => SigningCosmWasmClient

/** Queries and transacts on an instance of the Secret Chain */
export abstract class ScrtAgentJS extends BaseAgent {

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
  constructor (API: APIConstructor, options: Identity) {
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

    this.API = new API(
      this.chain.url, this.address,
      this.sign, this.seed, this.fees,
      BroadcastMode.Sync
    )
  }

  // block time //

  /**`await` this to pause until the block height has increased.
   * (currently this queries the block height in 1000msec intervals) */
  get nextBlock () {
    return waitUntilNextBlock(this)
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
  async instantiate (contract: IContract, initMsg: any) {
    const from = this.address
    const { codeId, label } = contract
    if (process.env.FADROMA_PRINT_TXS) {
      console.debug(`${bold('INIT')} ${this.constructor.name} "${label}"`, { from, codeId, label, initMsg })
    }
    const initTx = await this.API.instantiate(codeId, initMsg, label)
    Object.assign(initTx, { contractAddress: initTx.logs[0].events[0].attributes[4].value })
    if (process.env.FADROMA_PRINT_TXS) {
      console.debug(`${bold('< INIT <')} ${this.constructor.name} ${label}`, { from, codeId, label, initTx })
    }
    return initTx
  }

  /** Query a contract. */
  query (
    { label, address }: IContract,
    msg: ContractMessage,
  ) {
    const from = this.address
    const method = getMethod(msg)
    if (process.env.FADROMA_PRINT_TXS) {
      console.debug(`${bold('> QUERY >')} ${this.constructor.name}::${bold(method)}`, { from, label, address, msg })
    }
    const response = this.API.queryContractSmart(address, msg as any)
    if (process.env.FADROMA_PRINT_TXS) {
      console.debug(`${bold('< QUERY <')} ${this.constructor.name}::${method}`, { from, address, msg, response })
    }
    return response
  }

  /** Execute a contract transaction. */
  execute (
    contract: IContract,
    msg:      ContractMessage,
    memo:     any,
    amount:   any,
    fee:      any
  ) {
    const { label, address } = contract
    const from = this.address
    const method = getMethod(msg)
    if (process.env.FADROMA_PRINT_TXS) {
      console.debug(`${bold('> TX >')} ${this.constructor.name}::${method}`, { from, label, address, msg, memo, amount, fee })
    }
    const result = this.API.execute(address, msg as any, memo, amount, fee)
    if (process.env.FADROMA_PRINT_TXS) {
      console.debug(`${bold('< TX <')} ${this.constructor.name}::${method}`, { from, label, address, result })
    }
    return result
  }

  /** Create a new agent with its signing pen, from a mnemonic or a keyPair.*/
  static async createSub (
    AgentClass: AgentConstructor,
    options: Identity
  ): Promise<IAgent> {

    const { name = 'Anonymous', ...args } = options

    let { mnemonic, keyPair } = options

    let info = ''

    if (mnemonic) {
      info = bold(`Creating SecretJS agent from mnemonic:`) + ` ${name} `
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

    const pen = await Secp256k1Pen.fromMnemonic(mnemonic)

    const agent = new AgentClass({name, mnemonic, keyPair, pen, ...args})

    return agent

  }

}

export async function waitUntilNextBlock (
  agent:    ScrtAgentJS,
  interval: number = 1000
) {
  // starting height
  const {header:{height}} = await agent.API.getBlock()
  // every `interval` msec check if the height has increased
  return new Promise<void>(async resolve=>{
    while (true) {
      // wait for `interval` msec
      await new Promise(ok=>setTimeout(ok, interval))
      // get the current height
      const now = await agent.API.getBlock()
      // check if it went up
      if (now.header.height > height) {
        resolve()
        break
      }
    }
  })
}

export function getMethod (msg: ContractMessage) {
  if (typeof msg === 'string') {
    return msg
  } else {
    const keys = Object.keys(msg)
    if (keys.length !== 1) {
      throw new Error(
        `@fadroma/scrt: message must be either an object `+
        `with one root key, or a string. Found: ${keys}`
      )
    }
    return Object.keys(msg)[0]
  }
}
