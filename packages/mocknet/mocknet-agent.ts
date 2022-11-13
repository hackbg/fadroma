import { randomBech32 } from '@hackbg/formati'
import { Agent, Contract, assertChain, into } from '@fadroma/core'
import type {
  Address, AgentOpts, BundleClass, Client, ExecOpts, Message
} from '@fadroma/core'
import type { Mocknet } from './mocknet-chain'
import type { MocknetBundle } from './mocknet-bundle'
import { ADDRESS_PREFIX } from './mocknet-data'
import type { MocknetBackend } from './mocknet-backend'

export class MocknetAgent extends Agent {

  declare chain: Mocknet

  /** Message bundle that warns about unsupported messages. */
  static Bundle: BundleClass<MocknetBundle>

  name: string = 'MocknetAgent'

  address: Address = randomBech32(ADDRESS_PREFIX)

  constructor (readonly options: AgentOpts) {
    super(options)
  }

  get defaultDenom (): string {
    return assertChain(this).defaultDenom
  }

  get backend (): MocknetBackend {
    return (this.chain as unknown as Mocknet).backend
  }

  async upload (blob: Uint8Array) {
    return new Contract(this.backend.upload(blob))
  }

  async instantiate (instance: Contract): Promise<Contract> {
    instance.initMsg = await into(instance.initMsg)
    const result = instance.define({
      ...await this.backend.instantiate(this.address, instance),
      agent: this
    })
    return result
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
