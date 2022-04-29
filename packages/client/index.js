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
    if (options.url)  this.url  = options.url
    if (options.mode) this.mode = options.mode
    if (options.node) {
      if (options.mode === Chain.Mode.Devnet) {
        this.node = options.node
      } else {
        console.warn('Chain: "node" option passed to non-devnet. Ignoring')
      }
    }
  }
  id
  url
  mode
  node
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
  async getAgent (options = {}) {
    if (!options.mnemonic && options.name && this.node) {
      console.info('Using devnet genesis account:', options.name)
      options = await this.node.getGenesisAccount(options.name)
    }
    return await this.Agent.create(this, options)
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
  getClient (Client, options = {}) {
    return new Client(this, options)
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
      async ([template, label, msg])=>Object.assign(await this.instantiate(template, label, msg), {
        codeHash: template.codeHash
      })
    ))
  }
}

export class Client {
  constructor (agent, options = {}) {
    this.agent = agent
    const { address, codeHash } = options
    this.address  = address
    this.codeHash = codeHash
  }
  agent
  name
  codeHash
  codeId
  label
  address
  async query (msg) {
    return await this.agent.query(this, msg)
  }
  async execute (msg) {
    return await this.agent.execute(this, msg)
  }
  async populate () {
    const [label, codeId, codeHash] = await Promise.all([
      this.agent.getLabel(this.address),
      this.agent.getCodeId(this.address),
      this.agent.getHash(this.address)
    ])
    // TODO warn if retrieved values contradict current ones
    this.label    = label
    this.codeId   = codeId
    this.codeHash = codeHash
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
