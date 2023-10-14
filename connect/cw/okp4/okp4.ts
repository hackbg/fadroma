import { Console, Error, Config, Chain, Agent, Bundle } from '../cw-base'
import { Objectarium, objectariumCodeIds } from './okp4-objectarium'
import { Cognitarium, cognitariumCodeIds } from './okp4-cognitarium'
import { LawStone, lawStoneCodeIds } from './okp4-law-stone'

import type { Environment } from '@hackbg/conf'
import type {
  AgentClass, ClientClass, Uint128, Address, ChainId, AgentFees, CodeId
} from '@fadroma/agent'
import { Client, Fee, bindChainSupport } from '@fadroma/agent'
import type { CosmWasmClient } from '@hackbg/cosmjs-esm'

/** Configuration for OKP4 */
class OKP4Config extends Config {

  static defaultTestnetChainId: string = 'okp4-nemeton-1'

  static defaultTestnetUrl: string = 'https://okp4-testnet-rpc.polkachu.com/'
                                    //'https://okp4-testnet-api.polkachu.com/'

  constructor (options: Partial<OKP4Config> = {}, environment?: Environment) {
    super(environment)
    this.override(options)
  }

  testnetChainId: string = this.getString(
    'FADROMA_OKP4_TESTNET_CHAIN_ID',
    () => OKP4Config.defaultTestnetChainId
  )

  testnetUrl: string = this.getString(
    'FADROMA_OKP4_TESTNET_URL',
    () => OKP4Config.defaultTestnetUrl
  )

}

/** OKP4 chain. */
class OKP4Chain extends Chain {

  /** Default Agent class to use. */
  declare Agent: AgentClass<OKP4Agent>

  /** Logging handle. */
  log = new Console('OKP4Chain')

  /** Default denomination of gas token. */
  defaultDenom = OKP4Chain.defaultDenom

  constructor (options: Partial<OKP4Chain> & { config?: OKP4Config } = {
    config: new OKP4Config()
  }) {
    console.log({options})
    super(options)
  }

  /** Connect to OKP4 in testnet mode. */
  static testnet = (options: Partial<OKP4Chain> = {}): OKP4Chain => {
    const config = new OKP4Config()
    return super.testnet({
      id:  config.testnetChainId,
      url: config.testnetUrl,
      ...options||{},
    }) as OKP4Chain
  }

  /** Connect to OKP4 in testnet mode. */
  static devnet = (options: Partial<OKP4Chain> = {}): OKP4Chain => super.devnet({
    ...options||{}
  }) as OKP4Chain

  /** Get clients for all Cognitarium instances,
    * keyed by address. */
  async cognitaria ({ map = true } = {}) {
    const { api } = await this.ready
    const ids = Object.values(cognitariumCodeIds)
    return await getContractsById(this.id, api, Cognitarium, ids, map)
  }

  /** Get clients for all Objectarium instances,
    * keyed by address. */
  async objectaria ({ map = true } = {}) {
    const { api } = await this.ready
    const ids = Object.values(objectariumCodeIds)
    return await getContractsById(this.id, api, Objectarium, ids, map)
  }

  /** Get clients for all Law Stone instances,
    * keyed by address. */
  async lawStones ({ map = true } = {}) {
    const { api } = await this.ready
    const ids = Object.values(lawStoneCodeIds)
    return await getContractsById(this.id, api, LawStone, ids, map)
  }

  /** Default denomination of gas token. */
  static defaultDenom = 'uknow'

  /** @returns Fee in uscrt */
  static gas = (amount: Uint128|number) => new Fee(amount, this.defaultDenom)

  /** Set permissive fees by default. */
  static defaultFees: AgentFees = {
    upload: this.gas(1000000),
    init:   this.gas(1000000),
    exec:   this.gas(1000000),
    send:   this.gas(1000000),
  }

}

async function getContractsById <C extends Client> (
  chainId: ChainId,
  api: CosmWasmClient,
  $C: ClientClass<C>,
  ids: CodeId[],
  map = true
): Promise<
  typeof map extends true ? Map<Address, C> : Record<Address, C>
> {
  const contracts = map ? new Map() : {}

  for (const id of ids) {

    const codeId = Number(id)
    if (isNaN(codeId)) throw new Error('non-number code ID encountered')

    const { checksum: codeHash } = await api.getCodeDetails(codeId)

    const addresses = await api.getContracts(codeId)

    for (const address of addresses) {
      const contract = new $C(
        { address, codeHash, codeId: String(codeId) } as Partial<C>
      )
      contract.meta.chainId = chainId
      if (map) {
        (contracts as Map<Address, C>).set(address, contract)
      } else {
        (contracts as Record<Address, C>)[address] = contract
      }
    }

  }

  return contracts
}

/** Agent for OKP4. */
class OKP4Agent extends Agent {
  /** Logging handle. */
  log = new Console('OKP4Agent')
  /** Chain on which this agent operates. */
  declare chain: OKP4Chain
  /** The coin type in the HD derivation path */
  declare coinType: number
  /** The bech32 prefix for the account's address  */
  declare bech32Prefix: string
  /** The account index in the HD derivation path */
  declare hdAccountIndex: number
  /** Transaction fees for this agent. */
  fees = OKP4Chain.defaultFees

  constructor (options: Partial<OKP4Agent> = {}) {
    super({
      ...options||{},
      coinType: 118,
      bech32Prefix: 'okp4',
      hdAccountIndex: 0
    })
    this.log.label = `${this.address??'(no address)'} @ ${this.chain?.id??'(no chain id)'}`
  }

  /** Get clients for all Cognitarium instances,
    * keyed by address. */
  async cognitaria ({ map = true } = {}) {
    return populateAgent(map, await this.chain.cognitaria({map}), this)
  }

  /** Get clients for all Objectarium instances,
    * keyed by address. */
  async objectaria ({ map = true } = {}) {
    return populateAgent(map, await this.chain.objectaria({map}), this)
  }

  /** Get clients for all Law Stone instances,
    * keyed by address. */
  async lawStones ({ map = true } = {}) {
    return populateAgent(map, await this.chain.lawStones({map}), this)
  }
}

function populateAgent <C extends Client> (
  map: boolean,
  contracts: typeof map extends true ? Map<Address, C> : Record<Address, C>,
  agent: OKP4Agent
) {
  const values = map
    ? (contracts as unknown as Map<Address, Cognitarium>).values()
    : Object.values(contracts)
  for (const contract of values) {
    contract.agent = agent
  }
  return contracts
}

/** Transaction bundle for OKP4. */
class OKP4Bundle extends Bundle {}

bindChainSupport(OKP4Chain, OKP4Agent, OKP4Bundle)
export { OKP4Config as Config, OKP4Chain as Chain, OKP4Agent as Agent, OKP4Bundle as Bundle }

/** Connect to OKP4 testnet. */
export const testnet = (...args: Parameters<typeof OKP4Chain.testnet>) => OKP4Chain.testnet(...args)

/** Connect to local OKP4 devnet. */
export const devnet = (...args: Parameters<typeof OKP4Chain.devnet>) => OKP4Chain.devnet(...args)
