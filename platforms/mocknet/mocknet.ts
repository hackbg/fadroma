import { CustomConsole, bold } from '@hackbg/konzola'
import * as Fadroma from '@fadroma/client'
import { randomBech32 } from '@hackbg/formati'
import MocknetBackend, { ADDRESS_PREFIX } from './mocknet-backend'

const log = new CustomConsole('Fadroma Mocknet')

/** Chain instance containing a local MocknetBackend. */
export class Mocknet extends Fadroma.Chain {
  /** Agent instance calling its Chain's Mocknet backend. */
  static Agent: Fadroma.AgentClass<MocknetAgent> // populated below

  constructor (id = 'fadroma-mocknet', options = {}) {
    super(id, { ...options, mode: Fadroma.ChainMode.Mocknet })
  }

  Agent: Fadroma.AgentClass<MocknetAgent> = Mocknet.Agent
  balances: Record<Fadroma.Address, Fadroma.Uint128> = {}
  backend = new MocknetBackend(this.id)
  defaultDenom = 'umock'
  async getAgent <A> (options: Fadroma.AgentOpts): Promise<A> {
    return new MocknetAgent(options) as unknown as A
  }
  async query <T, U> (contract: Partial<Fadroma.Client>, msg: T): Promise<U> {
    return this.backend.query(contract, msg as Fadroma.Message)
  }
  async getHash (arg: Fadroma.Address) {
    return this.backend.instances[arg].codeHash as Fadroma.CodeHash
  }
  async getCodeId (arg: any) {
    const codeId = this.backend.codeIdForCodeHash[arg] ?? this.backend.codeIdForAddress[arg]
    if (!codeId) throw new Error(`No code id for hash ${arg}`)
    return Promise.resolve(codeId)
  }
  async getLabel (address: Fadroma.Address) {
    return this.backend.labelForAddress[address]
  }
  async getBalance (address: Fadroma.Address) {
    return this.balances[address] || '0'
  }
  get height () {
    return Promise.resolve(0)
  }
}

class MocknetAgent extends Fadroma.Agent {
  /** Message bundle that warns about unsupported messages. */
  static Bundle: Fadroma.BundleClass<MocknetBundle>

  static async create (options: Fadroma.AgentOpts) {
    return new MocknetAgent(options)
  }

  constructor (readonly options: Fadroma.AgentOpts) {
    super(options)
  }

  name:    string          = 'MocknetAgent'

  address: Fadroma.Address = randomBech32(ADDRESS_PREFIX)

  get defaultDenom () {
    return Fadroma.assertChain(this).defaultDenom
  }
  get backend (): MocknetBackend {
    return (this.chain as unknown as Mocknet).backend
  }
  async upload (blob: Uint8Array) {
    return await this.backend.upload(blob)
  }
  async instantiate (instance: Fadroma.ContractInstance): Promise<Fadroma.ContractInstance> {
    instance.initMsg = await Fadroma.into(instance.initMsg)
    const result = await this.backend.instantiate(this.address, instance,)
    return instance.provide({ agent: this, ...result })
  }
  async execute <R> (
    instance: Partial<Fadroma.Client>,
    msg:      Fadroma.Message,
    opts:     Fadroma.ExecOpts = {}
  ): Promise<R> {
    return await this.backend.execute(this.address, instance, msg, opts.send, opts.memo, opts.fee)
  }
  async query <R> (instance: Fadroma.Client, msg: Fadroma.Message): Promise<R> {
    return await Fadroma.assertChain(this).query(instance, msg)
  }
  get account () {
    return Promise.resolve({})
  }
  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any) {
    return Promise.resolve()
  }
  sendMany (_1:any, _2:any, _3?:any, _4?:any) {
    return Promise.resolve()
  }
}

class MocknetBundle extends Fadroma.Bundle {
  declare agent: MocknetAgent
  async submit (memo = "") {
    log.info('Submitting mocknet bundle...')
    const results = []
    for (const { init, exec } of this.msgs) {
      if (!!init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        results.push(await this.agent.instantiate(new Fadroma.ContractInstance({
          codeId: String(codeId), initMsg: msg, codeHash, label,
        })))
      } else if (!!exec) {
        const { sender, contract: address, codeHash, msg, funds: send } = exec
        results.push(await this.agent.execute({ address, codeHash }, msg, { send }))
      } else {
        log.warn('MocknetBundle#submit: found unknown message in bundle, ignoring')
        results.push(null)
      }
    }
    return results
  }
  save (name: string): Promise<unknown> {
    throw new Error('MocknetBundle#save: not implemented')
  }
}

Mocknet.Agent        = MocknetAgent  as Fadroma.AgentClass<MocknetAgent>
Mocknet.Agent.Bundle = MocknetBundle as Fadroma.BundleClass<MocknetBundle>

export { ADDRESS_PREFIX }
