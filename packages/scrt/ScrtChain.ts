import { Chain } from '@fadroma/ops'
import { getScrtBuilder } from './ScrtBuild'

export interface ScrtNonce {
  accountNumber: number
  sequence:      number
}

export abstract class Scrt extends Chain {
  static getBuilder = getScrtBuilder
  static faucet = `https://faucet.secrettestnet.io/`
}

