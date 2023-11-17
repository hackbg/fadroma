import { Config } from '@hackbg/conf'
import { Console, Error, bold, } from '@fadroma/agent'

class CWConfig extends Config {}

class CWError extends Error {}

class CWConsole extends Console {
  label = '@fadroma/cw'
}

export {
  CWConfig  as Config,
  CWError   as Error,
  CWConsole as Console,
  bold
}
