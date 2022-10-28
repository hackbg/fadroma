import { Chain, Fee } from '@fadroma/client'
import type { AgentClass, Uint128 } from '@fadroma/client'
import { ScrtConfig } from './scrt-config'
import type { ScrtAgent } from './scrt-agent'
import { ScrtConsole } from './scrt-events'

/** Base class for both implementations of Secret Network API (gRPC and Amino).
  * Represents the Secret Network in general. */
export abstract class Scrt extends Chain {

  static Config                   = ScrtConfig

  static defaultMainnetChainId    = this.Config.defaultMainnetChainId

  static defaultTestnetChainId    = this.Config.defaultTestnetChainId

  static Agent:           AgentClass<ScrtAgent> // set below

  static isSecretNetwork: boolean = true

  static defaultDenom:    string  = 'uscrt'

  static gas (amount: Uint128|number) { return new Fee(amount, this.defaultDenom) }

  static defaultFees = {
    upload: this.gas(1000000),
    init:   this.gas(1000000),
    exec:   this.gas(1000000),
    send:   this.gas(1000000),
  }

  log = new ScrtConsole('Scrt')

  Agent: AgentClass<ScrtAgent> = Scrt.Agent

  isSecretNetwork: boolean = Scrt.isSecretNetwork

  defaultDenom: string  = Scrt.defaultDenom

}
