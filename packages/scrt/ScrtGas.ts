import {
  dirname, fileURLToPath, resolve,
  Fees, Gas,
  DevnetOptions, Devnet, DockerodeDevnet, ManagedDevnet,
  Path, Directory, TextFile, JSONFile, JSONDirectory,
  Client
} from '@fadroma/ops'

import type { SigningCosmWasmClient } from 'secretjs'

export class ScrtGas extends Gas {
  static denom = 'uscrt'
  static defaultFees: Fees = {
    upload: new ScrtGas(4000000),
    init:   new ScrtGas(1000000),
    exec:   new ScrtGas(1000000),
    send:   new ScrtGas( 500000),
  }
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom: ScrtGas.denom})
  }
}
