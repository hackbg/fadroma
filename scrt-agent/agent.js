import { Bip39 } from '@cosmjs/crypto'
import { EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient, encodeSecp256k1Pubkey, pubkeyToAddress
       , makeSignBytes } from 'secretjs'

import { readFile, Console, bold } from '@fadroma/utilities'
import { gas, defaultFees } from './gas.js'

const { debug } = Console(import.meta.url)

/** Queries and transacts on an instance of the Secret Network
 */
export default class SecretNetworkAgent {

  /** Create a new agent with its signing pen, from a mnemonic or a keyPair.*/
  static async create ({ name = 'Anonymous', mnemonic, keyPair, ...args }={}) {
    if (mnemonic) {
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== Bip39.encode(keyPair.privkey).data) {
        warn(`keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null
      }
    } else if (keyPair) {
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic  = Bip39.encode(keyPair.privkey).data
    } else {
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair   = EnigmaUtils.GenerateNewKeyPair()
      mnemonic  = Bip39.encode(keyPair.privkey).data
    }
    const pen   = await Secp256k1Pen.fromMnemonic(mnemonic)
    return new this({name, mnemonic, keyPair, pen, ...args})
  }

  /**Create a new agent from a signing pen.*/
  constructor (options = {}) {
    const { network, pen, mnemonic, keyPair
          , name = ""
          , fees = defaultFees } = options
    const pubkey = encodeSecp256k1Pubkey(pen.pubkey)
    return Object.assign(this, {
      network, name, keyPair, mnemonic, pen, pubkey,
      API: new SigningCosmWasmClient(
        network.url,
        this.address = pubkeyToAddress(pubkey, 'secret'),
        this.sign = pen.sign.bind(pen),
        this.seed = EnigmaUtils.GenerateNewSeed(),
        this.fees = fees
      )
    })
  }

  // block time //

  /**`await` this to pause until the block height has increased.
   * (currently this queries the block height in 1000msec intervals) */
  get nextBlock () {
    return this.API.getBlock().then(({header:{height}})=>new Promise(async resolve=>{
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

  /**`await` this to get info about the current block of the network. */
  get block () { return this.API.getBlock() }

  // native token //

  /**`await` this to get the account info for this agent's address.*/
  get account () { return this.API.getAccount(this.address) }

  /**`await` this to get the current balance in the native
   * coin of the network, in its most granular denomination */
  get balance () { return this.getBalance('uscrt') }

  /**Get the current balance in a specified denomination.
   * TODO support SNIP20 tokens */
  async getBalance (denomination) {
    const account = await this.account || {}
    const balance = account.balance || []
    const inDenom = ({denom, amount}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0] || {}
    return balanceInDenom.amount || 0
  }

  /**Send some `uscrt` to an address.
   * TODO support sending SNIP20 tokens */
  async send (recipient, amount, denom = 'uscrt', memo = "") {
    if (typeof amount === 'number') amount = String(amount)
    return await this.API.sendTokens(recipient, [{denom, amount}], memo)
  }

  /**Send `uscrt` to multiple addresses.
   * TODO support sending SNIP20 tokens */
  async sendMany (txs = [], memo = "", denom = 'uscrt', fee = gas(500000 * txs.length)) {
    if (txs.length < 0) {
      throw new Error('tried to send to 0 recipients')
    }
    const from_address = this.address
    //const {accountNumber, sequence} = await this.API.getNonce(from_address)
    let accountNumber, sequence
    const msg = await Promise.all(txs.map(async ([to_address, amount])=>{
      ({accountNumber, sequence} = await this.API.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom, amount}]}
      return { type: 'cosmos-sdk/MsgSend', value }
    }))
    const signBytes = makeSignBytes(msg, fee, this.network.chainId, memo, accountNumber, sequence)
    return this.API.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }

  // compute //

  /**Upload a compiled binary to the chain, returning the code ID (among other things). */
  async upload (pathToBinary) {
    const data = await readFile(pathToBinary)
    return this.API.upload(data, {})
  }

  /**Instantiate a contract from a code ID and an init message. */
  async instantiate(instance) {
    const { codeId, initMsg = {}, label = '' } = instance
    instance.agent = this

    debug(`⭕${this.address} `+bold('init'), { codeId, label, initMsg })
    const initTx = instance.initTx = await this.API.instantiate(codeId, initMsg, label)

    debug(`⭕${this.address} `+bold('instantiated'), { codeId, label, initTx })
    instance.codeHash = await this.API.getCodeHashByContractAddr(initTx.contractAddress)

    await instance.save()
    return instance
  }

  /**Query a contract. */
  query = ({ label, address }, method='', args = null) => {
    let msg;

    if (args === null) {
      msg = method
    }
    else {
      msg = {[method]: args}
    }
    
    debug(`❔ ${this.address} `+bold('query'), { label, address, method, args })
    const response = this.API.queryContractSmart(address, msg)
    debug(`❔ ${this.address} `+bold('response'), { address, method, response })
    return response
  }

  /**Execute a contract transaction. */
  execute = ({ label, address }, method='', args = null) => {
    let msg;

    if (args === null) {
      msg = method
    }
    else {
      msg = {[method]: args}
    }
    
    debug(`❗ ${this.address} `+bold('execute'), { label, address, method, args })
    const result = this.API.execute(address, msg)
    debug(`❗ ${this.address} `+bold('result'), { label, address, method, result })
    return result
  }
}
