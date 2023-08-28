import { Config } from '@hackbg/conf'
import { bindChainSupport, Chain, Agent, Bundle, Console, Error, bold } from '@fadroma/agent'
import { CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'

class CWConfig extends Config {}

class CWError extends Error {}

class CWConsole extends Console {}

/** Generic CosmWasm-enabled chain. */
class CWChain extends Chain {
  defaultDenom = ''
  /** Query-only API handle. */
  api?: CosmWasmClient

  /** Async initialization. Populates the `api` property. */
  get ready (): Promise<this & { api: CosmWasmClient }> {
    if (this.api) return Promise.resolve(this) as Promise<this & {
      api: CosmWasmClient
    }>
    return CosmWasmClient
      .connect(this.url)
      .then(api=>Object.assign(this, { api }))
  }
}

/** Generic agent for CosmWasm-enabled chains. */
class CWAgent extends Agent {
  /** Signing API handle. */
  declare api?: SigningCosmWasmClient
  /** Async initialization. Populates the `api` property. */
  get ready (): Promise<this & { api: CosmWasmClient }> {
    if (!this.chain) {
      throw new CWError('no chain specified')
    }
    if (this.api) return Promise.resolve(this) as Promise<this & {
      api: CosmWasmClient
    }>
    return SigningCosmWasmClient
      .connect(this.chain.url)
      .then(api=>Object.assign(this, { api }))
  }
}

/** Generic transaction bundle for CosmWasm-enabled chains. */
class CWBundle extends Bundle {}

export {
  CWConfig  as Config,
  CWError   as Error,
  CWConsole as Console,
  CWChain   as Chain,
  CWAgent   as Agent,
  CWBundle  as Bundle
}

bindChainSupport(CWChain, CWAgent, CWBundle)
