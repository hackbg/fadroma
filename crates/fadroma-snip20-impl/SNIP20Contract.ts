import {
  Agent,
  AugmentedScrtContract,
  loadSchemas,
  randomHex,
  TransactionExecutor,
  QueryExecutor
} from "@fadroma/scrt"

const decoder = new TextDecoder()
const decode = (buffer: any) => decoder.decode(buffer).trim()

import { SNIP20Transactions } from './SNIP20Transactions'
import { SNIP20Queries }      from './SNIP20Queries'
export class SNIP20Contract extends AugmentedScrtContract<SNIP20Transactions, SNIP20Queries> {
  name = 'SNIP20'

  Transactions = SNIP20Transactions
  Queries      = SNIP20Queries

  /** Return the address and code hash of this token in the format
   * required by the Factory to create a swap pair with this token */
  get asCustomToken () {
    return {
      custom_token: {
        contract_addr:   this.address,
        token_code_hash: this.codeHash
      }
    }
  }

  get info () {
    return this.q().tokenInfo()
  }

  static fromTokenSpec (agent, token: {
    custom_token: { contract_addr, token_code_hash }
  } | {
    native_token: { denom }
  }): SNIP20Contract_1_0|string {
    if (token.custom_token) {
      return new SNIP20Contract({
        agent,
        address:  token.custom_token.contract_addr,
        codeHash: token.custom_token.token_code_hash,
      })
    } else if (token.native_token) {
      return 'SCRT'
    }
  }
}

import { AugmentedScrtContract_1_0 } from '@fadroma/scrt-1.0'
const scrtContract_1_0 = new AugmentedScrtContract_1_0()
export class SNIP20Contract_1_0 extends SNIP20Contract {
  buildImage      = scrtContract_1_0.buildImage
  buildDockerfile = scrtContract_1_0.buildDockerfile
  buildScript     = scrtContract_1_0.buildScript
}

import { AugmentedScrtContract_1_2 } from '@fadroma/scrt-1.2'
const scrtContract_1_2 = new AugmentedScrtContract_1_2()
export class SNIP20Contract_1_2 extends SNIP20Contract {
  buildImage      = scrtContract_1_2.buildImage
  buildDockerfile = scrtContract_1_2.buildDockerfile
  buildScript     = scrtContract_1_2.buildScript
}
