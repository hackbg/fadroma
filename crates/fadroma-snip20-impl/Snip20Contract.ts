import { Contract, Agent } from "@fadroma/scrt"
import Scrt_1_0 from "@fadroma/scrt-1.0"
import Scrt_1_2 from "@fadroma/scrt-1.2"

import { Snip20Client } from './Snip20Client'
export { Snip20Client }

export class Snip20Contract extends Contract<Snip20Client> {
  name   = 'Snip20'

  Client = Snip20Client

  /** Return the address and code hash of this token in the format
   * required by the Factory to create a swap pair with this token */
  get asCustomToken () {
    return {
      custom_token: {
        contract_addr:   this.instance?.address,
        token_code_hash: this.instance?.codeHash
      }
    }
  }
}

export class Snip20Contract_1_0 extends Snip20Contract {
  Builder = Scrt_1_0.Builder
}

export class Snip20Contract_1_2 extends Snip20Contract {
  Builder = Scrt_1_2.Builder
}
