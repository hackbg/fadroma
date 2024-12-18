import * as CW from '@fadroma/cw'
import type { ChainId } from '@hackbg/fadroma'
import NamadaConnection from './NamadaConnection.ts'
import type { Validator } from './NamadaPoS.ts'
import { Decode, initDecoder } from './NamadaDecode.ts'
import type { NamadaDecoder } from './NamadaDecode.ts'
import type { Epoch } from './NamadaEpoch.ts'

export default class NamadaChain extends CW.Chain {
  decode: NamadaDecoder = Decode as unknown as NamadaDecoder

  /** Connect to Namada over one or more endpoints. */
  static async connect (
    properties: Parameters<typeof CW.Chain["connect"]>[0] & {
      chainId?: ChainId
      decoder?: string|URL|Uint8Array
    }
  ): Promise<NamadaChain> {
    if (properties?.decoder) {
      await initDecoder(properties.decoder)
    } else {
      new CW.Console('@fadroma/namada').warn(
        "Decoder binary not provided; trying to decode Namada objects will fail."
      )
    }
    properties ??= {} as any
    properties.bech32Prefix ??= "tnam"
    return await super.connect(properties || ({} as any)) as NamadaChain
  }

  /** Connect to Namada using `testnetChainId` and `testnetURLs`. */
  static testnet (properties: Parameters<typeof NamadaChain["connect"]>[0]) {
    return this.connect({
      chainId: properties?.chainId || NamadaChain.testnetChainId,
      urls: (properties as any)?.url
        ? [(properties as any).url]
        : ((properties as any)?.urls || [...NamadaChain.testnetURLs]),
    })
  }

  /** Default chain ID of testnet. */
  static testnetChainId = 'tududes-test.81efb06d86523ae4f'

  /** Default RPC endpoints for testnet. */
  static testnetURLs = new Set(['https://rpc.namada.tududes.com'])

  static get Connection () {
    return NamadaConnection
  }

  getConnection (): NamadaConnection {
    return this.connections[0] as NamadaConnection
  }

  authenticate (...args: unknown[]): never {
    throw new Error('Transacting on Namada is currently not supported.')
  }

  fetchBlockResults (options?: { height?: number|bigint }) {
    return this.getConnection().fetchBlockResultsImpl(options)
  }
  fetchProtocolParameters () {
    return this.getConnection().fetchProtocolParametersImpl()
  }
  fetchStorageValue (key: string) {
    return this.getConnection().fetchStorageValueImpl(key)
  }
  fetchPGFParameters () {
    return this.getConnection().fetchPGFParametersImpl()
  }
  fetchPGFStewards () {
    return this.getConnection().fetchPGFStewardsImpl()
  }
  fetchPGFFundings () {
    return this.getConnection().fetchPGFFundingsImpl()
  }
  isPGFSteward (address: string) {
    return this.getConnection().isPGFStewardImpl(address)
  }
  fetchStakingParameters () {
    return this.getConnection().fetchStakingParametersImpl()
  }
  fetchValidatorAddresses () {
    return this.getConnection().fetchValidatorAddressesImpl()
  }
  fetchValidators (options?: {
    epoch?:           string|number|bigint,
    details?:         boolean,
    pagination?:      [number, number]
    allStates?:       boolean,
    addresses?:       string[],
    parallel?:        boolean,
    parallelDetails?: boolean,
  }): Promise<Validator[]> {
    return this.getConnection().fetchValidatorsImpl(options)
  }
  fetchValidatorsIter (options?: { parallel?: boolean }) {
    return this.getConnection().fetchValidatorsIterImpl(options)
  }
  async fetchValidatorsConsensus (options?: { max?: number, percentage?: boolean }) {
    let validators = await this.getConnection().fetchValidatorsConsensusImpl()
    if (options?.max) {
      validators = validators.slice(0, options.max)
    }
    if (options?.percentage) {
      const totalStake = Number(await this.fetchTotalStaked())
      validators = validators.map((v: Partial<Validator>)=>Object.assign(v, {
        bondedStake: Number(v.bondedStake),
        stakePercentage: (Number(v.bondedStake) / totalStake) * 100
      }))
    }
    return validators.map((v: Partial<Validator>)=>Object.assign(v, { status: 'consensus' }))
  }
  async fetchValidatorsBelowCapacity (options?: { max?: number, percentage?: boolean }) {
    let validators = await this.getConnection().fetchValidatorsBelowCapacityImpl()
    if (options?.max) {
      validators = validators.slice(0, options.max)
    }
    if (options?.percentage) {
      const totalStake = Number(await this.fetchTotalStaked())
      validators = validators.map((v: Partial<Validator>)=>Object.assign(v, {
        bondedStake: Number(v.bondedStake),
        stakePercentage: (Number(v.bondedStake) / totalStake) * 100
      }))
    }
    return validators.map((v: Partial<Validator>)=>Object.assign(v, {
      status: 'below_capacity'
    }))
  }
  fetchValidator (address: string, options?: { epoch?: Epoch }) {
    return this.getConnection().fetchValidatorImpl(address, options)
  }
  fetchValidatorStake (address: string, epoch?: Epoch) {
    return this.getConnection().fetchValidatorStakeImpl(address, epoch)
  }
  fetchBondWithSlashing (delegator: string, validator: string, epoch?: Epoch) {
    return this.getConnection().fetchBondWithSlashingImpl(delegator, validator, epoch)
  }
  fetchDelegations (address: string) {
    return this.getConnection().fetchDelegationsImpl(address)
  }
  fetchDelegationsAt (address: string, epoch?: Epoch) {
    return this.getConnection().fetchDelegationsAtImpl(address, epoch)
  }
  fetchGovernanceParameters () {
    return this.getConnection().fetchGovernanceParametersImpl()
  }
  fetchProposalCount () {
    return this.getConnection().fetchProposalCountImpl()
  }
  fetchProposalInfo (id: number|bigint) {
    return this.getConnection().fetchProposalInfoImpl(id)
  }
  fetchProposalVotes (id: number|bigint) {
    return this.getConnection().fetchProposalVotesImpl(id)
  }
  fetchProposalResult (id: number|bigint) {
    return this.getConnection().fetchProposalResultImpl(id)
  }
  fetchProposalWasm (id: number|bigint) {
    return this.getConnection().fetchProposalWasmImpl(id)
  }
  fetchEpoch (...args: Parameters<NamadaConnection["fetchEpochImpl"]>) {
    return this.getConnection().fetchEpochImpl(...args)
  }
  fetchEpochFirstBlock () {
    return this.getConnection().fetchEpochFirstBlockImpl()
  }
  fetchEpochDuration () {
    return this.getConnection().fetchEpochDurationImpl()
  }
  fetchTotalStaked (epoch?: Epoch) {
    return this.getConnection().fetchTotalStakedImpl(epoch)
  }
  fetchDenomination (token: string) {
    return this.getConnection().fetchDenominationImpl(token)
  }
  fetchTotalSupply (token: string) {
    return this.getConnection().fetchTotalSupplyImpl(token)
  }
  fetchEffectiveNativeSupply () {
    return this.getConnection().fetchEffectiveNativeSupplyImpl()
  }
  fetchStakingRewardsRate () {
    return this.getConnection().fetchStakingRewardsRateImpl()
  }
}
