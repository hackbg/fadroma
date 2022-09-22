import { CustomConsole, bold } from '@hackbg/konzola'
import * as Fadroma from '@fadroma/client'
import { randomBech32 } from '@hackbg/formati'
import { MocknetBackend, MOCKNET_ADDRESS_PREFIX } from './mocknet-backend'

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
  async getHash (_: any) {
    return Promise.resolve("SomeCodeHash")
  }
  async getCodeId (_: any) {
    return Promise.resolve("1")
  }
  async getLabel (address: Fadroma.Address) {
    return "SomeLabel"
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

  address: Fadroma.Address = randomBech32(MOCKNET_ADDRESS_PREFIX)

  get defaultDenom () {
    return this.assertChain().defaultDenom
  }
  get backend (): MocknetBackend {
    return (this.chain as unknown as Mocknet).backend
  }
  async upload (blob: Uint8Array) {
    return await this.backend.upload(blob)
  }
  async instantiate (
    template: Fadroma.Contract<any>, label: string, msg: Fadroma.Message, send = []
  ): Promise<Fadroma.Contract<any>> {
    return new Fadroma.Contract({
      agent: this,
      ...await this.backend.instantiate(this.address, template, label, msg, send)
    })
  }
  async execute <R> (
    instance: Partial<Fadroma.Client>, msg: Fadroma.Message, opts: Fadroma.ExecOpts = {}
  ): Promise<R> {
    return await this.backend.execute(this.address, instance, msg, opts.send, opts.memo, opts.fee)
  }
  async query <R> (instance: Fadroma.Client, msg: Fadroma.Message): Promise<R> {
    return await this.assertChain().query(instance, msg)
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
    const results = []
    for (const { init, exec } of this.msgs) {
      if (init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        const template = new Fadroma.Contract({ codeHash, codeId: String(codeId) })
        //@ts-ignore
        results.push(await this.agent.instantiate(template, label, msg, funds))
      } else if (exec) {
        const { sender, contract, codeHash, msg, funds } = exec
        results.push(await this.agent.execute({ address: contract, codeHash }, msg, { send: funds }))
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
