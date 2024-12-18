import * as CW from '@fadroma/cw'
import * as Block from './NamadaBlock.ts'
import * as PoS from './NamadaPoS.ts'
import * as PGF from './NamadaPGF.ts'
import * as Gov from './NamadaGov.ts'
import * as Epoch from './NamadaEpoch.ts'
import type { Chain as Namada } from './Namada.ts'
import { decode, u256 } from '@hackbg/borshest'

export default class NamadaConnection extends CW.Connection {
  get chain (): Namada {
    return super.chain as unknown as Namada
  }
  get decode () {
    return this.chain.decode
  }

  override async fetchBlockImpl (
    parameter?: { height: bigint|number }|{ hash: string }
  ): Promise<Block.Block> {
    if (!this.url) throw new CW.Error("Can't fetch block: missing connection URL")
    if (!parameter) parameter = {} as any
    if ('height' in parameter!) {
      return Block.fetchBlockByHeight(this, parameter)
    } else if ('hash' in parameter!) {
      throw new Error('NamadaBlock.fetchByHash: not implemented')
    } else {
      return Block.fetchBlockByHeight(this, {})
    }
  }

  fetchBlockResultsImpl (parameter?: { height?: bigint|number }) {
    return Block.fetchBlockResultsByHeight(this, parameter?.height)
  }

  override async fetchBalanceImpl (parameters: {
    addresses: Record<string, string[]>,
    parallel?: false
  }): Promise<Record<string, Record<string, string>>> {
    if (parameters.parallel) {
      this.log.warn('Parallel balance fetching on Namada is not supported yet.')
    }
    const result: Record<string, Record<string, string>> = {}
    for (const [address, tokens] of Object.entries(parameters.addresses)) {
      result[address] = {}
      for (const token of tokens) {
        if (token.split('1')[1]?.length !== 40) {
          throw new Error(`Invalid token address: ${token}`)
        }
        const balanceKey  = this.decode.balance_key(token, address)
        const balanceAbci = `/shell/value/${balanceKey}`
        const balance     = await this.abciQuery(balanceAbci)
        if (balance.length > 0) {
          result[address][token] = String(decode(u256, balance))
        } else {
          result[address][token] = "0"
        }
      }
    }
    return result
  }

  fetchStorageValueImpl (key: string) {
    return fetchStorageValue(this, key)
  }
  fetchProtocolParametersImpl () {
    return fetchProtocolParameters(this)
  }

  fetchEpochImpl (options?: { height?: number|bigint }) {
    return Epoch.fetchEpoch(this, options?.height)
  }
  fetchEpochFirstBlockImpl () {
    return Epoch.fetchEpochFirstBlock(this)
  }
  fetchEpochDurationImpl () {
    return Epoch.fetchEpochDuration(this)
  }

  fetchGovernanceParametersImpl () {
    return Gov.fetchGovernanceParameters(this)
  }
  fetchProposalCountImpl () {
    return Gov.fetchProposalCount(this)
  }
  fetchProposalInfoImpl (id: number|bigint) {
    return Gov.fetchProposalInfo(this, id)
  }
  fetchProposalVotesImpl (id: number|bigint) {
    return Gov.fetchProposalVotes(this, id)
  }
  fetchProposalResultImpl (id: number|bigint) {
    return Gov.fetchProposalResult(this, id)
  }
  fetchProposalWasmImpl (id: number|bigint) {
    return Gov.fetchProposalWasm(this, id)
  }

  fetchPGFParametersImpl () {
    return PGF.fetchPGFParameters(this)
  }
  fetchPGFStewardsImpl () {
    return PGF.fetchPGFStewards(this)
  }
  fetchPGFFundingsImpl () {
    return PGF.fetchPGFFundings(this)
  }
  isPGFStewardImpl (address: string) {
    return PGF.isPGFSteward(this, address)
  }

  fetchStakingParametersImpl () {
    return PoS.fetchStakingParameters(this)
  }
  fetchValidatorAddressesImpl () {
    return PoS.fetchValidatorAddresses(this)
  }
  fetchValidatorImpl (address: string, options?: { epoch?: Epoch.Epoch }) {
    return PoS.fetchValidator(this, address, options)
  }
  fetchValidatorsImpl (options?: {
    epoch?:           Epoch.Epoch,
    details?:         boolean,
    pagination?:      [number, number]
    allStates?:       boolean,
    addresses?:       string[],
    parallel?:        boolean,
    parallelDetails?: boolean,
  }) {
    return PoS.fetchValidators(this, options)
  }
  fetchValidatorsIterImpl (options?: {
    epoch?:    Epoch.Epoch,
    parallel?: boolean
  }) {
    return PoS.fetchValidatorsIter(this, options)
  }
  fetchValidatorsConsensusImpl () {
    return PoS.fetchValidatorsConsensus(this)
  }
  fetchValidatorsBelowCapacityImpl () {
    return PoS.fetchValidatorsBelowCapacity(this)
  }
  fetchDelegationsImpl (address: string) {
    return PoS.fetchDelegations(this, address)
  }
  fetchDelegationsAtImpl (address: string, epoch?: Epoch.Epoch) {
    return PoS.fetchDelegationsAt(this, address, epoch)
  }
  fetchTotalStakedImpl (epoch?: Epoch.Epoch) {
    return PoS.fetchTotalStaked(this, epoch)
  }
  fetchValidatorStakeImpl (address: string, epoch?: Epoch.Epoch) {
    return PoS.fetchValidatorStake(this, address, epoch)
  }
  fetchBondWithSlashingImpl (delegator: string, validator: string, epoch?: Epoch.Epoch) {
    return PoS.fetchBondWithSlashing(this, delegator, validator, epoch)
  }
  fetchDenominationImpl (token: string) {
    return Token.fetchDenomination(this, token)
  }
  fetchTotalSupplyImpl (token: string) {
    return Token.fetchTotalSupply(this, token)
  }
  fetchEffectiveNativeSupplyImpl () {
    return Token.fetchEffectiveNativeSupply(this)
  }
  fetchStakingRewardsRateImpl () {
    return Token.fetchStakingRewardsRate(this)
  }
}

export function fetchStorageValue (
  connection: Pick<NamadaConnection, 'abciQuery'>, key: string
): Promise<Uint8Array> {
  return connection.abciQuery(`/shell/value/${key}`)
}

export async function fetchProtocolParameters (
  connection: Pick<NamadaConnection, 'fetchStorageValueImpl'|'decode'>
) {
  const keys = connection.decode.storage_keys();
  const parameters: Record<string, unknown> = {}
  await Promise.all(Object.entries(connection.decode.storage_keys())
    .map(([name, key])=>connection.fetchStorageValueImpl(key).then(binary=>{
      //console.log({name, key, binary})
      if (binary.length === 0) {
        return
      }
      switch (name) {
        case 'gasCostTable':
          return parameters[name]=connection.decode.gas_cost_table(binary)
        case 'epochDuration':
          return parameters[name]=connection.decode.epoch_duration(binary)
        case 'maxTxBytes':
          return parameters[name]=connection.decode.u32(binary)
        case 'txAllowlist':
        case 'vpAllowlist':
          return parameters[name]=connection.decode.vec_string(binary)
        case 'isNativeTokenTransferable':
          return parameters[name]=!!binary[0]
        case 'implicitVpCodeHash':
          return parameters[name]=connection.decode.code_hash(binary)
        default:
          return parameters[name]=connection.decode.u64(binary)
      }
    })))
  return parameters
}
