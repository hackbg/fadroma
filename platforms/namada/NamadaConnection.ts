import * as CW from '@fadroma/cw'
import Block from './NamadaBlock'
import * as PoS from './NamadaPoS'
import * as PGF from './NamadaPGF'
import * as Gov from './NamadaGov'
import * as Epoch from './NamadaEpoch'
import type { Chain as Namada } from './Namada'

export default class NamadaConnection extends CW.Connection {
  get chain (): Namada {
    return super.chain as unknown as Namada
  }
  get decode () {
    return this.chain.decode
  }

  override async fetchBlockImpl (
    parameter?: ({ height: bigint|number }|{ hash: string }) & { raw?: boolean }
  ): Promise<Block> {
    if (!this.url) {
      throw new CW.Error("Can't fetch block: missing connection URL")
    }
    if (!parameter) {
      parameter = {} as any
    }
    if ('height' in parameter!) {
      return Block.fetchByHeight(this, parameter)
    } else if ('hash' in parameter!) {
      return Block.fetchByHash(this, parameter)
    } else {
      return Block.fetchByHeight(this, {})
    }
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
    return PGF.isPGFSteward(this)
  }

  fetchStakingParametersImpl () {
    return PoS.fetchStakingParameters(this)
  }
  fetchValidatorAddressesImpl () {
    return PoS.fetchValidatorAddresses(this)
  }
  fetchValidatorImpl (address: string) {
    return PoS.fetchValidator(this, address)
  }
  fetchValidatorsImpl (options?: {
    details?:         boolean,
    pagination?:      [number, number]
    allStates?:       boolean,
    addresses?:       string[],
    parallel?:        boolean,
    parallelDetails?: boolean,
  }) {
    return PoS.fetchValidators(this, options)
  }
  fetchValidatorsIterImpl (options?: { parallel?: boolean }) {
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
  fetchDelegationsAtImpl (address: string, epoch?: number) {
    return PoS.fetchDelegationsAt(this, address, epoch)
  }
  fetchTotalStakedImpl () {
    return PoS.fetchTotalStaked(this)
  }
  fetchValidatorStakeImpl (address: string) {
    return PoS.fetchValidatorStake(this, address)
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
