import { Error, Console, CLI } from '@hackbg/fadroma'

/** Base class for console loggers belonging to this package. */
class FadromaTendermintConsole extends Console { label = '@fadroma/tendermint' }

/** Base class for command-line interfaces belonging to this package. */
class FadromaTendermintBaseCLI extends CLI {}

/** Base class for errors thrown by this package. */
class FadromaTendermintError extends Error {}

export {
  FadromaTendermintError   as Error,
  FadromaTendermintConsole as Console,
  FadromaTendermintBaseCLI as CLI
}
