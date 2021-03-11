module.exports = module.exports.default = class SecretNetworkAgent {

  // the API endpoint

  static APIURL = process.env.SECRET_REST_URL || 'http://localhost:1337'

  // ways of creating authenticated clients

  static async fromKeyPair ({
    say     = require('./say').mute(),
    name    = "",
    keyPair = require('secretjs').EnigmaUtils.GenerateNewKeyPair()
  }={}) {
    const mnemonic = require('@cosmjs/crypto').Bip39.encode(keyPair.privkey).data
    return await SecretNetworkAgent.fromMnemonic({name, mnemonic, keyPair, say})
  }

  static async fromMnemonic ({
    say      = require('./say').mute(),
    name     = "",
    mnemonic = process.env.MNEMONIC,
    keyPair // optional
  }={}) {
    const pen = await require('secretjs').Secp256k1Pen.fromMnemonic(mnemonic)
    return new SecretNetworkAgent({name, pen, keyPair, say, mnemonic})
  }

  // initial setup

  constructor ({
    say  = require('./say').mute(),
    name = "",
    pen,
    keyPair,
    mnemonic,
    fees = require('./gas').defaultFees,
    secretjs: { encodeSecp256k1Pubkey, pubkeyToAddress, EnigmaUtils, SigningCosmWasmClient
              } = require('secretjs')
  }) {
    Object.assign(this, {
      name, keyPair, pen, mnemonic, fees,
      say: say.tag(`@${name}`)
    })
    this.pubkey  = encodeSecp256k1Pubkey(this.pen.pubkey)
    this.address = pubkeyToAddress(this.pubkey, 'secret')
    this.seed    = EnigmaUtils.GenerateNewSeed()
    this.sign    = pen.sign.bind(pen)
    this.API     = new (require('secretjs').SigningCosmWasmClient)(
      SecretNetworkAgent.APIURL, this.address, this.sign, this.seed, this.fees)
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
    const {execFileSync} = require('child_process')
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
    const {existsSync} = require('fs')
    const {exists, readFile, writeFile} = require('fs').promises

    // resolve binary from build folder
    binary = require('path').resolve(__dirname, '../../dist', binary)

    // check for past upload receipt
    const receipt = `${binary}.${await this.API.getChainId()}.upload`
    if (existsSync(receipt)) {
      return say.tag(' #cached')(JSON.parse(await readFile(receipt, 'utf8')))
    }

    // if no receipt, upload anew
    say.tag(' #uploading')(binary)
    const result = say.tag(' #uploaded')(await this.API.upload(await readFile(binary), {}));
    await writeFile(receipt, JSON.stringify(result), 'utf8')
    return result
  }

  async instantiate ({ // call init on a new instance
    id, data = {}, label = ''
  }) {
    const {contractAddress} = await this.API.instantiate(id, data, label)
    return {
      id, label,
      address: contractAddress,
      hash:    await this.API.getCodeHashByContractAddr(contractAddress)
    }
  }

}
