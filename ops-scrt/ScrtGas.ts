import type { Fees } from '@fadroma/ops'
import { BaseGas } from '@fadroma/ops'

export class ScrtGas extends BaseGas {
  static denom = 'uscrt'
  //denom = ScrtGas.denom
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom: ScrtGas.denom})
  }
}

export const defaultFees: Fees = {
  upload: new ScrtGas(3000000),
  init:   new ScrtGas(1000000),
  exec:   new ScrtGas(1000000),
  send:   new ScrtGas( 500000),
}
