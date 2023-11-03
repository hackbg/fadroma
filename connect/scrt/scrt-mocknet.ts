import { Stub, Console, BatchBuilder } from '@fadroma/agent'

/** Chain instance containing a local mocknet. */
export class ScrtMocknet extends Stub.Agent {
  log = new Console('ScrtMocknet')

  /** Current block height. Increments when accessing nextBlock */
  _height = 0

  /** Native token. */
  defaultDenom = 'umock'

  /** The address of this agent. */
  address: Address = randomBech32(MOCKNET_ADDRESS_PREFIX).slice(0,20)

  /** Map of addresses to WASM instances. */
  contracts: Record<Address, MocknetContract<'0.x'|'1.x'>> = {}

  constructor (options: Partial<ScrtMocknet> = {}) {
    super({ chainId: 'mocknet', ...options, mode: Mode.Mocknet })
    this.log.label += ` (${this.chainId})`
  }

  get isMocknet () {
    return true
  }

  get height () {
    return Promise.resolve(this._height)
  }

  get nextBlock () {
    this._height++
    return Promise.resolve(this._height)
  }

  getApi () {
    return Promise.resolve({})
  }

  get account () {
    this.log.warn('account: stub')
    return Promise.resolve({})
  }

  /** Instantiate a contract on the mocknet. */
  protected async doInstantiate (
    codeId: CodeId|Partial<UploadedCode>,
    options: {
      initMsg: Into<Message>
    }
  ): Promise<Partial<ContractInstance>> {
    options = { ...options }
    options.initMsg = await into(options.initMsg)
    const { address, codeHash, label } = await this.state.instantiate(this.address, options)
    return {
      chainId:  this.chainId,
      address:  address!,
      codeHash: codeHash!,
      label:    label!,
      initBy:   this.address,
      initTx:   ''
    }
  }

  protected async doExecute (
    contract: { address: Address },
    message:  Message,
    options?: Parameters<Agent["doExecute"]>[2]
  ): Promise<unknown> {
    return await this.state.execute(this.address, contract, message, options)
  }

  protected async doQuery <Q> (
    contract: Address|{address: Address},
    message:  Message
  ): Promise<Q> {
    return await this.mocknetQuery(contract, message)
  }

  async mocknetQuery <Q> (queried: Address|{address: Address}, message: Message): Promise<Q> {
    const contract = this.getContract(queried)
    return contract.query({ msg: message })
  }

  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any) {
    this.log.warn('send: stub')
    return Promise.resolve()
  }

  sendMany (_1:any, _2:any, _3?:any, _4?:any) {
    this.log.warn('sendMany: stub')
    return Promise.resolve()
  }

  getContract (address?: Address|{ address: Address }) {
    if (typeof address === 'object') {
      address = address.address
    }
    if (!address) {
      throw new Error.NoAddress()
    }
    const instance = this.contracts[address]
    if (!instance) {
      throw new Error.WrongAddress(address)
    }
    return instance
  }

}

class ScrtMocknetBatchBuilder extends BatchBuilder<ScrtMocknet> {
  messages: object[] = []

  get log () {
    return this.agent.log.sub('(batch)')
  }

  async submit (memo = "") {
    this.log.info('Submitting mocknet batch...')
    const results = []
    for (const {
      init,
      instantiate = init,
      exec,
      execute = exec
    } of this.messages) {
      if (!!init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        results.push(await this.agent.instantiate(codeId, {
          initMsg: msg, codeHash, label,
        }))
      } else if (!!exec) {
        const { sender, contract: address, codeHash, msg, funds: execSend } = exec
        results.push(await this.agent.execute({ address, codeHash }, msg, { execSend }))
      } else {
        this.log.warn('MocknetBatch#submit: found unknown message in batch, ignoring')
        results.push(null)
      }
    }
    return results
  }

  save (name: string): Promise<unknown> {
    throw new Error('MocknetBatch#save: not implemented')
  }

}
