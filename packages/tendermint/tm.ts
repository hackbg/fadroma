//export * as CosmJS from '@hackbg/cosmjs-esm'
//export * from './TMBase'
//export * from './TMChain'

//export {
  //TMBlock       as Block,
  //TMTransaction as Transaction,
  //TMBatch       as Batch,
//} from './TMTX'
//export {
  //TMIdentity         as Identity,
  //TMSignerIdentity   as SignerIdentity,
  //TMMnemonicIdentity as MnemonicIdentity,
  //encodeSecp256k1Signature
//} from './TMIdentity'
//export * from './TMChains'
//export * as Staking from './TMStaking'
//import { TMChain } from './TMConnection'

//export function connect (...args: Parameters<typeof TMChain.connect>) {
  //return TMChain.connect(...args)
//}

import type { Chain, Connection } from '@hackbg/fadroma'
import { makeChain, makeConnection } from '@hackbg/fadroma'

export async function connect (): Promise<TendermintChain> {
  return {
    ...makeChain()
  }
}

interface TendermintChain extends Chain {}

interface TendermintConnection extends Connection {}

export type {
  TendermintChain as Chain,
  TendermintConnection as Connection,
}
