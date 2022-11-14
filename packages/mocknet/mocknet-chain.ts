import { Chain, ChainMode } from '@fadroma/core'
import type {
  Address, AgentClass, AgentOpts, Client, CodeHash, Message, Uint128
} from '@fadroma/core'
import { MocknetAgent } from './mocknet-agent'

import type { MocknetBackend } from './mocknet-backend'
import { MocknetBackend_CW0, MocknetBackend_CW1 } from './mocknet-backend'

/** Chain instance containing a local MocknetBackend. */
export abstract class BaseMocknet extends Chain {
  /** Agent instance calling its Chain's Mocknet backend. */
  static Agent: AgentClass<MocknetAgent> // populated below

  constructor (id = 'fadroma-mocknet', options = {}) {
    super(id, { ...options, mode: ChainMode.Mocknet })
  }

  Agent: AgentClass<MocknetAgent> = BaseMocknet.Agent

  defaultDenom = 'umock'

  /** Simulation of bank module. */
  balances: Record<Address, Uint128> = {}

  /** Simulation of Compute module. */
  abstract backend: MocknetBackend

  async getAgent <A> (options: AgentOpts): Promise<A> {
    return new MocknetAgent({ ...options, chain: this }) as unknown as A
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

  get height () {
    return Promise.resolve(0)
  }

}

export class Mocknet_CW0 extends BaseMocknet {
  backend = new MocknetBackend_CW0(this.id)
}

export class Mocknet_CW1 extends BaseMocknet {
  backend = new MocknetBackend_CW1(this.id)
}

export type Mocknet = Mocknet_CW0|Mocknet_CW1
