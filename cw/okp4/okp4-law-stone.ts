import type { CodeId, Address } from '@fadroma/agent'
import { Chain } from '@fadroma/agent'

export type LawStoneVersion = string

/** Code IDs for versions of Law Stone contract. */
export const lawStoneCodeIds: Record<LawStoneVersion, CodeId> = {
  "v2.1.0": "5"
}

/** OKP4 rule engine. */
export class LawStone extends Chain.Contract {

  /** Create an init message for a law stone. */
  static init = (storage_address: Address, program: string) => ({ storage_address, program })

  /** Make a query against this law stone's program. */
  ask = (query: string) => this.query({ ask: { query } })

  /** Permanently prevent this law stone from answering further queries. */
  break = () => this.execute("break_stone")

  static ['v2.1.0'] = class LawStone_v2_1_0 extends LawStone {
    static client = this
    //static codeHash = ''
    static codeId = {
      'okp4-nemeton-1': 5
    }
  }

}
