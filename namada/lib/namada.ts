import { Core, Tendermint } from '../deps.ts'
import init, { Decode } from '../pkg/fadroma_namada.js'
import type { Decoder } from './namadaDecode.ts'
import { Error, Console } from './namadaLog.ts'
import * as Bank  from './namadaBank.ts'
import * as Block from './namadaBlock.ts'
import * as Pos   from './namadaPos.ts'
import * as Epoch from './namadaEpoch.ts'
import * as Gov   from './namadaGov.ts'
import * as Pgf   from './namadaPgf.ts'
import * as Val   from './namadaValidator.ts'
/** A Namada chain. */
export type Chain = Tendermint.Chain & Api & {
  readonly connections: Record<string, Connection>
  connect (url?: string|URL): Connection
}
/** A connection to a Namada chain. */
export type Connection = Deps & Api
/** The dependencies expected by Namada API methods. */
export type Deps = Omit<Tendermint.Connection, 'log'> & {
  log:               Console
  chain:             () => Core.ChainRef
  fetchAbciQuery:    (path: string) => Promise<Uint8Array>
  fetchStorageValue: (key:  string) => Promise<Uint8Array>
  decoder:           Decoder
}
/** Methods available for interacting with Namada chains. */
export type Api = Tendermint.Api & Core.ToApi<typeof impl>
/** Describe a Namada chain. */
export async function chain ({ ...properties }: Parameters<typeof Tendermint.chain>[0] & {
  decoder?: string|URL|Uint8Array
}): Promise<Chain> {
  // Init the WASM translation blob.
  if (properties?.decoder) {
    properties.decoder = await initDecoder(properties.decoder) as any
  } else {
    new Console().warnNoDecoder()
  }
  properties.bech32Prefix ??= 'tnam'
  // Construct chain.
  const chain = Tendermint.chain({ ...properties }) as Chain
  // Construct one connection.
  chain.connect = (url?: string|URL): Connection => {
    if (!url) throw new Error('pass rpc url')
    url = url.toString()
    chain.connections || Object.assign(chain, { connections: chain.connections || {} })
    chain.connections[url] ??= Object.assign(
      Core.connection(chain, impl as any, url) as Connection,
      { decoder: properties.decoder }
    )
    return chain.connections[url]
  }
  return chain as Chain
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
/** Fetch a value from storage. */
export const fetchStorageValue = (api: Deps, key: string): Promise<Uint8Array> =>
  api.fetchAbciQuery(`/shell/value/${key}`)
/** Fetch core protocol parameters. */
export const fetchProtocolParameters = async (api: Deps) => {
  const { decoder } = api
  const parameters: Record<string, unknown> = {}
  await Promise.all(Object.entries(decoder.storage_keys())
    .map(([name, key])=>fetchStorageValue(api, key as string).then(binary=>{
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
  ...Val,
  fetchStorageValue,
  fetchProtocolParameters,
}
