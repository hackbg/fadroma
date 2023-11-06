import { assign, Address, Console } from './base'
import type { ChainId } from './chain'
import { Agent, Mode } from './chain'

export abstract class Devnet<A extends typeof Agent> {
  /** Logger. */
  log = new Console(this.constructor.name)
  /** Which kind of devnet to launch */
  platform?: string
  /** The chain ID that will be passed to the devnet node. */
  chainId?: ChainId
  /** Is this thing on? */
  running: boolean = false
  /** URL for connecting to a remote devnet. */
  url?: string|URL

  constructor (properties?: Partial<Devnet<A>>) {
    assign(this, properties, ["platform", "chainId", "running", "url"])
  }

  abstract Agent: {
    gasToken: string
    new (...parameters: ConstructorParameters<A>): InstanceType<A>
  }

  abstract start (): Promise<this>

  abstract pause (): Promise<this>

  abstract export (...args: unknown[]): Promise<unknown>

  abstract import (...args: unknown[]): Promise<unknown>

  abstract getGenesisAccount (name: string): Promise<{ address?: Address, mnemonic?: string }>

  async connect (...parameters: [string]|[A]|ConstructorParameters<A>): Promise<InstanceType<A>> {
    let agent: InstanceType<A>
    if (parameters[0] instanceof Agent) {
      agent = parameters[0] as InstanceType<A>
    } else {
      const params = parameters as ConstructorParameters<A>
      params[0] ??= {}
      if (params[0].name) {
        params[0] = {
          ...await this.getGenesisAccount(params[0].name),
          ...params[0],
        }
      }
      params[0].chainId ??= this.chainId
      params[0].chainUrl ??= this.url?.toString()
      agent = new (this.Agent||Agent)(...params)
      if (params[0]?.chainId && params[0]?.chainId !== this.chainId) {
        this.log.warn('chainId: ignoring override (devnet)')
      }
      if (params[0]?.chainUrl && params[0]?.chainUrl.toString() !== this.url?.toString()) {
        this.log.warn('chainUrl: ignoring override (devnet)')
      }
      if (params[0]?.chainMode && params[0]?.chainMode !== Mode.Devnet) {
        this.log.warn('chainMode: ignoring override (devnet)')
      }
    }
    return Object.defineProperties(agent, {
      chainId: {
        enumerable: true, configurable: true, get: () => this.chainId, set: () => {
          throw new Error("can't override chain id of devnet")
        }
      },
      chainUrl: {
        enumerable: true, configurable: true, get: () => this.url?.toString(), set: () => {
          throw new Error("can't override chainUrl of devnet")
        }
      },
      chainMode: {
        enumerable: true, configurable: true, get: () => Mode.Devnet, set: () => {
          throw new Error("agent.chainMode: can't override")
        }
      },
      devnet: {
        enumerable: true, configurable: true, get: () => this, set: () => {
          throw new Error("agent.devnet: can't override")
        }
      },
      stopped: {
        enumerable: true, configurable: true, get: () => !(this.running), set: () => {
          throw new Error("agent.stopped: can't override")
        }
      }
    })
  }
}
