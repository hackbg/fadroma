import type { ChainId } from '../deps.ts'
import { makeChain, makeConnection } from '../deps.ts'
import * as Tendermint from './tmTypes.ts'
import Impl from './tmApi.ts'

async function tendermintConnect (options: {
  urls:            Array<string|URL>,
  chainId?:        ChainId,
  bech32Prefix?:   string,
  coinType?:       string,
  hdAccountIndex?: string,
}): Promise<Tendermint.Chain> {
  const chain: Tendermint.Chain = {
    id:           options.chainId!,
    bech32Prefix: options.bech32Prefix,
    connections:  await Promise.all(options.urls.map(url=>createTendermintConnection(chain, url))),
  }
  return makeChain({ methods: Impl, chain })
}

async function createTendermintConnection (
  chain: Tendermint.Chain, 
  url:   string|URL
): Promise<Tendermint.Connection> {
  return makeConnection({
    methods: Impl,
    connection: {
      chain,
      url
    }
  })
}

export {
  tendermintConnect as connect
}
