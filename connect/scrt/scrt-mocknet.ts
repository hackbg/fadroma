import { Stub, Console, BatchBuilder, into, ContractInstance, randomBech32, Mode } from '@fadroma/agent'
import type { Address, Message, UploadedCode, CodeId, Into } from '@fadroma/agent'
import { MOCKNET_ADDRESS_PREFIX } from './scrt-mocknet-impl'
import type { MocknetContract } from './scrt-mocknet-impl'

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
    super({ chainId: 'mocknet', ...options, chainMode: Mode.Mocknet })
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
    code:    Parameters<Stub.Agent["doInstantiate"]>[0],
    options: Parameters<Stub.Agent["doInstantiate"]>[1]
  ) {
    options = { ...options }
    options.initMsg = await into(options.initMsg)
    const { address, codeHash, label } = await this.state.instantiate(this.address, options)
    return new ContractInstance({
      chainId:  this.chainId,
      address:  address!,
      codeHash: codeHash!,
      label:    label!,
      initBy:   this.address,
      initTx:   ''
    }) as ContractInstance & { address: string }
  }

  protected async doExecute (
    ...args: Parameters<Stub.Agent["doExecute"]>
  ): Promise<unknown> {
    return await this.state.execute(this.address, ...args)
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
      throw new Error("missing address")
    }
    const instance = this.contracts[address]
    if (!instance) {
      throw new Error("wrong address")
    }
    return instance
  }

}

class ScrtMocknetBatchBuilder extends BatchBuilder<ScrtMocknet> {
  messages: any[] = []
  get log () {
    return this.agent.log.sub('(batch)')
  }
  async submit (memo = "") {
    this.log.info('Submitting mocknet batch...')
    const results = []
    for (const message of this.messages) {
      const { init, instantiate = init } = message
      if (!!init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        results.push(await this.agent.instantiate(codeId, {
          initMsg: msg, codeHash, label,
        }))
        continue
      }

      const { exec, execute = exec } = message
      if (!!exec) {
        const { sender, contract: address, codeHash, msg, funds: execSend } = exec
        results.push(await this.agent.execute({ address, codeHash }, msg, { execSend }))
        continue
      }

      this.log.warn('MocknetBatch#submit: found unknown message in batch, ignoring')
      results.push(null)
    }
    return results
  }
  save (name: string): Promise<unknown> {
    throw new Error('MocknetBatch#save: not implemented')
  }
  upload (
    ...args: Parameters<BatchBuilder<ScrtMocknet>["upload"]>
  ) {
    this.log.warn('scrt mocknet batch: not implemented')
    return this
  }
  instantiate (
    ...args: Parameters<BatchBuilder<ScrtMocknet>["instantiate"]>
  ) {
    this.log.warn('scrt mocknet batch: not implemented')
    return this
  }
  execute (
    ...args: Parameters<BatchBuilder<ScrtMocknet>["execute"]>
  ) {
    this.log.warn('scrt mocknet batch: not implemented')
    return this
  }
}
