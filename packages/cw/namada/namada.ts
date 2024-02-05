import { Core } from '@fadroma/agent'
import { CWConnection, CWBatch } from '../cw-connection'
import { CWMnemonicIdentity } from '../cw-identity'
class NamadaConnection extends CWConnection {}
class NamadaMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
const defaults = { coinType: 118, bech32Prefix: 'tnam1', hdAccountIndex: 0, }
export {
  NamadaConnection       as Connection,
  NamadaMnemonicIdentity as MnemonicIdentity
}

export const chainIds = { testnet: 'luminara.4d6026bc59ee20d9664d3' }

export const testnets = new Set([ 'https://rpc.luminara.icu' ])

/** Connect to Namada in testnet mode. */
export const testnet = (options: Partial<NamadaConnection> = {}): NamadaConnection => {
  return new NamadaConnection({
    chainId: chainIds.testnet, url: Core.pickRandom(testnets), ...options||{}
  })
}
