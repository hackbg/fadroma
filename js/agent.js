import { muted } from './say.js'
import Gas from './gas.js'

import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { Bip39 } from '@cosmjs/crypto'
import { EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient, encodeSecp256k1Pubkey, pubkeyToAddress
       , makeSignBytes } from 'secretjs'

export default class SecretNetworkAgent {

  // the API endpoint

  static APIURL = process.env.SECRET_REST_URL || 'http://localhost:1337'

  // ways of creating authenticated clients

  static async fromKeyPair ({
    say     = muted(),
    name    = "",
    keyPair = EnigmaUtils.GenerateNewKeyPair(),
    ...args
  }={}) {
    const mnemonic = Bip39.encode(keyPair.privkey).data
    return await this.fromMnemonic({name, mnemonic, keyPair, say, ...args})
  }

  static async fromMnemonic ({
    say      = muted(),
    name     = "",
    mnemonic = process.env.MNEMONIC,
    keyPair, // optional
    ...args
  }={}) {
    const pen = await Secp256k1Pen.fromMnemonic(mnemonic)
    return new this({name, mnemonic, keyPair, say, pen, ...args})
  }

  // initial setup

  constructor ({
    say  = muted(),
    name = "",
    pen,
    keyPair,
    mnemonic,
    fees = Gas.defaultFees,
  }) {
    Object.assign(this, {
      name, keyPair, pen, mnemonic, fees,
      say: say.tag(`@${name}`)
    })
    this.pubkey  = encodeSecp256k1Pubkey(this.pen.pubkey)
    this.address = pubkeyToAddress(this.pubkey, 'secret')
    this.seed    = EnigmaUtils.GenerateNewSeed()
    this.sign    = pen.sign.bind(pen)
    this.API     = new SigningCosmWasmClient(
      SecretNetworkAgent.APIURL, this.address, this.sign, this.seed, this.fees
    )
    return this
  }

  // interact with the network:

  async status () {
    const {header:{time,height}} = await this.API.getBlock()
    return this.say.tag(' #status')({
      time,
      height,
      account: await this.API.getAccount(this.address)
    })
  }

  async account () {
    const account = JSON.parse(execFileSync('secretcli', [ 'query', 'account', this.address ]))
    return this.say.tag(` #account`)(account)
  }

  async time () {
    const {header:{time,height}} = await this.API.getBlock()
    return this.say.tag(' #time')({time,height})
  }

  async waitForNextBlock () {
    const {header:{height}} = await this.API.getBlock()
    this.say('waiting for next block before continuing...')
    while (true) {
      await new Promise(ok=>setTimeout(ok, 1000))
      const now = await this.API.getBlock()
      if (now.header.height > height) break
    }
  }

  async query ({ name, address }, method='', args={}) {
    this.say.tag(` #${name} #${method}?`)(args)
    const response = await this.API.queryContractSmart(address, {[method]:args})
    this.say.tag(` #${name} #${method}? #returned`)(response)
    return response
  }

  async execute ({ name, address }, method='', args={}) {
    this.say.tag(` #${name} #${method}!`)(args)
    const response = await this.API.execute(address, {[method]:args})
    this.say.tag(` #${name} #${method}! #returned`)(response)
    return response
  }

  // deploy smart contracts to the network:

  async upload ({ // upload code blob to the chain
    say=this.say,
    binary
  }) {
    // resolve binary from build folder
    binary = resolve(__dirname, '../../../build/outputs', binary)

    // check for past upload receipt
    const receipt = `${binary}.${await this.API.getChainId()}.upload`
    if (existsSync(receipt)) {
      return say.tag(' #cached')(JSON.parse(await readFile(receipt, 'utf8')))
    }

    // if no receipt, upload anew
    say.tag('uploading')(binary)
    const result = await this.API.upload(await readFile(binary), {})
    say.tag('uploaded')(result)
    await writeFile(receipt, JSON.stringify(result), 'utf8')
    return result
  }

  async instantiate ({ // call init on a new instance
    codeId, data = {}, label = ''
  }) {
    const {contractAddress: address} = await this.API.instantiate(codeId, data, label)
    const hash = await this.API.getCodeHashByContractAddr(contractAddress)
    return { codeId, label, address, hash }
  }

  async send (recipient, amount, memo = "") {
    this.say.tag(' #send')({recipient, amount, memo})
    if (typeof amount === 'number') amount = String(amount)
    return await this.API.sendTokens(recipient, [{denom: 'uscrt', amount}], memo)
  }

  async sendMany (txs = [], memo = "") {
    this.say.tag(' #sendMany')({txs})
    const chainId = await this.API.getChainId()
    const from_address = this.address
    const {accountNumber, sequence} = await this.API.getNonce(from_address)
    const msg = []
    for (let [ to_address, amount ] of txs) {
      const {accountNumber, sequence} = await this.API.getNonce(from_address)
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom: 'uscrt', amount}]}
      msg.push({ type: 'cosmos-sdk/MsgSend', value })
    }
    const fee = this.fees.send
    const bytes = makeSignBytes(msg, fee, chainId, memo, accountNumber, sequence)
    const signatures = [await this.sign(bytes)]
    const { logs, transactionHash } = await this.API.postTx({ msg, fee, memo, signatures })
  }

}
