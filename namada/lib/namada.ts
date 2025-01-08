import { Tendermint } from '../deps.ts'
import init, { Decode } from '../pkg/fadroma_namada.js'
import { Console } from './namadaLogs.ts'
import type { Decoder } from './namadaDecode.ts'

import * as Bank from './namadaBank.ts'
import * as Block from './namadaBlock.ts'
import * as Pos from './namadaPos.ts'
import * as Epoch from './namadaEpoch.ts'
import * as Gov from './namadaGov.ts'
import * as Pgf from './namadaPgf.ts'
import * as Validator from './namadaValidator.ts'

export type Api = Tendermint.Api & {
  fetchStorageValue: Method<typeof fetchStorageValue>

  fetchProtocolParameters: Method<typeof fetchProtocolParameters>

  fetchBalance: Method<typeof Bank.fetchBalance>

  fetchBlockResults: Method<typeof Block.fetchBlockResults>

  fetchBondWithSlashing:  Method<typeof Pos.fetchBondWithSlashing>
  fetchDelegations:       Method<typeof Pos.fetchDelegations>
  fetchDelegationsAt:     Method<typeof Pos.fetchDelegationsAt>
  fetchStakingParameters: Method<typeof Pos.fetchStakingParameters>
  fetchTotalStaked:       Method<typeof Pos.fetchTotalStaked>

  fetchEpoch:           Method<typeof Epoch.fetchEpoch>
  fetchEpochDuration:   Method<typeof Epoch.fetchEpochDuration>
  fetchEpochFirstBlock: Method<typeof Epoch.fetchEpochFirstBlock>

  fetchGovernanceParameters: Method<typeof Gov.fetchGovernanceParameters>
  fetchProposalCount:        Method<typeof Gov.fetchProposalCount>
  fetchProposalInfo:         Method<typeof Gov.fetchProposalInfo>
  fetchProposalResult:       Method<typeof Gov.fetchProposalResult>
  fetchProposalVotes:        Method<typeof Gov.fetchProposalVotes>
  fetchProposalWasm:         Method<typeof Gov.fetchProposalWasm>

  fetchPGFParameters: Method<typeof Pgf.fetchPGFParameters>

  fetchValidator:               Method<typeof Validator.fetchValidator>
  fetchValidatorAddresses:      Method<typeof Validator.fetchValidatorAddresses>
  fetchValidatorStake:          Method<typeof Validator.fetchValidatorStake>
  fetchValidators:              Method<typeof Validator.fetchValidators>
  fetchValidatorsBelowCapacity: Method<typeof Validator.fetchValidatorsBelowCapacity>
  fetchValidatorsConsensus:     Method<typeof Validator.fetchValidatorsConsensus>
  fetchValidatorsIter:          Method<typeof Validator.fetchValidatorsIter>
}

export type Chain = Tendermint.Chain & Api & {
  readonly connections: Connection[]
  getConnection (): Connection
}

/** Describe a Namada chain. */
export async function chain (properties: Parameters<typeof Tendermint.chain>[0] & {
  decoder?: string|URL|Uint8Array
}): Promise<Chain> {
  if (properties?.decoder) {
    await initDecoder(properties.decoder)
  } else {
    new Console('@fadroma/namada').warnNoDecoder()
  }
  properties ??= {} as Partial<typeof properties>
  properties.bech32Prefix ??= "tnam"
  const connections: Connection[] = []
  const chain = Tendermint.chain({
    ...properties,
    get connections () { return connections },
    connect () { return connections[0] }
  }) as Chain
  connections.push(connection(chain, properties.url))
  return chain
}

export type ConnectionBase = Tendermint.Connection & {
  abciQuery (path: string): Promise<Uint8Array>
  readonly chain:  Chain
  readonly decode: Decoder
  readonly log:    Console
}

export function connection (chain: Chain, url: string|URL): Connection {
  return Tendermint.connection({
    methods: Impl,
    connection: {
      alive: true,
      get chain (): Chain {
        return chain as unknown as Chain
      },
      get decode () {
        return Decode as unknown as Decoder
      },
      abciQuery () {
        return Promise.resolve(new Uint8Array())
      },
      log: new Console(String(url)) as any,
      url,
    }
  }) as Connection
}

export type Connection = ConnectionBase & Api

export const coinType = 118

export const bech32Prefix = 'tnam'

export const hdAccountIndex = 0

export const api = {
  fetchStorageValue,
  fetchProtocolParameters,
  ...Bank,
  ...Block,
  ...Pos,
  ...Epoch,
  ...Gov,
  ...Pgf,
  ...Validator
}

export async function initDecoder (decoder: string|URL|Uint8Array): Promise<Decoder> {
  if (decoder instanceof Uint8Array) {
    await init(decoder)
  } else if (decoder) {
    await init(await fetch(decoder))
  }
  return Decode as unknown as Decoder
}

/** Slices first argument of implementation signature
  * (see https://stackoverflow.com/a/67605309) */
type Method<F> = F extends (arg0: never, ...rest: infer R) =>
  infer T ? ((...args: R) => T) : never

export function fetchStorageValue ({ abciQuery }: ConnectionBase, key: string): Promise<Uint8Array> {
  return abciQuery(`/shell/value/${key}`)
}

export async function fetchProtocolParameters (connection: ConnectionBase) {
  const { decode } = connection
  const parameters: Record<string, unknown> = {}
  await Promise.all(Object.entries(decode.storage_keys()).map(([name, key])=>fetchStorageValue(
    connection,
    key as string
  ).then(binary=>{
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
