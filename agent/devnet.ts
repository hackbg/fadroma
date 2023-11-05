import { assign, Address } from './base'
import type { Agent, ChainId } from './chain'
import { Mode } from './chain'

export abstract class Devnet {
  /** The chain ID that will be passed to the devnet node. */
  chainId?: ChainId
  /** Which kind of devnet to launch */
  platform?: string
  /** Is this thing on? */
  running: boolean = false
  /** URL for connecting to a remote devnet. */
  url?: string|URL

  constructor (properties?: Partial<Devnet>) {
    assign(this, properties, ["chainId", "platform", "running", "url"])
  }

  abstract start (): Promise<this>

  abstract pause (): Promise<this>

  abstract export (...args: unknown[]): Promise<unknown>

  abstract import (...args: unknown[]): Promise<unknown>

  abstract getGenesisAccount (name: string): Promise<{ address?: Address, mnemonic?: string }>
}

/** Makes an Agent irrevocably belong to a Devnet. */
export function assignDevnet (agent: Agent, devnet: Devnet) {
  Object.defineProperties(agent, {
    chainId: {
      enumerable: true, configurable: true,
      get: () => devnet.chainId,
      set: () => {
        throw new Error("can't override chain id of devnet")
      }
    },
    url: {
      enumerable: true, configurable: true,
      get: () => devnet.url?.toString(),
      set: () => {
        throw new Error("can't override url of devnet")
      }
    },
    mode: {
      enumerable: true, configurable: true,
      get: () => Mode.Devnet,
      set: () => {
        throw new Error("chain.mode: can't override")
      }
    },
    devnet: {
      enumerable: true, configurable: true,
      get: () => devnet,
      set: () => {
        throw new Error("chain.devnet: can't override")
      }
    },
    stopped: {
      enumerable: true, configurable: true,
      get: () => !(devnet.running),
      set: () => {
        throw new Error("chain.stopped: can't override")
      }
    }
  })
}
