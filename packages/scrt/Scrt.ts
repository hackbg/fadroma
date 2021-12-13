import { Ensemble, EnsembleOptions, BaseEnsemble, ContractAPI } from '@fadroma/ops'
import { open, resolve, Console, dirname, fileURLToPath } from '@fadroma/tools'
import { Scrt } from './ScrtChainAPI'
const __dirname = dirname(fileURLToPath(import.meta.url))
const console = Console('@fadroma/ops-scrt/ScrtAgentJS')

export class ScrtContract extends ContractAPI {
  buildImage  = 'enigmampc/secret-contract-optimizer:latest'
  buildScript = resolve(__dirname, 'ScrtBuild.sh')
}

type EnsembleConstructor = new (args: EnsembleOptions) => Ensemble

export class ScrtEnsemble extends BaseEnsemble {
  /* Plugs into the CLI command parser to select the chain
   * onto which an ensemble is deployed */
  static chainSelector (E: EnsembleConstructor) {
    console.warn('ScrtEnsemble.chainSelector: deprecated!')
    return [
      [ "secret_2",    "Run on secret_2",      on['secret_2']
      , new E({chain: Scrt.secret_2()}).remoteCommands() ],

      [ "secret_3",    "Run on secret_3",      on['secret_3']
      , new E({chain: Scrt.secret_3()}).remoteCommands()],

      ["holodeck-2",   "Run on holodeck2",     on['holodeck-2']
      , new E({chain: Scrt.holodeck_2()}).remoteCommands()],

      ["supernova-1",  "Run on supernova1",    on['supernova-1']
      , new E({chain: Scrt.supernova_1()}).remoteCommands()],

      ["localnet-1.0", "Run on localnet v1.0", on['localnet-1.0']
      , new E({chain: Scrt.localnet_1_0()}).remoteCommands()],

      ["localnet-1.2", "Run on localnet v1.2", on['localnet-1.2']
      , new E({chain: Scrt.localnet_1_2()}).remoteCommands()]
    ]
  }
}

export function openFaucet () {
  const url = `https://faucet.secrettestnet.io/`
  console.debug(`Opening ${url}...`)
  open(url)
}
