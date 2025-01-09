import { Core, Tendermint } from '../deps.ts'
import init, { Decode } from '../pkg/fadroma_namada.js'
import { NamadaLogger as Console } from './namadaLogs.ts'
import type { Decoder } from './namadaDecode.ts'
import * as Bank from './namadaBank.ts'
import * as Block from './namadaBlock.ts'
import * as Pos from './namadaPos.ts'
import * as Epoch from './namadaEpoch.ts'
import * as Gov from './namadaGov.ts'
import * as Pgf from './namadaPgf.ts'
import * as Validator from './namadaValidator.ts'
/** Methods available for interacting with Namada chains. */
export type Api = Tendermint.Api & {
  fetchStorageValue:            Core.Method<typeof fetchStorageValue>
  fetchProtocolParameters:      Core.Method<typeof fetchProtocolParameters>
  fetchBalance:                 Core.Method<typeof Bank.fetchBalance>
  fetchBondWithSlashing:        Core.Method<typeof Pos.fetchBondWithSlashing>
  fetchDelegations:             Core.Method<typeof Pos.fetchDelegations>
  fetchDelegationsAt:           Core.Method<typeof Pos.fetchDelegationsAt>
  fetchStakingParameters:       Core.Method<typeof Pos.fetchStakingParameters>
  fetchTotalStaked:             Core.Method<typeof Pos.fetchTotalStaked>
  fetchEpoch:                   Core.Method<typeof Epoch.fetchEpoch>
  fetchEpochDuration:           Core.Method<typeof Epoch.fetchEpochDuration>
  fetchEpochFirstBlock:         Core.Method<typeof Epoch.fetchEpochFirstBlock>
  fetchGovernanceParameters:    Core.Method<typeof Gov.fetchGovernanceParameters>
  fetchProposalCount:           Core.Method<typeof Gov.fetchProposalCount>
  fetchProposalInfo:            Core.Method<typeof Gov.fetchProposalInfo>
  fetchProposalResult:          Core.Method<typeof Gov.fetchProposalResult>
  fetchProposalVotes:           Core.Method<typeof Gov.fetchProposalVotes>
  fetchProposalWasm:            Core.Method<typeof Gov.fetchProposalWasm>
  fetchPGFParameters:           Core.Method<typeof Pgf.fetchPGFParameters>
  fetchValidator:               Core.Method<typeof Validator.fetchValidator>
  fetchValidatorAddresses:      Core.Method<typeof Validator.fetchValidatorAddresses>
  fetchValidatorStake:          Core.Method<typeof Validator.fetchValidatorStake>
  fetchValidators:              Core.Method<typeof Validator.fetchValidators>
  fetchValidatorsBelowCapacity: Core.Method<typeof Validator.fetchValidatorsBelowCapacity>
  fetchValidatorsConsensus:     Core.Method<typeof Validator.fetchValidatorsConsensus>
  fetchValidatorsIter:          Core.Method<typeof Validator.fetchValidatorsIter>
}
/** A Namada chain. */
export type Chain = Tendermint.Chain & Api & {
  readonly connections: Record<string, Connection>,
  connect (url: string|URL): Connection
}
/** Describe a Namada chain. */
export async function chain (properties: Parameters<typeof Tendermint.chain>[0] & {
  decoder?: string|URL|Uint8Array
}): Promise<Chain> {
  // Init the WASM translation blob.
  if (properties?.decoder) {
    await initDecoder(properties.decoder)
  } else {
    new Console().warnNoDecoder()
  }
  // Set default properties.
  properties ??= {} as Partial<typeof properties>
  properties.bech32Prefix ??= "tnam"
  // Construct chain.
  const chain = Tendermint.chain({ ...properties }) as Chain
  // Construct one connection.
  Object.assign(chain, {connections: {}})
  chain.connect = (url?: string|URL) => {
    if (!url) throw new Error('pass rpc url')
    url = url.toString()
    return chain.connections[url] ??= Core.connection(chain, impl as Core.Api, url) as Connection
  }
  return chain
}
/** A connection to a Namada chain. */
export type Connection = ApiDeps & Api
/** The dependencies of Namada API methods. */
export type ApiDeps = Tendermint.Connection & {
  chain (): Core.ChainRef
  abciQuery (path: string): Promise<Uint8Array>
  fetchStorageValue (key: string): Promise<Uint8Array>
  log: Console
  decoder: Decoder
}
export const coinType = 118
export const bech32Prefix = 'tnam'
export const hdAccountIndex = 0
export const initDecoder = async (decoder: string|URL|Uint8Array): Promise<Decoder> => {
  if (decoder instanceof Uint8Array) {
    await init(decoder)
  } else if (decoder) {
    await init(await fetch(decoder))
  }
  return Decode as unknown as Decoder
}
export const fetchStorageValue = ({abciQuery}: ApiDeps, key: string): Promise<Uint8Array> =>
  abciQuery(`/shell/value/${key}`)
export const fetchProtocolParameters = async (api: ApiDeps) => {
  const { decoder } = api
  const parameters: Record<string, unknown> = {}
  await Promise.all(Object.entries(decoder.storage_keys())
    .map(([name, key])=>fetchStorageValue(
      api, key as string
    ).then(binary=>{
      if (binary.length === 0) return
      switch (name) {
        case 'gasCostTable':
          return parameters[name]=decoder.gas_cost_table(binary)
        case 'epochDuration':
          return parameters[name]=decoder.epoch_duration(binary)
        case 'maxTxBytes':
          return parameters[name]=decoder.u32(binary)
        case 'txAllowlist':
        case 'vpAllowlist':
          return parameters[name]=decoder.vec_string(binary)
        case 'isNativeTokenTransferable':
          return parameters[name]=!!binary[0]
        case 'implicitVpCodeHash':
          return parameters[name]=decoder.code_hash(binary)
        default:
          return parameters[name]=decoder.u64(binary)
      }
    })))
  return parameters
}
/** Default implementation of Namada client API. */
export const impl = {
  ...Tendermint.impl,
  ...Bank,
  ...Block,
  ...Pos,
  ...Epoch,
  ...Gov,
  ...Pgf,
  ...Validator,
  fetchStorageValue,
  fetchProtocolParameters,
}
