import { makeChain, makeConnection, Tendermint } from '../deps.ts'
import init, { Decode } from '../pkg/fadroma_namada.js'
import type { Api } from './namadaApi.ts'
import Impl from './namadaApi.ts'
import * as Namada from './namadaTypes.ts'
import { Console } from './namadaLogs.ts'

export const coinType = 118

export const bech32Prefix = 'tnam'

export const hdAccountIndex = 0

export async function connect (properties: Parameters<typeof Tendermint.connect>[0] & {
  decoder?: string|URL|Uint8Array
}): Promise<Namada.Chain> {
  if (properties?.decoder) {
    await initDecoder(properties.decoder)
  } else {
    new Console('@fadroma/namada').warnNoDecoder()
  }
  properties ??= {} as Partial<typeof properties>
  properties.bech32Prefix ??= "tnam"
  return await Tendermint.connect(properties) as Namada.Chain
}

export async function initDecoder (decoder: string|URL|Uint8Array): Promise<Namada.Decoder> {
  if (decoder instanceof Uint8Array) {
    await init(decoder)
  } else if (decoder) {
    await init(await fetch(decoder))
  }
  return Decode as unknown as Namada.Decoder
}

export function createChain (): Namada.Chain {
  const connections: Namada.Connection[] = []
  return makeChain({
    methods: Impl,
    chain: {
      get connections () { return connections },
      getConnection: () => connections[0]
    }
  }) as Namada.Chain
}

export function createConnection (chain: Namada.Chain, url: string|URL): Namada.Connection {
  return makeConnection({
    methods: Impl,
    connection: {
      alive: true,
      get chain (): Namada.Chain {
        return chain as unknown as Namada.Chain
      },
      get decode () {
        return Decode as unknown as Namada.Decoder
      },
      abciQuery () {
        return Promise.resolve(new Uint8Array())
      },
      log: new Console(String(url)) as any,
      url,
    }
  }) as Namada.Connection
}
