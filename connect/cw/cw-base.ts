import { Config } from '@hackbg/conf'
import { Chain, Agent, Bundle, Console, Error, bold } from '@fadroma/agent'

class CWConfig extends Config {}

class CWError extends Error {}

class CWConsole extends Console {}

/** Generic CosmWasm-enabled chain. */
class CWChain extends Chain {
  defaultDenom = ''
}

/** Generic agent for CosmWasm-enabled chains. */
class CWAgent extends Agent {}

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
