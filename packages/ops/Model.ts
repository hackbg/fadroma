/// # Data model of Fadroma Ops
///
/// As of 2021-10-10 there are 22 types/interfaces
/// exported from this module. This is way too many,
/// and measures should be taken to remove
/// redundant/single-use interfaces.


import { URL } from 'url'
import { Directory, JSONFile } from '@hackbg/tools'
import type { DeploymentDir } from './Deployment'

export type {
  ContractMessage
} from './Core'

export type {
  ContractBuildOptions,
  ContractBuild
} from './Build'

export type {
  ContractUploadOptions,
  ContractUpload
} from './Upload'

export type {
  ContractInitOptions,
  ContractInit,
  Contract,
  ContractOptions
} from './Contract'

export type Gas = {
  amount: Array<{amount: string, denom: string}>
  gas:    string
}

export type Fees = {
  upload: Gas
  init:   Gas
  exec:   Gas
  send:   Gas
}
