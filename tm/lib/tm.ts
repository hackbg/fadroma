import type { ChainId } from '../deps.ts'
import * as Tendermint from './tmTypes.ts'

async function tendermintConnect (options: {
  urls:            Array<string|URL>,
  chainId?:        ChainId,
  bech32Prefix?:   string,
  coinType?:       string,
  hdAccountIndex?: string,
}): Promise<Tendermint.Chain> {
  return {
    bech32Prefix: options.bech32Prefix,
    id:           options.chainId!,
    connections:  await Promise.all(urls.map(url=>createTendermintConnection(url))),
  }
}

async function createTendermintConnection (chain: Tendermint.Chain, url: string|URL) {
  return {
    chain,
    url,
    abcInfo,
    abciQuery,
    block,
    blockResults,
    blockSearch,
    blockSearchAll,
    blockchain,
    broadcastTxSync,
    broadcastTxAsync,
    broadcastTxCommit,
    commit,
    genesis,
    health,
    numUnconfirmedTxs,
    status,
    subscribeNewBlock,
    subscribeNewBlockHeader,
    subscribeTx,
    tx,
    txSearch,
    txSearchAll,
    validators,
    validatorsAll,
  }
}

export {
  tendermintConnect as connect
}
