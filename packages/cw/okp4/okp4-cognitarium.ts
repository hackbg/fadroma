import type { CodeId, Uint128 } from '@fadroma/agent'
import { Chain } from '@fadroma/agent'

export type CognitariumVersion = string

/** Code IDs for versions of Cognitarium contract. */
export const cognitariumCodeIds: Record<CognitariumVersion, CodeId> = {
  "v2.1.0": "7"
}

/** OKP4 triple store. */
export class Cognitarium extends Chain.Contract {

  /** Add data to this cognitarium. */
  insert = (format: CognitariumFormat, data: string) => this.execute({
    insert_data: { format, data }
  })

  /** Query data in this cognitarium. */
  select = (
    limit:    number,
    prefixes: CognitariumPrefix[],
    select:   CognitariumSelect[],
    where:    CognitariumWhere[]
  ) => this.query({
    select: { query: { limit, prefixes, select, where } }
  })

  /** Create an init message for a cognitarium. */
  static init = (limits?: CognitariumLimits) => ({ limits })

  static ['v2.1.0'] = class Cognitarium_v2_1_0 extends Cognitarium {
    static client = this
    //static codeHash = ''
    static codeId = {
      'okp4-nemeton-1': 7
    }
  }

}

export type CognitariumLimits = {
  max_byte_size:                Uint128
  max_insert_data_byte_size:    Uint128
  max_insert_data_triple_count: Uint128
  max_query_limit:              number
  max_query_variable_count:     number
  max_triple_byte_size:         Uint128
  max_triple_count:             Uint128
}

export type CognitariumFormat = 'turtle'|'rdf_xml'|'n_triples'|'n_quads'

export type CognitariumPrefix = { prefix: string, namespace: string }

export type CognitariumSelect = { variable: string }

export type CognitariumWhere = {
  simple: {
    triple_pattern: {
      subject: { variable: string }
      predicate: { node: { named_node: string } }
      object: { variable: string }
    }
  }
}
