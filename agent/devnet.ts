import type { Agent } from './chain'
import { Mode } from './chain'

/** Interface for Devnet (implementation is in @hackbg/fadroma). */
export interface DevnetHandle {
  accounts: string[]
  chainId:  string
  platform: string
  running:  boolean
  stateDir: string
  url:      URL

  containerId?: string
  imageTag?:    string
  port?:        string|number

  start (): Promise<this>
  getAccount (name: string): Promise<Partial<Agent>>
  assertPresence (): Promise<void>
}

export function assignDevnet (agent: Agent, devnet: DevnetHandle) {
  Object.defineProperties(agent, {
    id: {
      enumerable: true, configurable: true,
      get: () => devnet.chainId,
      set: () => {
        throw new Error("can't override chain id of devnet")
      }
    },
    url: {
      enumerable: true, configurable: true,
      get: () => devnet.url.toString(),
      set: () => {
        throw new Error("can't override url of devnet")
      }
    },
    'mode': {
      enumerable: true, configurable: true,
      get: () => Mode.Devnet,
      set: () => {
        throw new Error("chain.mode: can't override")
      }
    },
    'devnet': {
      enumerable: true, configurable: true,
      get: () => devnet,
      set: () => {
        throw new Error("chain.devnet: can't override")
      }
    },
    'stopped': {
      enumerable: true, configurable: true,
      get: () => !(devnet.running),
      set: () => {
        throw new Error("chain.stopped: can't override")
      }
    }
  })
}
