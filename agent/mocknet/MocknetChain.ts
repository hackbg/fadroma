import Error from './MocknetError'
import MocknetAgent from './MocknetAgent'
import type MocknetBackend from './MocknetBackend'
import type Mocknet_CW0 from './Mocknet_CW0'
import type Mocknet_CW1 from './Mocknet_CW1'

import { Chain, ChainMode } from '../core/index'
import type {
  Address,
  AgentClass,
  AgentOpts,
  Client,
  CodeHash,
  Message,
  Uint128
} from '../index'

/** Chain instance containing a local MocknetBackend. */
export default abstract class Mocknet extends Chain {

  static variants: Record<'cw0'|'cw1', (config: any)=>Mocknet>

  /** Agent instance calling its Chain's Mocknet backend. */
  static Agent: AgentClass<MocknetAgent> // populated below

  constructor (id = 'fadroma-mocknet', options = {}) {
    super(id, { ...options, mode: ChainMode.Mocknet })
    this.log.label = 'Mocknet'
  }

  get isMocknet () { return true }

  Agent: AgentClass<MocknetAgent> = Mocknet.Agent

  defaultDenom = 'umock'

  /** Simulation of bank module. */
  balances: Record<Address, Uint128> = {}

  /** Simulation of Compute module. */
  abstract backend: MocknetBackend

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

  _height = 0

  get height () {
    return Promise.resolve(this._height)
  }

  get nextBlock () {
    this._height++
    return Promise.resolve(this._height)
  }

}
