import { Console, Error, Config, Agent, BatchBuilder } from '../cw-base'
import { Objectarium, objectariumCodeIds } from './okp4-objectarium'
import { Cognitarium, cognitariumCodeIds } from './okp4-cognitarium'
import { LawStone, lawStoneCodeIds } from './okp4-law-stone'

import type { Environment } from '@hackbg/conf'
import type {
  AgentClass, ContractClientClass, Uint128, Address, ChainId, CodeId
} from '@fadroma/agent'
import { ContractClient, Token, bindAgentSupport } from '@fadroma/agent'
import type { CosmWasmClient } from '@hackbg/cosmjs-esm'

/** Configuration for OKP4 */
class OKP4Config extends Config {
  static defaultTestnetChainId: string = 'okp4-nemeton-1'
  static defaultTestnetUrl: string = 'https://okp4-testnet-rpc.polkachu.com/'//'https://okp4-testnet-api.polkachu.com/'
  constructor (options: Partial<OKP4Config> = {}, environment?: Environment) {
    super(environment)
    this.override(options)
  }
  testnetChainId: string = this.getString('FADROMA_OKP4_TESTNET_CHAIN_ID',
    () => OKP4Config.defaultTestnetChainId)
  testnetUrl: string = this.getString('FADROMA_OKP4_TESTNET_URL',
    () => OKP4Config.defaultTestnetUrl)
}

/** Agent for OKP4. */
class OKP4Agent extends Agent {
  /** Connect to OKP4 in testnet mode. */
  static testnet = (options: Partial<OKP4Agent> = {}): OKP4Agent => {
    const config = new OKP4Config()
    return super.testnet({
      id:  config.testnetChainId,
      url: config.testnetUrl,
      ...options||{},
    }) as OKP4Agent
  }
  /** Connect to OKP4 in testnet mode. */
  static devnet = (options: Partial<OKP4Agent> = {}): OKP4Agent => {
    throw new Error('Devnet not installed. Import @hackbg/fadroma')
  }
  /** Logging handle. */
  log = new Console('OKP4')
  /** Default denomination of gas token. */
  static defaultDenom = 'uknow'
  /** Default denomination of gas token. */
  defaultDenom = OKP4Agent.defaultDenom
  /** @returns Token.Fee in uknow */
  static gas = (amount: Uint128|number) => new Token.Fee(amount, this.defaultDenom)

  /** The coin type in the HD derivation path */
  declare coinType: number
  /** The bech32 prefix for the account's address  */
  declare bech32Prefix: string
  /** The account index in the HD derivation path */
  declare hdAccountIndex: number
  /** Transaction fees for this agent. */
  fees = {
    upload: OKP4Agent.gas(10000000),
    init:   OKP4Agent.gas(1000000),
    exec:   OKP4Agent.gas(1000000),
    send:   OKP4Agent.gas(1000000),
  }

  constructor (options: Partial<OKP4Agent> & { config?: OKP4Config } = {
    config: new OKP4Config()
  }) {
    super({
      ...options||{},
      coinType: 118,
      bech32Prefix: 'okp4',
      hdAccountIndex: 0
    })
    this.log.label = `${this.address??'(no address)'} @ ${this.chainId??'(no chain id)'}`
  }

  /** Get clients for all Cognitarium instances,
    * keyed by address. */
  async cognitaria ({ map = true } = {}) {
    const ids = Object.values(cognitariumCodeIds)
    return await this.getContractsById(Cognitarium, ids, map)
  }

  /** Get clients for all Objectarium instances,
    * keyed by address. */
  async objectaria ({ map = true } = {}) {
    const ids = Object.values(objectariumCodeIds)
    return await this.getContractsById(Objectarium, ids, map)
  }

  /** Get clients for all Law Stone instances,
    * keyed by address. */
  async lawStones ({ map = true } = {}) {
    const ids = Object.values(lawStoneCodeIds)
    return await this.getContractsById(LawStone, ids, map)
  }

  async getContractsById <C extends ContractClient> (
    Client: ContractClientClass<C> = ContractClient as ContractClientClass<C>,
    ids: CodeId[],
    map = true
  ): Promise<
    typeof map extends true ? Map<Address, C> : Record<Address, C>
  > {
    const chainId = this.chainId
    const contracts = map ? new Map() : {}
    for (const id of ids) {
      const codeId = Number(id)
      if (isNaN(codeId)) throw new Error('non-number code ID encountered')
      const { checksum: codeHash } = await this.api.getCodeDetails(codeId)
      const addresses = await this.api.getContracts(codeId)
      for (const address of addresses) {
        const contract = new Client(
          { address, codeHash, chainId, codeId: String(codeId) },
          this
        )
        if (map) {
          (contracts as Map<Address, C>).set(address, contract)
        } else {
          (contracts as Record<Address, C>)[address] = contract
        }
      }
    }
    return contracts
  }
}

export { OKP4Config as Config, OKP4Agent as Agent, }

/** Connect to OKP4 testnet. */
export const testnet = (...args: Parameters<typeof OKP4Agent.testnet>) => OKP4Agent.testnet(...args)

/** Connect to local OKP4 devnet. */
export const devnet = (...args: Parameters<typeof OKP4Agent.devnet>) => OKP4Agent.devnet(...args)

export * from './okp4-cognitarium'
export * from './okp4-objectarium'
export * from './okp4-law-stone'
