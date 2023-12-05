import { Console, Error, bold, } from '@fadroma/agent'

class CWError extends Error {}

class CWConsole extends Console {
  label = '@fadroma/cw'
}

export { CWError as Error, CWConsole as Console, bold }
