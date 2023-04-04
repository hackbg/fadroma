import Error from './MocknetError'
import type Mocknet from './MocknetChain'
import type MocknetBundle from './MocknetBundle'
import { ADDRESS_PREFIX } from './MocknetData'
import type MocknetBackend from './MocknetBackend'

import { Agent, Contract, assertChain, into } from '@fadroma/agent'
import type {
  Address,
  AgentOpts,
  AnyContract,
  BundleClass,
  Client,
  ExecOpts,
  Message,
  Uploaded,
} from '@fadroma/agent'

import { randomBech32 } from '@hackbg/4mat'

export default class MocknetAgent extends Agent {

  declare chain: Mocknet

  /** Message bundle that warns about unsupported messages. */
  static Bundle: BundleClass<MocknetBundle>

  name: string = 'MocknetAgent'

  address: Address = randomBech32(ADDRESS_PREFIX)

  constructor (options: AgentOpts & { chain: Mocknet }) {
    super(options)
    this.chain = options.chain
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
