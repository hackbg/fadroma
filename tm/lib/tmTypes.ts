import * as Base from '../deps.ts'

export interface Chain extends Base.Chain {
  bech32Prefix?: string
}

export interface Connection extends Base.Connection {
  url: string|URL
}

export interface Validator {
  address?:         Base.Address
  publicKey?:       Base.Hash
  votingPower:      bigint
  proposerPriority: bigint
}

export interface Transaction extends Base.Transaction {
  chain: Chain
  hash:  Base.Hash
}

export interface Block extends Base.Block {
  hash: unknown
}
