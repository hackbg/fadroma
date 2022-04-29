export const ChainMode = {
  Mainnet: 'Mainnet',
  Testnet: 'Testnet',
  Devnet:  'Devnet',
  Mocknet: 'Mocknet'
}

export class Chain {
  static Mode = ChainMode
  constructor (id, options = {}) {
    if (!id) {
      throw new Error('Chain: need to pass chain id')
    }
    this.id = id
    if (options.mode) this.mode = options.mode
    if (options.url)  this.url  = options.url
  }
  id
  url
  mode
  get isMainnet () {
    return this.mode === Chain.Mode.Mainnet
  }
  get isTestnet () {
    return this.mode === Chain.Mode.Testnet
  }
  get isDevnet  () {
    return this.mode === Chain.Mode.Devnet
  }
  get isMocknet () {
    return this.mode === Chain.Mode.Mocknet
  }
  query (contract, msg) {
    throw 'not implemented'
  }
  getCodeId (address) {
    throw 'not implemented'
  }
  getLabel (address) {
    throw 'not implemented'
  }
  getHash (address) {
    throw 'not implemented'
  }
  Agent = Agent
  getAgent (options = {}) {
    return this.Agent.create(this, options)
  }
}

export class Agent {
  static async create (chain, options) {
    return new Agent(chain, options)
  }
  constructor (chain, options = {}) {
    this.chain = chain
    const { name, mnemonic } = options
    this.name = name
  }
  chain
  address
  name
  defaultDenom
  get balance () {
    return this.getBalance(this.defaultDenom)
  }
  query (contract, msg) {
    return this.chain.query(contract, msg)
  }
  getCodeId (address) {
    return this.chain.getCodeId(address)
  }
  getLabel (address) {
    return this.chain.getLabel(address)
  }
  getHash (address) {
    return this.chain.getHash(address)
  }
  getBalance (denom = this.defaultDenom) {
    return Promise.resolve(0n)
  }
  execute (contract, msg) {
    throw new Error('not implemented')
  }
  upload (blob) {
    throw new Error('not implemented')
  }
  uploadMany (blobs = []) {
    return Promise.all(blobs.map(blob=>this.upload(blob)))
  }
  instantiate (template, label, msg) {
    throw new Error('not implemented')
  }
  instantiateMany (configs = []) {
    return Promise.all(configs.map(
      ([template, label, msg])=>this.instantiate(template, label, msg)
    ))
  }
}

export class Client {
  constructor (agent, options) {
    this.agent = agent
    const { address } = options
  }
  agent
  address
  query (msg) {
    return this.agent.query(this, msg)
  }
  execute (msg) {
    this.agent.execute(this, msg)
  }
}

export class Gas {
  gas
  amount = []
  constructor (x) {
    const amount = String(x)
    this.gas = amount
  }
}
