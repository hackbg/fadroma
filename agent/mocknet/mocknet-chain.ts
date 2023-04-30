import {
  Chain, ChainMode, Agent, Bundle, Contract, assertChain, into
} from '../agent'
import type {
  AgentClass, CodeHash, Uint128,
  Address, AgentOpts, AnyContract, BundleClass, Client, ExecOpts, Message, Uploaded,
} from '../agent'

import { Error, Console } from './mocknet-base'
import { MOCKNET_ADDRESS_PREFIX, MocknetBackend_CW0, MocknetBackend_CW1 } from './mocknet-impl'
import type { MocknetBackend } from './mocknet-impl'

import { randomBech32 } from '@hackbg/4mat'

/** Chain instance containing a local MocknetBackend. */
export abstract class Mocknet extends Chain {
  Agent: AgentClass<MocknetAgent> = Mocknet.Agent

  _height = 0

  defaultDenom = 'umock'
  /** Simulation of bank module. */
  balances: Record<Address, Uint128> = {}
  /** Simulation of Compute module. */
  abstract backend: MocknetBackend

  static variants: Record<'cw0'|'cw1', (config: any)=>Mocknet>
  /** Agent instance calling its Chain's Mocknet backend. */
  static Agent: AgentClass<MocknetAgent> // populated below

  constructor (options: Partial<Mocknet> = {}) {
    super({ id: 'mocknet', ...options, mode: ChainMode.Mocknet })
    this.log.label = 'Mocknet'
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

  async query <T, U> (contract: Partial<Client>, msg: T): Promise<U> {
    return this.backend.query(contract, msg as Message)
  }
  async getHash (arg: Address) {
    return this.backend.instances[arg].codeHash as CodeHash
  }
  async getCodeId (arg: any) {
    const codeId = this.backend.codeIdForCodeHash[arg] ?? this.backend.codeIdForAddress[arg]
    if (!codeId) throw new Error(`No code id for hash ${arg}`)
    return Promise.resolve(codeId)
  }
  async getLabel (address: Address) {
    return this.backend.labelForAddress[address]
  }
  async getBalance (address: Address) {
    return this.balances[address] || '0'
  }
}

class Mocknet_CW0 extends Mocknet {
  backend = new MocknetBackend_CW0(this.id)
}

class Mocknet_CW1 extends Mocknet {
  backend = new MocknetBackend_CW1(this.id)
}

class MocknetAgent extends Agent {
  declare chain: Mocknet

  name: string = 'MocknetAgent'

  address: Address = randomBech32(MOCKNET_ADDRESS_PREFIX)

  /** Message bundle that warns about unsupported messages. */
  static Bundle: BundleClass<MocknetBundle>

  constructor (options: AgentOpts & { chain: Mocknet }) {
    super(options)
    this.chain = options.chain
    this.log.label = `${this.address} on Mocknet`
  }

  get defaultDenom (): string {
    return assertChain(this).defaultDenom
  }
  get backend (): MocknetBackend {
    const chain = this.chain
    if (!chain) throw new Error.NoChain()
    if (!chain.backend) throw new Error.NoBackend()
    return chain.backend
  }
  get account () {
    return Promise.resolve({})
  }

  async upload (blob: Uint8Array): Promise<Uploaded> {
    return new Contract(this.backend.upload(blob)) as unknown as Uploaded
  }
  async instantiate <C extends Client> (instance: Contract<C>) {
    instance.initMsg = await into(instance.initMsg)
    const result = await this.backend.instantiate(this.address, instance as unknown as AnyContract)
    return {
      chainId:  this.chain.id,
      address:  result.address!,
      codeHash: result.codeHash!,
      label:    result.label!,
      initBy:   this.address,
      initTx:   ''
    }
  }
  async execute <R> (
    instance: Partial<Client>,
    msg:      Message,
    opts:     ExecOpts = {}
  ): Promise<R> {
    return await this.backend.execute(this.address, instance, msg, opts.send, opts.memo, opts.fee)
  }
  async query <R> (instance: Client, msg: Message): Promise<R> {
    return await assertChain(this).query(instance, msg)
  }
  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any) {
    return Promise.resolve()
  }
  sendMany (_1:any, _2:any, _3?:any, _4?:any) {
    return Promise.resolve()
  }
}

class MocknetBundle extends Bundle {
  declare agent: MocknetAgent

  get log () { return new Console('Mocknet') }

  async submit (memo = "") {
    this.log.info('Submitting mocknet bundle...')
    const results = []
    for (const { init, exec } of this.msgs) {
      if (!!init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        results.push(await this.agent.instantiate(new Contract({
          codeId: String(codeId), initMsg: msg, codeHash, label,
        })))
      } else if (!!exec) {
        const { sender, contract: address, codeHash, msg, funds: send } = exec
        results.push(await this.agent.execute({ address, codeHash }, msg, { send }))
      } else {
        this.log.warn('MocknetBundle#submit: found unknown message in bundle, ignoring')
        results.push(null)
      }
    }
    return results
  }
  save (name: string): Promise<unknown> {
    throw new Error('MocknetBundle#save: not implemented')
  }
}

Object.assign(Mocknet, { Agent: Object.assign(MocknetAgent, { Bundle: MocknetBundle }) })

export {
  Mocknet       as Chain,
  Mocknet_CW0   as CW0,
  Mocknet_CW1   as CW1,
  MocknetAgent  as Agent,
  MocknetBundle as Bundle
}
