import {
  IAgent,
  AugmentedScrtContract,
  AugmentedScrtContract_1_0,
  AugmentedScrtContract_1_2,
  loadSchemas,
  randomHex,
  TransactionExecutor,
  QueryExecutor
} from "@fadroma/scrt";

// @ts-ignore
const decoder = new TextDecoder();
const decode = (buffer: any) => decoder.decode(buffer).trim();

import { SNIP20Transactions } from './SNIP20Transactions'
import { SNIP20Queries }      from './SNIP20Queries'
export class SNIP20Contract extends AugmentedScrtContract<SNIP20Transactions, SNIP20Queries> {

  Transactions = SNIP20Transactions

  Queries      = SNIP20Queries

  static schema = loadSchemas(import.meta.url, {
    initMsg:      "./schema/init_msg.json",
    queryMsg:     "./schema/query_msg.json",
    queryAnswer:  "./schema/query_answer.json",
    handleMsg:    "./schema/handle_msg.json",
    handleAnswer: "./schema/handle_answer.json",
  });

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

}

// Set build config:

const scrtContract_1_0 = new AugmentedScrtContract_1_0()

export class SNIP20Contract_1_0 extends SNIP20Contract {
  // @ts-ignore
  buildImage      = scrtContract_1_0.buildImage

  buildDockerfile = scrtContract_1_0.buildDockerfile

  // @ts-ignore
  buildScript     = scrtContract_1_0.buildScript
}

const scrtContract_1_2 = new AugmentedScrtContract_1_2()

export class SNIP20Contract_1_2 extends SNIP20Contract {
  // @ts-ignore
  buildImage      = scrtContract_1_2.buildImage

  buildDockerfile = scrtContract_1_2.buildDockerfile

  // @ts-ignore
  buildScript     = scrtContract_1_2.buildScript
}
