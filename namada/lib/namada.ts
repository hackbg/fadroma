import { tendermintConnect } from '../deps.ts'
import init, { Decode } from '../pkg/fadroma_namada.js'
import type { Api } from './namadaApi.ts'
import Impl from './namadaApi.ts'
import * as Namada from './namadaTypes.ts'
import { Console } from './namadaLogs.ts'

export const coinType = 118

export const bech32Prefix = 'tnam'

export const hdAccountIndex = 0

export async function connect (
  properties: Parameters<typeof tendermintConnect>[0] & { decoder?: string|URL|Uint8Array }
): Promise<Namada.Chain> {
  if (properties?.decoder) {
    await initDecoder(properties.decoder)
  } else {
    new Console('@fadroma/namada').warnNoDecoder()
  }
  properties ??= {} as Partial<typeof properties>
  properties.bech32Prefix ??= "tnam"
  return await tendermintConnect(properties || ({} as Partial<typeof properties>)) as Namada.Chain
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
  const chain: Partial<Namada.Chain> & Pick<Namada.Chain, 'connections'|'getConnection'> = {
    get connections () {
      return connections
    },
    getConnection () {
      return connections[0]
    }
  }
  for (const [methodName, method] of Object.entries(Impl)) {
    const name = methodName as keyof Api
    type Conn = ReturnType<Namada.Chain["getConnection"]>
    type Args = Parameters<typeof method>
    type Retd = ReturnType<typeof method>
    type CallType = (self: Conn, ...params: Args) => Retd
    Object.assign(chain, {
      [name]: (...args: Parameters<typeof method>) => {
        const connection = chain.getConnection()
        const method = connection[name] as CallType;
        return method(connection, ...args)
      }
    })
  }
  return chain as Namada.Chain
}

export function createConnection (chain: Namada.Chain, url: string|URL): Namada.Connection {
  const connection: Namada.ConnectionBase = {
    get chain (): Namada.Chain {
      return chain as unknown as Namada.Chain
    },
    get decode () {
      return Decode as unknown as Namada.Decoder
    },
    abcQuery () {},
    log: new Console(String(url)),
    url
  }
  for (const [methodName, method] of Object.entries(Impl)) {
    const name = methodName as keyof Api
    type Conn = ReturnType<Namada.Chain["getConnection"]>
    type Args = Parameters<typeof method>
    type Retd = ReturnType<typeof method>
    type CallType = (self: Conn, ...params: Args) => Retd
    Object.assign(connection, {
      [name]: (...args: Parameters<typeof method>) => {
        const callMethod = method as CallType
        return callMethod(connection, ...args)
      }
    })
  }
  return connection as Namada.Connection
}
