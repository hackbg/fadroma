import { Block, Batch } from '@hackbg/fadroma'
import { CWError as Error } from './CWBase'
import { Chain } from '@hackbg/fadroma'
import { Transaction } from '@hackbg/fadroma'
import type { CWChain, CWConnection } from './CWConnection'
import type { CWAgent } from './CWIdentity'

type CWBlockParameters =
  ConstructorParameters<typeof Block>[0] & Partial<Pick<CWBlock, 'rawTransactions'>>

export class CWBlock extends Block {
  constructor (props: CWBlockParameters) {
    super(props)
    this.rawTransactions = props?.rawTransactions
  }
  /** Undecoded transactions. */
  readonly rawTransactions?: Uint8Array[]
}

/** Transaction batch for CosmWasm-enabled chains. */
export class CWBatch extends Batch {
  declare agent: CWAgent

  upload (...args: Parameters<Batch["upload"]>) {
    throw new Error("CWBatch#upload: not implemented")
    return this
  }
  instantiate (...args: Parameters<Batch["instantiate"]>) {
    throw new Error("CWBatch#instantiate: not implemented")
    return this
  }
  execute (...args: Parameters<Batch["execute"]>) {
    throw new Error("CWBatch#execute: not implemented")
    return this
  }
  async submit () {
    throw new Error("CWBatch#submit: not implemented")
  }
}

export class CWTransaction extends Transaction {}
