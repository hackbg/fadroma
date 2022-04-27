import { Chain } from '@fadroma/ops'
import { getScrtBuilder } from './ScrtBuild'
import { scrtConfig as config } from './ScrtConfig'

export interface ScrtNonce {
  accountNumber: number
  sequence:      number
}

export abstract class Scrt extends Chain {
  static getBuilder = getScrtBuilder
  static faucet = `https://faucet.secrettestnet.io/`

  async getAgent (identity = config.scrt.defaultIdentity): Promise<typeof this.Agent> {
    return (await super.getAgent(identity)) as unknown as typeof this.Agent
  }

  abstract Agent
}
