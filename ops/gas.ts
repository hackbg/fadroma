import { Gas, Fees } from './types'

export class ScrtGas implements Gas {
  amount: Array<{amount: string, denom: string}> = []
  gas:    string
  constructor (x: number) {
    const amount = String(x)
    this.amount.push({amount, denom:'uscrt'})
    this.gas = amount
  }
}

export const defaultFees: Fees = {
  upload: new ScrtGas(3000000),
  init:   new ScrtGas(1000000),
  exec:   new ScrtGas(1000000),
  send:   new ScrtGas( 500000),
}
