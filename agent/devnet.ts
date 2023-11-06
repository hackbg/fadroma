import { assign, Address, Console } from './base'
import type { ChainId } from './chain'
import { Agent, Mode } from './chain'

export abstract class Devnet<A extends typeof Agent> {
  /** Logger. */
  log = new Console(this.constructor.name)
  /** The chain ID that will be passed to the devnet node. */
  chainId?: ChainId
  /** Which kind of devnet to launch */
  platform?: string
  /** Is this thing on? */
  running: boolean = false
  /** URL for connecting to a remote devnet. */
  url?: string|URL

  constructor (properties?: Partial<Devnet<A>>) {
    assign(this, properties, ["chainId", "platform", "running", "url"])
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

  connect (...parameters: [A]|ConstructorParameters<A>): InstanceType<A> {
    let agent: InstanceType<A>
    if (parameters[0] instanceof Agent) {
      agent = parameters[0] as InstanceType<A>
    } else {
      const params = parameters as ConstructorParameters<A>
      if (params[0]?.name) {
        params[0] = { ...params[0] }
      }
      agent = new (this.Agent||Agent)(...params)
      if (params[0]?.chainId && params[0]?.chainId !== params[0]?.devnet?.chainId) {
        this.log.warn('chainId: ignoring override (devnet)')
      }
      if (params[0]?.url && params[0]?.url.toString() !== params[0]?.devnet?.url?.toString()) {
        this.log.warn('url: ignoring override (devnet)')
      }
      if (params[0]?.mode && params[0]?.mode !== Mode.Devnet) {
        this.log.warn('mode: ignoring override (devnet)')
      }
    }
    return Object.defineProperties(agent, {
      chainId: {
        enumerable: true, configurable: true, get: () => this.chainId, set: () => {
          throw new Error("can't override chain id of devnet")
        }
      },
      url: {
        enumerable: true, configurable: true, get: () => this.url?.toString(), set: () => {
          throw new Error("can't override url of devnet")
        }
      },
      mode: {
        enumerable: true, configurable: true, get: () => Mode.Devnet, set: () => {
          throw new Error("agent.mode: can't override")
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
