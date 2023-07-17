import { Console, Error, Config, Chain, Agent, Bundle } from './cw-base'
import type { AgentClass, Uint128, Address } from '@fadroma/agent'
import { Client, bindChainSupport } from '@fadroma/agent'
import { StargateClient } from '@cosmjs/stargate'

class OKP4Config extends Config {
  static defaultTestnetChainId: string =
    'okp4-nemeton-1'
  static defaultTestnetUrl: string =
    'https://okp4-testnet-rpc.polkachu.com/'
    //'https://okp4-testnet-api.polkachu.com/'
  testnetChainId: string = this.getString(
    'FADROMA_OKP4_TESTNET_CHAIN_ID',
    () => OKP4Config.defaultTestnetChainId)
  testnetUrl: string = this.getString(
    'FADROMA_OKP4_TESTNET_URL',
    () => OKP4Config.defaultTestnetUrl)
}

/** OKP4 chain. */
class OKP4Chain extends Chain {
  declare Agent: AgentClass<OKP4Agent>
  log = new Console('OKP4Chain')
  defaultDenom = 'uknow'

  /** Connect to OKP4 in testnet mode. */
  static testnet = (options: Partial<OKP4Chain> = {}): OKP4Chain => super.testnet({
    id:  OKP4Config.defaultTestnetChainId,
    url: OKP4Config.defaultTestnetUrl,
    ...options||{},
  }) as OKP4Chain
}

/** Agent for OKP4. */
class OKP4Agent extends Agent {
  declare chain: OKP4Chain
  declare api?: StargateClient
  log = new Console('OKP4Agent')
  constructor (options: Partial<OKP4Agent> = {}) {
    super(options)
    this.log.label = `${this.address??'(no address)'} @ ${this.chain?.id??'(no chain id)'}`
  }
  get ready (): Promise<this & { api: StargateClient }> {
    if (this.api) return Promise.resolve(this) as Promise<this & { api: StargateClient }>
    return StargateClient.connect(this.chain.url).then(api=>Object.assign(this, { api }))
  }
}

/** Transaction bundle for OKP4. */
class OKP4Bundle extends Bundle {}

bindChainSupport(OKP4Chain, OKP4Agent, OKP4Bundle)
export { OKP4Config as Config, OKP4Chain as Chain, OKP4Agent as Agent, OKP4Bundle as Bundle }

/** Connect to OKP4 testnet. */
export const testnet = OKP4Chain.testnet

/** OKP4 triple store. */
export class Cognitarium extends Client {
  /** Create an init message for a cognitarium. */
  static init = (limits?: CognitariumLimits) =>
    ({ limits })
  /** Add data to this cognitarium. */
  insert = (format: CognitariumFormat, data: string) =>
    this.execute({ insert_data: { format, data } })
  /** Query data in this cognitarium. */
  select = (
    limit:    number,
    prefixes: CognitariumPrefix[],
    select:   CognitariumSelect[],
    where:    CognitariumWhere[]
  ) =>
    this.query({ select: { query: { limit, prefixes, select, where } } })
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

/** OKP4 object store. */
export class Objectarium extends Client {
}

/** OKP4 rule engine. */
export class LawStone extends Client {
  /** Create an init message for a law stone. */
  static init = (storage_address: Address, program: string) =>
    ({ storage_address, program })
  /** Make a query against this law stone's program. */
  ask = (query: string) =>
    this.query({ ask: { query } })
  /** Permanently prevent this law stone from answering further queries. */
  break = () =>
    this.execute("break_stone")
}
