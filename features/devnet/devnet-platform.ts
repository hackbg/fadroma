import * as Scrt      from './platforms/devnet-scrt'
import * as OKP4      from './platforms/devnet-okp4'
import * as Archway   from './platforms/devnet-archway'
import * as Osmosis   from './platforms/devnet-osmosis'
import * as Injective from './platforms/devnet-injective'
import * as Axelar    from './platforms/devnet-axelar'

export default {
  'scrt':      Scrt,
  'okp4':      OKP4,
  'archway':   Archway,
  'osmosis':   Osmosis,
  'injective': Injective,
  'axelar':    Axelar,
}

export { Scrt, OKP4, Archway, Osmosis, Injective, Axelar }
