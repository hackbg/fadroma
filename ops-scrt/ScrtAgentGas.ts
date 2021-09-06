import { Fees, BaseGas } from '@fadroma/ops'

export const denom = 'uscrt'

export class ScrtGas extends BaseGas {
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom}) } }

export const defaultFees: Fees = {
  upload: new ScrtGas(3000000),
  init:   new ScrtGas(1000000),
  exec:   new ScrtGas(1000000),
  send:   new ScrtGas( 500000), }
